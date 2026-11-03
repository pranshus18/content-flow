import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeBackend } from '@/lib/backend';
import { errorMessage } from '@/lib/utils';
import { useAuth } from './useAuth';
import { useUserRole } from './useUserRole';
import { useToast } from './use-toast';
export interface ContentItem {
  id: string;
  user_id: string;
  user_email?: string | null; // User email (only for admin views)
  user_first_name?: string | null; // User first name (only for admin views)
  user_last_name?: string | null; // User last name (only for admin views)
  title: string;
  description: string | null;
  admin_description: string | null;
  admin_notes: string | null;
  platform: string;
  status: string;
  media_url: string | null;
  media_type: string | null;
  original_media_url: string | null;
  enhanced_media_url: string | null;
  scheduled_date: string | null;
  published_at: string | null;
  preprocessing_status: string | null;
  social_post_id: string | null;
  likes_count: number | null;
  comments_count: number | null;
  shares_count: number | null;
  reach_count: number | null;
  watermark_logo_url: string | null;
  vendor_logo_url?: string | null;
  watermark_website_url: string | null;
  watermark_position: string | null;
  vendor_logo_position?: string | null;
  platform_logo_throughout?: boolean | null;
  vendor_logo_throughout?: boolean | null;
  intro_frame_url?: string | null;
  outro_frame_url?: string | null;
  intro_frame_duration?: number | null;
  outro_frame_duration?: number | null;
  template_source_url?: string | null;
  template_frames_applied?: boolean | null;
  background_music_track_id?: string | null;
  background_music_volume?: number | null;
  created_at: string;
  updated_at: string;
}

