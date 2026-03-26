import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this is a manual publish request
    let requestBody: any = {};
    try {
      const bodyText = await req.text();
      if (bodyText) {
        requestBody = JSON.parse(bodyText);
      }
    } catch {
      // Body is optional for cron-triggered requests
    }

    const { contentId, manual } = requestBody;
    
    console.log("Publishing content...", { contentId, manual });

    if (contentId) {
      // Manual publish of specific content - just update status
      const { data, error } = await supabase
        .from('content')
        .update({ 
          status: 'published', 
          published_at: new Date().toISOString() 
        })
        .eq('id', contentId)
        .select()
        .single();

      if (error) throw error;

      console.log("Content published:", data?.id);
      
      return new Response(
        JSON.stringify({ success: true, content: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auto-publish: Find all scheduled content that should be published
    const now = new Date().toISOString();
    
    // First, get all users who have auto-publish enabled
    const { data: enabledUsers, error: usersError } = await supabase
      .from('publishing_settings')
      .select('user_id')
      .eq('auto_publish_enabled', true);
    
    if (usersError) {
      console.error('Error fetching publishing settings:', usersError);
      // Continue anyway - this allows manual triggers to work
    }
    
    const enabledUserIds = enabledUsers?.map(u => u.user_id) || [];
    
    // If no users have auto-publish enabled, return early
    if (enabledUserIds.length === 0) {
      console.log("No users have auto-publish enabled");
      return new Response(
        JSON.stringify({ success: true, published: 0, message: "Auto-publish is disabled for all users" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Find scheduled content for users with auto-publish enabled
    const { data: scheduledContent, error: fetchError } = await supabase
      .from('content')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_date', now)
      .in('user_id', enabledUserIds);

    if (fetchError) throw fetchError;

    if (!scheduledContent || scheduledContent.length === 0) {
      console.log("No content to publish");
      return new Response(
        JSON.stringify({ success: true, published: 0, message: "No content to publish" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${scheduledContent.length} scheduled items to publish`);

    // Get the Supabase URL and service role key for calling publish-social
    const publishSocialUrl = `${supabaseUrl}/functions/v1/publish-social`;
    
    const publishedItems: string[] = [];
    const failedItems: Array<{ id: string; title: string; error: string }> = [];

    // Publish each scheduled item to social media
    for (const content of scheduledContent) {
      try {
        console.log(`Publishing content ${content.id} (${content.title}) to ${content.platform || 'instagram'}...`);
        
        // Call publish-social function to actually publish to social media
        const publishResponse = await fetch(publishSocialUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            contentId: content.id,
            platform: content.platform || 'instagram',
          }),
        });

        const publishResult = await publishResponse.json();
        
        if (publishResult.success) {
          // Update status to published only if publishing succeeded
          const { error: updateError } = await supabase
            .from('content')
            .update({ 
              status: 'published', 
              published_at: new Date().toISOString(),
              social_post_id: publishResult.postId || null,
            })
            .eq('id', content.id);

          if (updateError) {
            console.error(`Error updating content ${content.id}:`, updateError);
            failedItems.push({
              id: content.id,
              title: content.title || 'Untitled',
              error: `Published but failed to update status: ${updateError.message}`,
            });
          } else {
            publishedItems.push(content.title || 'Untitled');
            console.log(`✅ Successfully published content ${content.id}`);
          }
        } else {
          // Publishing failed - keep status as scheduled so it can be retried
          const errorMsg = publishResult.error || 'Unknown error';
          console.error(`❌ Failed to publish content ${content.id}:`, errorMsg);
          failedItems.push({
            id: content.id,
            title: content.title || 'Untitled',
            error: errorMsg,
          });
        }
        
        // Small delay between publishes to avoid rate limits
        if (scheduledContent.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(`Error publishing content ${content.id}:`, error);
        failedItems.push({
          id: content.id,
          title: content.title || 'Untitled',
          error: error.message || String(error),
        });
      }
    }

    console.log(`Published ${publishedItems.length} items, ${failedItems.length} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        published: publishedItems.length,
        failed: failedItems.length,
        publishedItems,
        failedItems,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in publish-content function:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
