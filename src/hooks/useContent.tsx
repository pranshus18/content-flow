import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  watermark_website_url: string | null;
  watermark_position: string | null;
  video_text_overlays: VideoTextOverlay[] | null;
  created_at: string;
  updated_at: string;
}

export interface VideoTextOverlay {
  id: string;
  text: string;
  /**
   * Display mode: 'repeat' or 'timeframe'
   * - 'repeat': Shows text at regular intervals (uses repeatEverySeconds and showForSeconds)
   * - 'timeframe': Shows text at specific time range (uses startTime and endTime)
   */
  displayMode?: 'repeat' | 'timeframe';
  /**
   * Repeat interval in seconds (for 'repeat' mode).
   * Example: 5 => shows every 5 seconds during playback.
   */
  repeatEverySeconds?: number;
  /**
   * How long (in seconds) the text stays visible each time it appears (for 'repeat' mode).
   * Example: 2 => shows for 2 seconds every interval.
   */
  showForSeconds?: number;
  /**
   * Start time in seconds (for 'timeframe' mode).
   * Example: 5 => text appears at 5 seconds.
   */
  startTime?: number;
  /**
   * End time in seconds (for 'timeframe' mode).
   * Example: 10 => text disappears at 10 seconds.
   */
  endTime?: number;
  position: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
  opacity?: number;
  animation?: 'fade' | 'slide' | 'none';
}