function useContentController() {
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const fetchContents = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const data = await invokeBackend<ContentItem[]>('content', undefined, { method: 'GET' });
      setContents(data || []);
    } catch (error: unknown) {
      console.error('Error fetching content:', error);
      toast({
        title: 'Error',
        description: errorMessage(error, 'Failed to load content'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch content when user is ready AND admin status is determined
  useEffect(() => {
    if (!user) {
      // No user - clear content
      setContents([]);
      setLoading(false);
      return;
    }

    if (roleLoading) {
      return;
    }

    fetchContents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin, roleLoading]);

  useEffect(() => {
    const pending = contents.some((item) => item.preprocessing_status === 'pending');
    if (!user || !pending) return;

    const timer = window.setInterval(() => {
      fetchContents().catch(() => {});
    }, 8000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, contents.some((item) => item.preprocessing_status === 'pending')]);

  const createContent = async (data: {
    title: string;
    description?: string;
    platform: string;
    media_url?: string;
    scheduled_date?: string;
    media_type?: 'image' | 'video';
  }) => {
    if (!user) return null;

    try {
      // Determine status: scheduled > pending > draft
      let contentStatus = 'draft';
      if (data.scheduled_date) {
        contentStatus = 'scheduled';
      } else if (data.media_url) {
        contentStatus = 'pending';
      }
      
      const newContent = await invokeBackend<ContentItem>('content', {
        title: data.title,
        description: data.description || null,
        platform: data.platform,
        scheduled_date: data.scheduled_date || null,
        media_url: data.media_url || null,
        media_type: data.media_type || null,
        status: contentStatus,
      });

      setContents(prev => [newContent, ...prev]);
      
      // Refetch content to ensure it's persisted and visible after refresh
      // This ensures content stays after page refresh or logout/login
      setTimeout(() => {
        fetchContents().catch(err => {
          console.error('Error refetching content after creation:', err);
        });
      }, 500);
      
      // Return immediately - don't wait for any processing
      const toastMessage = data.scheduled_date
        ? `Content scheduled for ${new Date(data.scheduled_date).toLocaleDateString()} at ${new Date(data.scheduled_date).toLocaleTimeString()}`
        : data.media_url
        ? 'Upload complete. Quality enhancement and platform formatting are running in the background.'
        : 'New content has been added to drafts.';
      
      toast({
        title: data.scheduled_date ? 'Content Scheduled' : 'Content Created',
        description: toastMessage,
      });
      
      // Return immediately - processing happens in background
      return newContent;
    } catch (error: unknown) {
      console.error('Error creating content:', error);
      toast({
        title: 'Error',
        description: errorMessage(error),
        variant: 'destructive',
      });
      return null;
    }
  };

  const preprocessMedia = async (contentId: string, mediaUrl: string, mediaType?: 'image' | 'video', platform?: string) => {
    try {
      // Determine media type if not provided
      const detectedType = mediaType || 
        (mediaUrl?.includes('.mp4') || mediaUrl?.includes('.mov') || mediaUrl?.includes('.webm') || mediaUrl?.includes('video') ? 'video' : 'image');
      
      const mediaTypeText = detectedType === 'video' ? 'video' : 'image';
      const targetPlatform = platform || 'instagram';
      
      // Don't show blocking toast - processing happens in background
      console.log('Starting background preprocessing:', { contentId, mediaUrl: mediaUrl?.substring(0, 50), mediaType: detectedType, platform: targetPlatform });

      const data = await invokeBackend<{
        enhancedMediaUrl?: string;
        originalMediaUrl?: string;
        clarityScore?: number;
        note?: string;
        watermarkApplied?: boolean;
      }>('preprocess-media', {
        mediaUrl,
        contentId,
        mediaType: detectedType,
        platform: targetPlatform,
      });

      const currentContent = contents.find((item) => item.id === contentId);
      const nextStatus = currentContent?.scheduled_date ? 'scheduled' : 'pending';

      if (data?.enhancedMediaUrl) {
        console.log('Using enhanced media URL for main media_url:', data.enhancedMediaUrl?.substring(0, 50));
      } else if (data?.originalMediaUrl) {
        console.log('No enhancement available, using original media URL');
      }

      console.log('Content updated after preprocessing:', {
        contentId,
        status: nextStatus,
        hasEnhancedUrl: !!data?.enhancedMediaUrl,
        clarityScore: data?.clarityScore,
        note: data?.note
      });

      setContents(prev => prev.map(c => 
        c.id === contentId 
          ? { 
              ...c, 
              media_url: data?.enhancedMediaUrl || c.media_url,
              enhanced_media_url: data?.enhancedMediaUrl || c.enhanced_media_url, 
              preprocessing_status: 'completed',
              status: c.scheduled_date ? 'scheduled' : 'pending'
            }
          : c
      ));

      console.log('Background media processing completed:', contentId);
    } catch (error: unknown) {
      console.error('Error preprocessing media:', error);
      try {
        await invokeBackend(`content/${contentId}`, { preprocessing_status: 'failed' }, { method: 'PATCH' });
      } catch (updateError) {
        console.error('Error marking preprocess as failed:', updateError);
      }

      setContents(prev => prev.map(c => 
        c.id === contentId 
          ? { ...c, preprocessing_status: 'failed' }
          : c
      ));
    }
  };

  const updateContent = async (id: string, data: Partial<ContentItem>) => {
    try {
      const updated = await invokeBackend<ContentItem>(`content/${id}`, data, { method: 'PATCH' });
      setContents(prev => prev.map(c => c.id === id ? updated : c));
      return updated;
    } catch (error: unknown) {
      console.error('Error updating content:', error);
      toast({
        title: 'Error',
        description: errorMessage(error),
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateAdminFields = async (
    id: string, 
    adminDescription: string, 
    adminNotes: string,
    watermarkLogoUrl?: string,
    vendorLogoUrl?: string,
    watermarkWebsiteUrl?: string,
    watermarkPosition?: string,
    vendorLogoPosition?: string,
    templateFrames?: {
      intro_frame_url?: string | null;
      outro_frame_url?: string | null;
      intro_frame_duration?: number;
      outro_frame_duration?: number;
    },
    logoVideoScope?: {
      platform_logo_throughout?: boolean;
      vendor_logo_throughout?: boolean;
    },
    backgroundMusic?: {
      background_music_track_id?: string | null;
      background_music_volume?: number;
    },
  ) => {
    const result = await updateContent(id, {
      admin_description: adminDescription,
      admin_notes: adminNotes,
      watermark_logo_url: watermarkLogoUrl || null,
      vendor_logo_url: vendorLogoUrl || null,
      watermark_website_url: watermarkWebsiteUrl || null,
      watermark_position: watermarkPosition || null,
      vendor_logo_position: vendorLogoPosition || null,
      ...(logoVideoScope
        ? {
            platform_logo_throughout: logoVideoScope.platform_logo_throughout === true,
            vendor_logo_throughout: logoVideoScope.vendor_logo_throughout === true,
          }
        : {}),
      ...(templateFrames
        ? {
            intro_frame_url: templateFrames.intro_frame_url || null,
            outro_frame_url: templateFrames.outro_frame_url || null,
            intro_frame_duration: templateFrames.intro_frame_duration,
            outro_frame_duration: templateFrames.outro_frame_duration,
          }
        : {}),
      ...(backgroundMusic
        ? {
            background_music_track_id: backgroundMusic.background_music_track_id ?? null,
            background_music_volume: backgroundMusic.background_music_volume ?? 1,
          }
        : {}),
    });
    if (result) {
      toast({
        title: 'Updated',
        description: 'Admin fields have been saved.',
      });
    }
    return result;
  };

  const updateStatus = async (id: string, status: string) => {
    const result = await updateContent(id, { status });
    if (result) {
      toast({
        title: status === 'approved' ? 'Content Approved' : 'Status Updated',
        description: status === 'approved'
          ? 'Content approved. Logos stay on this video only if you set them in Edit.'
          : `Content moved to ${status}`,
      });
    }
    return result;
  };

  const deleteContent = async (id: string) => {
    try {
      await invokeBackend(`content/${id}`, undefined, { method: 'DELETE' });

      setContents(prev => prev.filter(c => c.id !== id));
      toast({
        title: 'Content Deleted',
        description: 'The content has been removed.',
        variant: 'destructive',
      });
    } catch (error: unknown) {
      console.error('Error deleting content:', error);
      toast({
        title: 'Error',
        description: errorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const enhanceMedia = async (
    contentId: string,
    mediaUrl: string,
    mediaType?: 'image' | 'video'
  ) => {
    const isVideo = mediaType === 'video';
    try {
      toast({
        title: isVideo ? 'Restoring video with Gemini' : 'Restoring photo with Gemini',
        description: isVideo
          ? 'Sharpening the main clip plus intro and outro to 1080p. This can take a few minutes.'
          : 'Sharpening the photo to 2K. Nothing extra will be added.',
      });

      let predictionId: string | undefined;
      const maxAttempts = isVideo ? 36 : 16;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const data = await invokeBackend<{
          error?: string;
          status?: string;
          enhancedMediaUrl?: string;
          enhancedImageUrl?: string;
          predictionId?: string;
          model?: string;
        }>('enhance-media', {
          mediaUrl,
          mediaType,
          contentId,
          predictionId,
          scale: 2,
          faceEnhance: true,
          videoResolution: 'FHD',
        });
        if (data?.error && data?.status !== 'processing') {
          throw new Error(data.error);
        }

        const enhancedUrl = data?.enhancedMediaUrl || data?.enhancedImageUrl;
        if ((data?.status === 'completed' || enhancedUrl) && enhancedUrl) {
          await updateContent(contentId, {
            enhanced_media_url: enhancedUrl,
            media_url: enhancedUrl,
          });
          toast({
            title: 'Quality enhancement complete',
            description: isVideo
              ? 'Intro, main clip, and outro were restored. Preview and download now use the sharp version.'
              : 'The photo was restored. Preview and download now use the sharp version.',
          });
          return enhancedUrl as string;
        }

        if (data?.status === 'failed') {
          throw new Error(data.error || 'Quality enhancement failed');
        }

        predictionId = data?.predictionId;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      throw new Error(
        isVideo
          ? 'Video enhancement is still running. Wait a minute and try again.'
          : 'Photo enhancement timed out. Please try again.'
      );
    } catch (error: unknown) {
      console.error('Error enhancing media:', error);
      toast({
        title: 'Enhancement Failed',
        description: errorMessage(error),
        variant: 'destructive',
      });
      return null;
    }
  };

  const publishToSocial = async (contentId: string) => {
    try {
      toast({
        title: 'Publishing',
        description: 'Posting to social media...',
      });

      const data = await invokeBackend<{
        success?: boolean;
        platform?: string;
        postId?: string;
        error?: string;
      }>('publish-social', { contentId });

      // Process the response
      if (data?.success) {
        setContents(prev => prev.map(c => 
          c.id === contentId 
            ? { ...c, status: 'published', published_at: new Date().toISOString(), social_post_id: data.postId }
            : c
        ));
        toast({
          title: 'Published!',
          description: `Successfully posted to ${data.platform}`,
        });
      } else {
        toast({
          title: 'Publish Failed',
          description: data?.error || 'Could not publish to social media',
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      console.error('Error publishing content:', error);
      toast({
        title: 'Publish Failed',
        description: errorMessage(error, 'Unknown error occurred'),
        variant: 'destructive',
      });
    }
  };

  const fetchAnalytics = async (contentId: string, silent: boolean = false) => {
    try {
      const data = await invokeBackend<{
        success?: boolean;
        error?: string;
        analytics?: { likes: number; comments: number; shares: number; reach: number };
      }>('fetch-analytics', { contentId });

      if (data?.success) {
        // Update local state immediately for better UX
        setContents(prev => prev.map(c => 
          c.id === contentId 
            ? { 
                ...c, 
                likes_count: data.analytics?.likes,
                comments_count: data.analytics?.comments,
                shares_count: data.analytics?.shares,
                reach_count: data.analytics?.reach,
              }
            : c
        ));
        
        // Also refetch from database to ensure consistency
        // This ensures we get the latest data even if there was a race condition
        setTimeout(() => {
          fetchContents().catch(err => {
            console.error('Error refetching content after analytics update:', err);
          });
        }, 500);

        // Only show success toast if not silent (user-initiated action)
        if (!silent) {
          // For YouTube, show views instead of shares
          const platform = contents.find(c => c.id === contentId)?.platform;
          const displayText = platform === 'youtube' 
            ? `Likes: ${data.analytics?.likes}, Comments: ${data.analytics?.comments}, Views: ${data.analytics?.reach}`
            : `Likes: ${data.analytics?.likes}, Comments: ${data.analytics?.comments}, Shares: ${data.analytics?.shares}`;
          
          toast({
            title: "Analytics updated",
            description: displayText,
          });
        }
        return data.analytics;
      } else if (data?.error) {
        console.error('Analytics fetch error:', data.error);
        // Only show toast if not silent
        if (!silent) {
          // Don't show error for common cases like "not published" or "token not configured"
          // These are expected and don't need user notification
          const errorMsg = data.error || '';
          if (!errorMsg.includes('not published') && !errorMsg.includes('not configured')) {
            toast({
              title: "Failed to fetch analytics",
              description: errorMsg,
              variant: 'destructive',
            });
          }
        }
        return null;
      }
      return null;
    } catch (error: unknown) {
      console.error('Error fetching analytics:', error);
      // Only show toast if not silent
      if (!silent) {
        // Check if it's a function not found or network error
        const message = errorMessage(error);
        if (message.includes('not found') || message.includes('non-2xx') || message.includes('Failed to fetch')) {
          // Don't show error for auto-fetch failures - these are expected if function isn't deployed
          return null;
        }
        toast({
          title: "Failed to fetch analytics",
          description: errorMessage(error, 'An unexpected error occurred. Please check the console for details.'),
          variant: 'destructive',
        });
      }
      return null;
    }
  };

  return {
    contents,
    loading,
    createContent,
    updateContent,
    updateAdminFields,
    updateStatus,
    deleteContent,
    enhanceMedia,
    preprocessMedia,
    publishToSocial,
    fetchAnalytics,
    refetch: fetchContents,
  };
}

const ContentContext = createContext<ReturnType<typeof useContentController> | null>(null);

export function ContentProvider({ children }: { children: ReactNode }) {
  const value = useContentController();
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error('useContent must be used within ContentProvider');
  }
  return context;
}
