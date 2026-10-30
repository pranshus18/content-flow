import { logger } from '../lib/logger.js';
import { getServiceClient } from '../lib/supabase.js';
import { assertContentAccess } from '../lib/content-access.js';
import { errorMessage } from '../lib/http.js';
import { requireAdmin } from '../lib/roles.js';
import { publishContentToSocial } from './publish-social.js';

export interface PublishContentInput {
  contentId?: string;
  manual?: boolean;
}

export async function publishContent(
  input: PublishContentInput = {},
  actor?: { id: string },
) {
  const { contentId } = input;
  const supabase = getServiceClient();

  if (contentId) {
    if (actor?.id) {
      await assertContentAccess(actor.id, contentId);
      if (actor.id !== 'cron') await requireAdmin(actor.id);
    }

    logger.info('publish-content', 'Publishing content to social', { contentId });
    const publishResult = await publishContentToSocial({ contentId });
    if (!publishResult.success) {
      return { success: false, error: publishResult.error, platform: publishResult.platform };
    }

    logger.info('publish-content', 'Published to social', { id: contentId, postId: publishResult.postId });
    return { success: true, postId: publishResult.postId, platform: publishResult.platform };
  }

  if (actor?.id && actor.id !== 'cron') {
    await requireAdmin(actor.id);
  }

  const now = new Date().toISOString();
  const { data: scheduledContent, error: fetchError } = await supabase
    .from('content')
    .select('*')
    .eq('status', 'scheduled')
    .not('scheduled_date', 'is', null)
    .lte('scheduled_date', now);

  if (fetchError) throw fetchError;

  if (!scheduledContent || scheduledContent.length === 0) {
    return { success: true, published: 0, skipped: true, reason: 'nothing_due' };
  }

  logger.info('publish-content', `Found ${scheduledContent.length} scheduled items`);

  const publishedItems: string[] = [];
  const failedItems: Array<{ id: string; title: string; error: string }> = [];

  for (const content of scheduledContent) {
    try {
      logger.info('publish-content', `Publishing ${content.id} (${content.title}) to ${content.platform || 'instagram'}`);
      const publishResult = await publishContentToSocial({
        contentId: content.id,
        platform: content.platform || 'instagram',
      });

      if (publishResult.success) {
        const { error: updateError } = await supabase
          .from('content')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            social_post_id: publishResult.postId || null,
          })
          .eq('id', content.id);

        if (updateError) {
          failedItems.push({
            id: content.id,
            title: content.title || 'Untitled',
            error: `Published but failed to update status: ${updateError.message}`,
          });
        } else {
          publishedItems.push(content.title || 'Untitled');
          logger.info('publish-content', `Published ${content.id}`);
        }
      } else {
        failedItems.push({
          id: content.id,
          title: content.title || 'Untitled',
          error: publishResult.error || 'Unknown error',
        });
        logger.error('publish-content', `Failed to publish ${content.id}`, publishResult.error);
      }

      if (scheduledContent.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error: unknown) {
      logger.error('publish-content', `Error publishing ${content.id}`, error);
      failedItems.push({
        id: content.id,
        title: content.title || 'Untitled',
        error: errorMessage(error),
      });
    }
  }

  logger.info('publish-content', `Published ${publishedItems.length}, failed ${failedItems.length}`);
  return {
    success: true,
    published: publishedItems.length,
    failed: failedItems.length,
    publishedItems,
    failedItems,
  };
}