export function useContent() {
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();

  const fetchContents = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Admins see all content with user info, users see only their own
      if (isAdmin) {
        // Use RPC function to get content with user info
        const { data, error } = await supabase.rpc('get_content_with_user_info');

        if (error) {
          console.error('Error fetching content with user info:', error);
          throw error;
        }
        
        console.log('Fetched content with user info:', { 
          count: data?.length || 0, 
          isAdmin, 
          userId: user.id,
        });
        
        setContents(data || []);
      } else {
        // Regular users see only their own content (no user info needed)
        const { data, error } = await supabase
          .from('content')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching content:', error);
          throw error;
        }
        
        console.log('Fetched user content:', { 
          count: data?.length || 0, 
          userId: user.id,
        });
        
        setContents(data || []);
      }
    } catch (error: any) {
      console.error('Error fetching content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load content',
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

    // Wait for admin status to be determined (not undefined)
    // This ensures we fetch with the correct query (admin vs user)
    if (isAdmin === undefined) {
      // Still loading admin status, wait
      return;
    }

    // Both user and admin status are ready - fetch content
    console.log('Fetching content - user ready, admin status:', isAdmin);
    fetchContents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

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
      
      console.log('Creating content:', {
        title: data.title,
        hasMedia: !!data.media_url,
        mediaType: data.media_type,
        scheduledDate: data.scheduled_date,
        status: contentStatus
      });

      // Don't apply branding settings during upload - they'll be added when admin approves
      // Logo and website will be added automatically during approval in admin portal
      // Set preprocessing_status to null so no "Processing..." overlay shows
      const { data: newContent, error } = await supabase
        .from('content')
        .insert({
          title: data.title,
          description: data.description || null,
          platform: data.platform,
          scheduled_date: data.scheduled_date || null,
          media_url: data.media_url || null,
          media_type: data.media_type || null,
          user_id: user.id,
          status: contentStatus,
          original_media_url: data.media_url || null,
          preprocessing_status: null, // No preprocessing status - upload is instant, no processing overlay
          // Branding settings (logo, website, position) will be added when admin approves
          watermark_logo_url: null,
          watermark_website_url: null,
          watermark_position: null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating content:', error);
        throw error;
      }

      console.log('Content created successfully:', {
        id: newContent.id,
        status: newContent.status,
        media_url: newContent.media_url ? 'present' : 'missing'
      });

      // Update local state - add to beginning of list immediately
      setContents(prev => [newContent, ...prev]);
      
      // NO PREPROCESSING DURING UPLOAD - Upload is instant, no processing overlay
      // Logo/website processing will happen when admin approves, not during upload
      // Images/videos are uploaded as-is, processing happens only on approval
      if (data.media_url) {
        console.log('Content uploaded successfully - no preprocessing needed:', {
          contentId: newContent.id,
          mediaType: data.media_type,
          note: 'Processing will happen when admin approves'
        });
      }
      
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
        ? 'Upload complete! Your content is ready.'
        : 'New content has been added to drafts.';
      
      toast({
        title: data.scheduled_date ? 'Content Scheduled' : 'Content Created',
        description: toastMessage,
      });
      
      // Return immediately - processing happens in background
      return newContent;
    } catch (error: any) {
      console.error('Error creating content:', error);
      toast({
        title: 'Error',
        description: error.message,
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

      const { data, error } = await supabase.functions.invoke('preprocess-media', {
        body: { 
          mediaUrl, 
          contentId, 
          mediaType: detectedType,
          platform: targetPlatform
        }
      });

      if (error) throw error;

      // Get current content to check if it's scheduled
      const { data: currentContent } = await supabase
        .from('content')
        .select('status, scheduled_date')
        .eq('id', contentId)
        .single();

      // Update content with preprocessed media
      // IMPORTANT: Update media_url to the enhanced version so admin portal shows processed image
      // Preserve scheduled status if content was scheduled, otherwise set to pending
      const updateData: any = {
        preprocessing_status: 'completed',
        status: currentContent?.scheduled_date ? 'scheduled' : 'pending',
      };

      if (data?.enhancedMediaUrl) {
        // Update both enhanced_media_url and media_url so admin sees the processed version
        updateData.enhanced_media_url = data.enhancedMediaUrl;
        updateData.media_url = data.enhancedMediaUrl; // Use enhanced version as main media_url
        console.log('Using enhanced media URL for main media_url:', data.enhancedMediaUrl?.substring(0, 50));
      } else if (data?.originalMediaUrl) {
        // If no enhancement, at least ensure we have the original
        console.log('No enhancement available, using original media URL');
      }

      const { error: updateError } = await supabase
        .from('content')
        .update(updateData)
        .eq('id', contentId);

      if (updateError) {
        console.error('Error updating content after preprocessing:', updateError);
      } else {
        console.log('Content updated after preprocessing:', {
          contentId,
          status: 'pending',
          hasEnhancedUrl: !!data?.enhancedMediaUrl,
          clarityScore: data?.clarityScore,
          note: data?.note
        });
      }

      // Update local state
      setContents(prev => prev.map(c => 
        c.id === contentId 
          ? { 
              ...c, 
              media_url: data?.enhancedMediaUrl || c.media_url, // Update main media_url
              enhanced_media_url: data?.enhancedMediaUrl || c.enhanced_media_url, 
              preprocessing_status: 'completed',
              status: c.scheduled_date ? 'scheduled' : 'pending'
            }
          : c
      ));

      // IMPORTANT: For IMAGES, the admin portal shows a watermark overlay in the UI,
      // but social platforms (Facebook, etc.) will NOT show that overlay unless we bake it into the image file.
      // So after preprocessing, we generate a watermarked image file client-side and upload it,
      // then update content.media_url/enhanced_media_url to the baked image URL.
      if (detectedType === 'image') {
        try {
          const sourceUrl = data?.enhancedMediaUrl || mediaUrl;
          console.log('🖼️ Starting watermark baking for image (so it appears on Facebook):', {
            contentId,
            platform: targetPlatform,
            sourceUrl: sourceUrl?.substring(0, 80),
          });

          // Fetch watermark settings from content record first, fallback to branding_settings
          const { data: contentBranding } = await supabase
            .from('content')
            .select('watermark_logo_url, watermark_website_url, watermark_position')
            .eq('id', contentId)
            .single();

          const { data: brandingSettings } = await supabase
            .from('branding_settings')
            .select('watermark_enabled, watermark_position, company_logo_url, company_website_url')
            .maybeSingle();

          const watermarkEnabled = brandingSettings?.watermark_enabled !== false;
          const logoUrl = contentBranding?.watermark_logo_url || brandingSettings?.company_logo_url || null;
          const websiteUrl = contentBranding?.watermark_website_url || brandingSettings?.company_website_url || null;
          const position = contentBranding?.watermark_position || brandingSettings?.watermark_position || 'bottom-right';

          if (!watermarkEnabled || (!logoUrl && !websiteUrl)) {
            console.log('🖼️ Watermark baking skipped (disabled or no logo/website set).');
          } else if (!sourceUrl) {
            console.warn('🖼️ Watermark baking skipped (no source URL).');
          } else {
            // Download the image, bake watermark, and upload
            const imgResp = await fetch(sourceUrl);
            if (!imgResp.ok) throw new Error(`Failed to fetch image for watermarking (HTTP ${imgResp.status})`);
            const imgBlob = await imgResp.blob();
            const inputFile = new File([imgBlob], 'image.jpg', { type: imgBlob.type || 'image/jpeg' });

            const { processImageForPlatformWithWatermark } = await import('@/utils/imageResize');
            const baked = await processImageForPlatformWithWatermark(
              inputFile,
              targetPlatform,
              0.92,
              { enabled: true, logoUrl, websiteUrl, position }
            );

            const fileName = `processed-images/${contentId}-${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage
              .from('content-media')
              .upload(fileName, baked, {
                cacheControl: '3600',
                upsert: false,
                contentType: baked.type,
              });
            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('content-media').getPublicUrl(fileName);
            const bakedUrl = urlData.publicUrl;

            // Update DB + local state to ensure publishing uses the baked file
            await supabase
              .from('content')
              .update({ media_url: bakedUrl, enhanced_media_url: bakedUrl })
              .eq('id', contentId);

            setContents(prev => prev.map(c =>
              c.id === contentId
                ? { ...c, media_url: bakedUrl, enhanced_media_url: bakedUrl }
                : c
            ));

            console.log('✅ Image watermark baked and uploaded. Facebook will now show it:', {
              contentId,
              bakedUrl: bakedUrl.substring(0, 80),
              position,
              hasLogo: !!logoUrl,
              hasWebsite: !!websiteUrl,
            });
          }
        } catch (wmErr) {
          console.warn('⚠️ Image watermark baking failed (will still publish original image):', wmErr);
        }
      }

      // Don't show toast - processing happens silently in background
      console.log('Background media processing completed:', contentId);
    } catch (error: any) {
      console.error('Error preprocessing media:', error);
      await supabase
        .from('content')
        .update({ preprocessing_status: 'failed' })
        .eq('id', contentId);

      setContents(prev => prev.map(c => 
        c.id === contentId 
          ? { ...c, preprocessing_status: 'failed' }
          : c
      ));
    }
  };

  // Process video with logo asynchronously (doesn't block upload)
  const processVideoWithLogo = async (contentId: string, videoUrl: string, platform?: string) => {
    try {
      console.log('🎬 Starting async video logo processing:', { contentId, platform });
      
      // Get branding settings from content record (already applied during creation)
      // Also check branding_settings as fallback
      const { data: contentData } = await supabase
        .from('content')
        .select('watermark_logo_url, watermark_website_url, watermark_position')
        .eq('id', contentId)
        .single();
      
      const { data: brandingSettings } = await supabase
        .from('branding_settings')
        .select('watermark_enabled, watermark_position, company_logo_url, company_website_url')
        .maybeSingle();
      
      const watermarkEnabled = brandingSettings?.watermark_enabled !== false;
      
      if (!watermarkEnabled) {
        console.log('Watermark disabled, skipping logo processing');
        return;
      }
      
      // Get logo URL from content record (from branding settings) or branding settings directly
      const logoUrl = contentData?.watermark_logo_url || brandingSettings?.company_logo_url;
      const websiteUrl = contentData?.watermark_website_url || brandingSettings?.company_website_url;
      const watermarkPosition = contentData?.watermark_position || brandingSettings?.watermark_position || 'bottom-right';
      
      console.log('📋 Logo processing settings:', {
        logoUrl: logoUrl || 'will use public folder',
        websiteUrl: websiteUrl || 'not set',
        position: watermarkPosition,
        note: 'Logo will be embedded in video file'
      });
      
      if (!logoUrl) {
        console.warn('⚠️ No logo URL found in content or branding settings - logo will be loaded from public folder');
      }
      
      toast({
        title: 'Processing Video with Logo',
        description: 'Adding your logo to the video in the background...',
      });
      
      // Fetch the video file
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error('Failed to fetch video');
      }
      
      const videoBlob = await videoResponse.blob();
      const videoFile = new File([videoBlob], 'video.mp4', { type: videoBlob.type });
      
      // Import video processing utilities
      const { processVideoForPlatform } = await import('@/utils/videoProcess');
      const { DEFAULT_SHARPENING_CONFIG } = await import('@/utils/videoSharpen');
      
      // Use minimal sharpening for faster processing
      const fastConfig = {
        ...DEFAULT_SHARPENING_CONFIG,
        enabled: false,
        strength: 0,
      };
      
      // Process video with logo - PASS LOGO URL EXPLICITLY
      console.log('🎬 Processing video with logo URL:', logoUrl || 'will use public folder');
      console.log('⏳ This may take 30-60 seconds depending on video length...');
      
      const processedVideo = await processVideoForPlatform(
        videoFile,
        platform || 'instagram',
        (progress) => {
          // Log progress every 10%
          if (progress % 10 < 1) {
            console.log(`📹 Video processing progress: ${Math.round(progress)}%`);
          }
        },
        fastConfig,
        logoUrl // Pass logo URL from settings explicitly
      );
      
      console.log('✅ Video processing completed! Uploading processed video...');
      
      // Upload processed video
      const fileExt = processedVideo.name.split('.').pop() || 'mp4';
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const fileName = `processed/${contentId}-${timestamp}-${randomId}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('content-media')
        .upload(fileName, processedVideo, {
          cacheControl: '3600',
          upsert: false,
          contentType: processedVideo.type,
        });
      
      if (uploadError) {
        throw uploadError;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('content-media')
        .getPublicUrl(fileName);
      
      console.log('📤 Uploaded processed video:', {
        fileName,
        processedUrl: urlData.publicUrl,
        fileSize: `${(processedVideo.size / (1024 * 1024)).toFixed(1)}MB`
      });
      
      // Update content with processed video AND branding settings (logo, website, position)
      // This ensures the VideoPlayer component shows the logo/website overlay
      const updateData: any = {
        media_url: urlData.publicUrl,
        enhanced_media_url: urlData.publicUrl,
        preprocessing_status: 'completed',
      };
      
      // IMPORTANT: Also save logo/website/position to content record so VideoPlayer shows them
      // This matches what happens when admin manually edits - VideoPlayer reads these fields
      if (logoUrl) {
        updateData.watermark_logo_url = logoUrl;
      }
      if (websiteUrl) {
        updateData.watermark_website_url = websiteUrl;
      }
      if (watermarkPosition) {
        updateData.watermark_position = watermarkPosition;
      }
      
      console.log('💾 Updating content with processed video and branding:', {
        processedUrl: urlData.publicUrl,
        logoUrl: logoUrl || 'not set',
        websiteUrl: websiteUrl || 'not set',
        position: watermarkPosition,
        note: 'VideoPlayer will show logo/website overlay from these fields'
      });
      
      const { error: updateError } = await supabase
        .from('content')
        .update(updateData)
        .eq('id', contentId);
      
      if (updateError) {
        console.error('❌ Error updating content with processed video:', updateError);
        throw updateError;
      }
      
      console.log('✅ Content updated with processed video URL and branding settings');
      
      // Update local state with processed video AND branding settings
      setContents(prev => prev.map(c => 
        c.id === contentId 
          ? { 
              ...c, 
              media_url: urlData.publicUrl,
              enhanced_media_url: urlData.publicUrl,
              preprocessing_status: 'completed',
              // Also update branding fields so VideoPlayer shows logo/website overlay
              watermark_logo_url: logoUrl || c.watermark_logo_url,
              watermark_website_url: websiteUrl || c.watermark_website_url,
              watermark_position: watermarkPosition || c.watermark_position,
            }
          : c
      ));
      
      toast({
        title: 'Logo Added Successfully',
        description: 'Your video has been processed with logo and is ready for review!',
      });
      
      console.log('✅✅✅ Video processed with logo successfully:', {
        contentId,
        originalUrl: videoUrl,
        processedUrl: urlData.publicUrl,
        logoPosition: brandingSettings?.watermark_position || 'bottom-right',
        note: 'Refresh the page to see the video with logo!'
      });
    } catch (error: any) {
      console.error('❌ Error processing video with logo:', error);
      await supabase
        .from('content')
        .update({ preprocessing_status: 'failed' })
        .eq('id', contentId);
      
      setContents(prev => prev.map(c => 
        c.id === contentId 
          ? { ...c, preprocessing_status: 'failed' }
          : c
      ));
      
      toast({
        title: 'Logo Processing Failed',
        description: 'Video uploaded but logo processing failed. Video will be available without logo.',
        variant: 'destructive',
      });
    }
  };

  const updateContent = async (id: string, data: Partial<ContentItem>) => {
    try {
      const { data: updated, error } = await supabase
        .from('content')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setContents(prev => prev.map(c => c.id === id ? updated : c));
      return updated;
    } catch (error: any) {
      console.error('Error updating content:', error);
      toast({
        title: 'Error',
        description: error.message,
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
    watermarkWebsiteUrl?: string,
    watermarkPosition?: string,
    textOverlays?: any[]
  ) => {
    const result = await updateContent(id, {
      admin_description: adminDescription,
      admin_notes: adminNotes,
      watermark_logo_url: watermarkLogoUrl || null,
      watermark_website_url: watermarkWebsiteUrl || null,
      watermark_position: watermarkPosition || null,
      video_text_overlays: textOverlays && textOverlays.length > 0 ? textOverlays : null,
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
    // When approving content, automatically add logo and website from settings
    if (status === 'approved') {
      const content = contents.find(c => c.id === id);
      
      // Always check branding settings when approving (for both images and videos)
      const { data: brandingSettings } = await supabase
        .from('branding_settings')
        .select('watermark_enabled, company_logo_url, company_website_url, watermark_position')
        .maybeSingle();
      
      const watermarkEnabled = brandingSettings?.watermark_enabled !== false;
      
      // IMPORTANT: Save logo/website/position to content record IMMEDIATELY
      // ALWAYS use branding settings from Settings page (they're the source of truth)
      const logoUrl = brandingSettings?.company_logo_url || null;
      const websiteUrl = brandingSettings?.company_website_url || null;
      const watermarkPosition = brandingSettings?.watermark_position || 'bottom-right';
      
      // For both images and videos: save branding settings during approval
      if (content && content.media_url) {
        
        console.log('🔍 Reading branding settings from Settings page:', {
          fromBrandingSettings: {
            logoUrl: brandingSettings?.company_logo_url || 'not set',
            websiteUrl: brandingSettings?.company_website_url || 'not set',
            position: brandingSettings?.watermark_position || 'not set',
          },
          fromContent: {
            logoUrl: content.watermark_logo_url || 'not set',
            websiteUrl: content.watermark_website_url || 'not set',
            position: content.watermark_position || 'not set',
          },
          willUse: {
            logoUrl: logoUrl || 'not set',
            websiteUrl: websiteUrl || 'not set',
            position: watermarkPosition,
          }
        });
        
        // Update content with branding settings and status in one update
        const updateData: any = { status: 'approved' };
        if (logoUrl) updateData.watermark_logo_url = logoUrl;
        if (websiteUrl) updateData.watermark_website_url = websiteUrl;
        updateData.watermark_position = watermarkPosition;
        
        console.log('💾 Saving branding settings and approving content:', {
          logoUrl: logoUrl || 'not set',
          websiteUrl: websiteUrl || 'not set',
          position: watermarkPosition,
          note: 'Logo/website will be shown in VideoPlayer/ImageViewer'
        });
        
        const result = await updateContent(id, updateData);
        
        if (result) {
          // Update local state immediately so UI updates right away
          setContents(prev => prev.map(c => 
            c.id === id 
              ? { 
                  ...c, 
                  status: 'approved',
                  watermark_logo_url: logoUrl || c.watermark_logo_url,
                  watermark_website_url: websiteUrl || c.watermark_website_url,
                  watermark_position: watermarkPosition,
                }
              : c
          ));
          
          // Process video with logo if watermark is enabled
          if (content.media_type === 'video' && watermarkEnabled) {
            console.log('🎬 Approving video - automatically processing with logo and website:', {
              contentId: id,
              watermarkEnabled: true,
              logoUrl: logoUrl || 'will use public folder',
              websiteUrl: websiteUrl || 'not set',
              position: watermarkPosition,
              note: 'Logo will be embedded in video file automatically'
            });
            
            toast({
              title: 'Content Approved',
              description: 'Video approved. Logo and website are being added automatically...',
            });
            
            // Process video with logo in background (async, doesn't block approval)
            processVideoWithLogo(id, content.media_url, content.platform).catch(error => {
              console.error('❌ Error processing video with logo during approval:', error);
              toast({
                title: 'Logo Processing Error',
                description: 'Video approved but logo processing failed. Check console for details.',
                variant: 'destructive',
              });
            });
          } else if (content.media_type === 'image') {
            // For images: branding settings are saved, ImageViewer will show overlay
            console.log('🖼️ Approving image - branding settings saved, ImageViewer will show logo/website overlay');
            toast({
              title: 'Content Approved',
              description: 'Image approved. Logo and website overlay will be shown.',
            });
          } else {
            toast({
              title: 'Content Approved',
              description: 'Content approved successfully.',
            });
          }
        }
        return result;
      } else {
        // No media, just update status normally
        const result = await updateContent(id, { status });
        if (result) {
          toast({
            title: 'Status Updated',
            description: `Content moved to ${status}`,
          });
        }
        return result;
      }
    } else {
      // Not approving, just update status normally
      const result = await updateContent(id, { status });
      if (result) {
        toast({
          title: 'Status Updated',
          description: `Content moved to ${status}`,
        });
      }
      return result;
    }
  };

  const deleteContent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('content')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setContents(prev => prev.filter(c => c.id !== id));
      toast({
        title: 'Content Deleted',
        description: 'The content has been removed.',
        variant: 'destructive',
      });
    } catch (error: any) {
      console.error('Error deleting content:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const enhanceMedia = async (contentId: string, imageUrl: string) => {
    try {
      toast({
        title: 'Enhancing Media',
        description: 'AI is processing your image...',
      });

      const { data, error } = await supabase.functions.invoke('enhance-media', {
        body: { imageUrl }
      });

      if (error) throw error;

      if (data?.enhancedImageUrl) {
        await updateContent(contentId, { enhanced_media_url: data.enhancedImageUrl });
        toast({
          title: 'Enhancement Complete',
          description: 'Your media has been enhanced with AI!',
        });
        return data.enhancedImageUrl;
      }
      return null;
    } catch (error: any) {
      console.error('Error enhancing media:', error);
      toast({
        title: 'Enhancement Failed',
        description: error.message,
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

      console.log('📤 Calling publish-social function with contentId:', contentId);
      
      const { data, error } = await supabase.functions.invoke('publish-social', {
        body: { contentId }
      });

      console.log('📥 Response from publish-social:', { data, error });

      // If Supabase client reports an error, check if we got data anyway
      if (error) {
        console.error('❌ Supabase invoke error:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        console.error('❌ Error message:', error.message);
        console.error('❌ Error context:', error.context);
        
        // Sometimes the function returns data even with an error object
        if (data) {
          console.log('⚠️ Got data despite error, using data:', data);
          // Continue processing with data if available - don't throw
        } else {
          // Check if it's a non-2xx error - this might still have useful data
          // The function should always return 200, so if we get here, something is wrong
          const errorMsg = error.message || 'Failed to invoke publish-social function';
          
          // If error message contains "non-2xx", the function might have crashed
          if (errorMsg.includes('non-2xx') || errorMsg.includes('EarlyDrop')) {
            throw new Error('Function crashed or returned error status. Check Supabase Dashboard → Edge Functions → Logs for details.');
          }
          
          throw new Error(errorMsg);
        }
      }

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
        const errorMsg = data?.error || 'Could not publish to social media';
        console.error('❌ Publishing failed:', errorMsg);
        toast({
          title: 'Publish Failed',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('❌ Error publishing content:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
      toast({
        title: 'Publish Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const publishContent = async (contentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('publish-content', {
        body: { contentId, manual: true }
      });

      if (error) throw error;

      if (data?.success) {
        setContents(prev => prev.map(c => 
          c.id === contentId 
            ? { ...c, status: 'published', published_at: new Date().toISOString() }
            : c
        ));
        toast({
          title: 'Published!',
          description: 'Your content has been published successfully.',
        });
      }
    } catch (error: any) {
      console.error('Error publishing content:', error);
      toast({
        title: 'Publish Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const fetchAnalytics = async (contentId: string, silent: boolean = false) => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-analytics', {
        body: { contentId }
      });

      if (error) {
        console.error('Error invoking fetch-analytics:', error);
        // Only show toast if not silent (user-initiated action)
        if (!silent) {
          // Check if it's a function not found error
          if (error.message?.includes('not found') || error.message?.includes('non-2xx')) {
            toast({
              title: "Analytics unavailable",
              description: "The analytics function is not available. Please check if it's deployed in Supabase.",
              variant: 'default',
            });
          } else {
            toast({
              title: "Failed to fetch analytics",
              description: error.message || "An error occurred while fetching analytics. Please check your API keys in Supabase Secrets.",
              variant: 'destructive',
            });
          }
        }
        return null;
      }

      if (data?.success) {
        // Update local state immediately for better UX
        setContents(prev => prev.map(c => 
          c.id === contentId 
            ? { 
                ...c, 
                likes_count: data.analytics.likes,
                comments_count: data.analytics.comments,
                shares_count: data.analytics.shares,
                reach_count: data.analytics.reach,
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
            ? `Likes: ${data.analytics.likes}, Comments: ${data.analytics.comments}, Views: ${data.analytics.reach}`
            : `Likes: ${data.analytics.likes}, Comments: ${data.analytics.comments}, Shares: ${data.analytics.shares}`;
          
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
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      // Only show toast if not silent
      if (!silent) {
        // Check if it's a function not found or network error
        if (error?.message?.includes('not found') || error?.message?.includes('non-2xx') || error?.message?.includes('Failed to fetch')) {
          // Don't show error for auto-fetch failures - these are expected if function isn't deployed
          return null;
        }
        toast({
          title: "Failed to fetch analytics",
          description: error?.message || "An unexpected error occurred. Please check the console for details.",
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
    publishContent,
    publishToSocial,
    fetchAnalytics,
    refetch: fetchContents,
  };
}
