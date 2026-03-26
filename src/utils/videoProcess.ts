import { applyVideoSharpening, DEFAULT_SHARPENING_CONFIG, type VideoSharpeningConfig } from './videoSharpen';

// Platform-specific video dimensions and constraints
export const PLATFORM_VIDEO_DIMENSIONS: Record<string, { 
  width: number; 
  height: number; 
  aspectRatio: number;
  maxLength: number; // Maximum length in seconds
  maxFileSize: number; // Maximum file size in MB
  bitrate: number; // Target bitrate in kbps
}> = {
  instagram: {
    width: 1080,
    height: 1080,
    aspectRatio: 1.0, // Square (can also be 1080x1350 portrait or 1080x566 landscape)
    maxLength: 60, // 60 seconds for feed posts
    maxFileSize: 100, // 100MB
    bitrate: 3500, // 3.5 Mbps for good quality
  },
  facebook: {
    width: 1280,
    height: 720,
    aspectRatio: 16/9, // 16:9 format
    maxLength: 240, // 4 minutes
    maxFileSize: 1000, // 1GB
    bitrate: 4000, // 4 Mbps
  },
  twitter: {
    width: 1280,
    height: 720,
    aspectRatio: 16/9, // 16:9 format
    maxLength: 140, // 2 minutes 20 seconds
    maxFileSize: 512, // 512MB
    bitrate: 5000, // 5 Mbps for Twitter's quality standards
  },
  linkedin: {
    width: 1280,
    height: 720,
    aspectRatio: 16/9, // 16:9 format
    maxLength: 600, // 10 minutes
    maxFileSize: 200, // 200MB
    bitrate: 4000, // 4 Mbps
  },
  youtube: {
    width: 1920,
    height: 1080,
    aspectRatio: 16/9,
    maxLength: 43200, // 12 hours
    maxFileSize: 128000, // 128GB
    bitrate: 8000, // 8 Mbps target
  },
};

// Get video metadata (duration, dimensions, etc.)
export async function getVideoMetadata(videoFile: File): Promise<{
  duration: number;
  width: number;
  height: number;
  aspectRatio: number;
  fileSize: number;
  bitrate: number;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(videoFile);
    
    video.onloadedmetadata = () => {
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      const aspectRatio = width / height;
      const fileSize = videoFile.size;
      const bitrate = (fileSize * 8) / duration / 1000; // kbps
      
      URL.revokeObjectURL(url);
      
      resolve({
        duration,
        width,
        height,
        aspectRatio,
        fileSize,
        bitrate,
      });
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video metadata'));
    };
    
    video.src = url;
    video.load();
  });
}

// Check if video needs processing
export function videoNeedsProcessing(
  metadata: { duration: number; width: number; height: number; fileSize: number; bitrate: number },
  platform: string
): {
  needsResize: boolean;
  needsTrim: boolean;
  needsCompression: boolean;
  reasons: string[];
} {
  const platformSpecs = PLATFORM_VIDEO_DIMENSIONS[platform] || PLATFORM_VIDEO_DIMENSIONS.instagram;
  const reasons: string[] = [];
  let needsResize = false;
  let needsTrim = false;
  let needsCompression = false;
  
  // Check dimensions
  const currentAspectRatio = metadata.width / metadata.height;
  const aspectRatioDiff = Math.abs(currentAspectRatio - platformSpecs.aspectRatio);
  
  if (metadata.width !== platformSpecs.width || 
      metadata.height !== platformSpecs.height ||
      aspectRatioDiff > 0.1) {
    needsResize = true;
    reasons.push(`Dimensions ${metadata.width}x${metadata.height} need to be ${platformSpecs.width}x${platformSpecs.height}`);
  }
  
  // Check duration
  if (metadata.duration > platformSpecs.maxLength) {
    needsTrim = true;
    reasons.push(`Video length ${metadata.duration.toFixed(1)}s exceeds ${platformSpecs.maxLength}s limit`);
  }
  
  // Check file size
  const fileSizeMB = metadata.fileSize / (1024 * 1024);
  if (fileSizeMB > platformSpecs.maxFileSize) {
    needsCompression = true;
    reasons.push(`File size ${fileSizeMB.toFixed(1)}MB exceeds ${platformSpecs.maxFileSize}MB limit`);
  }
  
  // Check bitrate (if too high, compress)
  if (metadata.bitrate > platformSpecs.bitrate * 1.5) {
    needsCompression = true;
    reasons.push(`Bitrate ${metadata.bitrate.toFixed(0)}kbps is higher than optimal ${platformSpecs.bitrate}kbps`);
  }
  
  return { needsResize, needsTrim, needsCompression, reasons };
}

// Load logo image for watermarking - Uses branding settings URL FIRST, then public folder
// Priority: 1. Branding settings URL (from Settings page), 2. Public folder (fallback)
async function loadLogoImage(logoUrl?: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    // FIRST: Try branding settings URL if provided (from Settings page upload)
    if (logoUrl) {
      console.log('🔍 Trying logo from branding settings URL:', logoUrl);
      const urlImg = new Image();
      urlImg.crossOrigin = 'anonymous';
      urlImg.onload = () => {
        console.log('✅ Logo loaded successfully from branding settings URL:', logoUrl);
        console.log(`   Logo dimensions: ${urlImg.width}x${urlImg.height}px`);
        resolve(urlImg);
      };
      urlImg.onerror = () => {
        console.warn('⚠️ Failed to load logo from branding settings URL, trying public folder...');
        // Fall back to public folder
        tryPublicFolderLogos();
      };
      urlImg.src = logoUrl;
      return; // Exit early if URL logo loads
    }
    
    // FALLBACK: Try public folder logos if no URL provided or URL failed
    const tryPublicFolderLogos = () => {
      const possibleLogoPaths = [
        '/Screenshot 2026-01-15 at 10.58.35 PM.png',   // User's logo
        '/logo.png',                                    // Standard name
        '/logo.jpg',
        '/logo.jpeg',
        '/screenshot.png',
        '/tatva-ops-logo.png'
      ];
      
      let currentIndex = 0;
      
      const tryNextLogo = () => {
        if (currentIndex >= possibleLogoPaths.length) {
          console.warn('⚠️ Logo not found in public folder. Tried:', possibleLogoPaths.join(', '));
          console.warn('   Your logo file should be in: public/Screenshot 2026-01-15 at 10.58.35 PM.png');
          console.warn('   Or upload it in Settings → Media Branding & Watermark');
          resolve(null);
          return;
        }
        
        const img = new Image();
        const currentPath = possibleLogoPaths[currentIndex];
        
        img.onload = () => {
          console.log(`✅ Logo loaded successfully from public folder: ${currentPath}`);
          console.log(`   Logo dimensions: ${img.width}x${img.height}px`);
          resolve(img);
        };
        
        img.onerror = () => {
          console.warn(`⚠️ Failed to load logo from: ${currentPath}`);
          currentIndex++;
          tryNextLogo();
        };
        
        img.src = encodeURI(currentPath);
      };
      
      tryNextLogo();
    };
    
    // Start with public folder if no URL provided
    if (!logoUrl) {
      tryPublicFolderLogos();
    }
  });
}

// Get branding settings
async function getBrandingSettings(): Promise<{
  company_logo_url: string | null;
  watermark_enabled: boolean;
  watermark_position: string;
  company_name: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_website_url: string | null;
  end_card_enabled: boolean;
  end_card_duration: number;
} | null> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase
      .from('branding_settings')
      .select('company_logo_url, watermark_enabled, watermark_position, company_name, company_address, company_phone, company_email, company_website_url, end_card_enabled, end_card_duration')
      .maybeSingle();
    
    if (error) {
      console.error('❌ Error fetching branding settings:', error);
      console.error('   Error details:', {
        code: error.code,
        message: error.message,
        hint: error.hint,
        note: 'Make sure the database migration has been run to add company info fields'
      });
      return null;
    }
    
    if (!data) {
      console.warn('⚠️ No branding settings found in database');
      console.warn('   Create branding settings in Settings page first');
      return null;
    }
    
    // Log what we got to verify data is correct
    console.log('✅ Branding settings fetched successfully:', {
      hasCompanyName: !!data.company_name,
      hasCompanyAddress: !!data.company_address,
      hasCompanyPhone: !!data.company_phone,
      hasCompanyEmail: !!data.company_email,
      hasCompanyWebsite: !!data.company_website_url,
      endCardEnabled: data.end_card_enabled ?? true,
      endCardDuration: data.end_card_duration || 5,
    });
    
    return data;
  } catch (error) {
    console.error('❌ Error importing supabase client:', error);
    return null;
  }
}

// Calculate logo position on canvas
function getLogoPosition(
  canvasWidth: number,
  canvasHeight: number,
  logoWidth: number,
  logoHeight: number,
  position: string
): { x: number; y: number } {
  const padding = 20;
  
  switch (position) {
    case 'top-left':
      return { x: padding, y: padding };
    case 'top-right':
      return { x: canvasWidth - logoWidth - padding, y: padding };
    case 'bottom-left':
      return { x: padding, y: canvasHeight - logoHeight - padding };
    case 'bottom-right':
    default:
      return { x: canvasWidth - logoWidth - padding, y: canvasHeight - logoHeight - padding };
  }
}

// Process video for platform - ACTUAL PROCESSING (resize, trim, compress with quality preservation + sharpening)
export async function processVideoForPlatform(
  videoFile: File,
  platform: string = 'instagram',
  onProgress?: (progress: number) => void,
  sharpeningConfig?: VideoSharpeningConfig,
  logoUrl?: string // Optional: Logo URL from settings (will be used first, then public folder)
): Promise<File> {
  return new Promise((resolve, reject) => {
    const platformSpecs = PLATFORM_VIDEO_DIMENSIONS[platform] || PLATFORM_VIDEO_DIMENSIONS.instagram;
    const targetWidth = platformSpecs.width;
    const targetHeight = platformSpecs.height;
    const maxLength = platformSpecs.maxLength;
    const targetBitrate = platformSpecs.bitrate;
    
    const video = document.createElement('video');
    video.muted = true; // Mute for processing
    video.playsInline = true;
    const url = URL.createObjectURL(videoFile);
    
    video.onloadedmetadata = async () => {
      try {
        const originalWidth = video.videoWidth;
        const originalHeight = video.videoHeight;
        const originalDuration = video.duration;
        const originalAspectRatio = originalWidth / originalHeight;
        const targetAspectRatio = targetWidth / targetHeight;
        
        // Calculate dimensions to fit within target while maintaining aspect ratio (FIT mode, not CROP)
        // This preserves the entire video without cutting off any content
        let fitWidth = targetWidth;
        let fitHeight = targetHeight;
        let offsetX = 0;
        let offsetY = 0;
        
        if (originalAspectRatio > targetAspectRatio) {
          // Video is wider than target - fit to width, add letterboxing (black bars top/bottom)
          fitHeight = targetWidth / originalAspectRatio;
          offsetY = (targetHeight - fitHeight) / 2;
        } else {
          // Video is taller than target - fit to height, add pillarboxing (black bars left/right)
          fitWidth = targetHeight * originalAspectRatio;
          offsetX = (targetWidth - fitWidth) / 2;
        }
        
        // No cropping needed - we'll fit the entire video
        const cropWidth = originalWidth;
        const cropHeight = originalHeight;
        const cropX = 0;
        const cropY = 0;
        
        // Determine if we need to trim
        const needsTrim = originalDuration > maxLength;
        const finalDuration = needsTrim ? maxLength : originalDuration;
        
        // LOAD LOGO - Priority: 1. Provided logoUrl, 2. Branding settings URL, 3. Public folder
        console.log('🔍 Loading branding settings and logo for video watermarking...');
        const brandingSettings = await getBrandingSettings();
        
        // CRITICAL: Log all branding settings to verify they're being fetched
        console.log('📋 Branding Settings Fetched:', {
          hasSettings: !!brandingSettings,
          company_name: brandingSettings?.company_name || 'NOT SET',
          company_address: brandingSettings?.company_address || 'NOT SET',
          company_phone: brandingSettings?.company_phone || 'NOT SET',
          company_email: brandingSettings?.company_email || 'NOT SET',
          company_website_url: brandingSettings?.company_website_url || 'NOT SET',
          end_card_enabled: brandingSettings?.end_card_enabled ?? true,
          end_card_duration: brandingSettings?.end_card_duration || 5,
          company_logo_url: brandingSettings?.company_logo_url || 'NOT SET',
        });
        
        // Use provided logoUrl first (from settings), then branding settings, then public folder
        const logoUrlToUse = logoUrl || brandingSettings?.company_logo_url || undefined;
        console.log('Logo source priority:', {
          providedLogoUrl: logoUrl ? 'present' : 'not provided',
          brandingSettingsUrl: brandingSettings?.company_logo_url ? 'present' : 'not set',
          willUse: logoUrlToUse ? 'settings URL' : 'public folder',
          logoUrl: logoUrlToUse || 'will try public folder'
        });
        
        // Load logo (tries settings URL first, then public folder)
        const logoImage = await loadLogoImage(logoUrlToUse);
        const watermarkPosition = brandingSettings?.watermark_position || 'bottom-right';
        const endCardEnabled = brandingSettings?.end_card_enabled ?? true;
        const endCardDuration = brandingSettings?.end_card_duration || 5;
        const hasCompanyInfo = !!(brandingSettings?.company_name || brandingSettings?.company_address || 
                                  brandingSettings?.company_phone || brandingSettings?.company_email || 
                                  brandingSettings?.company_website_url);
        // End card should ALWAYS show if enabled, regardless of content
        // This allows users to add a blank end card or one with just logo
        const shouldShowEndCard = endCardEnabled;
        
        // Log if end card is enabled but no content (informational only)
        if (endCardEnabled && !logoImage && !hasCompanyInfo) {
          console.log('ℹ️ End card is enabled - will show blank end card for', endCardDuration, 'seconds');
          console.log('   Add company information in Settings → Video End Card to display content');
        }
        
        // IMPORTANT: End card appears AFTER the video finishes
        // Video duration: 0 to finalDuration (e.g., 0-30 seconds)
        // End card duration: finalDuration to finalDuration + endCardDuration (e.g., 30-35 seconds)
        const totalDuration = finalDuration + (shouldShowEndCard ? endCardDuration : 0);
        
        // CRITICAL: Calculate frame rate FIRST (needed for frame calculations)
        // Configure sharpening (use provided config or default)
        const sharpConfig = sharpeningConfig || DEFAULT_SHARPENING_CONFIG;
        
        // Use lower frame rate if sharpening is disabled (faster processing for logo-only)
        const frameRate = (!sharpConfig.enabled || sharpConfig.strength <= 0) ? 15 : 30;
        
        // CRITICAL: Calculate frame counts BEFORE using them in logs
        const videoFrames = Math.ceil(finalDuration * frameRate);
        const endCardFrames = shouldShowEndCard ? Math.ceil(endCardDuration * frameRate) : 0;
        const totalFrames = videoFrames + endCardFrames;
        
        // CRITICAL VERIFICATION: Log the exact durations and company info
        console.log('⏱️ Duration Calculation:', {
          originalDuration: originalDuration.toFixed(2),
          finalDuration: finalDuration.toFixed(2),
          endCardEnabled: endCardEnabled,
          endCardDuration: endCardDuration,
          shouldShowEndCard: shouldShowEndCard,
          totalDuration: totalDuration.toFixed(2),
          extension: shouldShowEndCard ? `+${endCardDuration}s end card` : 'no extension',
          note: shouldShowEndCard 
            ? `Video will be ${totalDuration.toFixed(1)}s (${finalDuration.toFixed(1)}s video + ${endCardDuration}s end card)`
            : 'Video will be original length only'
        });
        
        // VERIFY COMPANY INFORMATION IS AVAILABLE
        console.log('📝 VERIFYING COMPANY INFORMATION FOR END CARD:', {
          companyName: brandingSettings?.company_name || '❌ NOT SET',
          companyAddress: brandingSettings?.company_address || '❌ NOT SET',
          companyPhone: brandingSettings?.company_phone || '❌ NOT SET',
          companyEmail: brandingSettings?.company_email || '❌ NOT SET',
          companyWebsite: brandingSettings?.company_website_url || '❌ NOT SET',
          hasAnyInfo: hasCompanyInfo,
          willShow: shouldShowEndCard,
          note: hasCompanyInfo 
            ? '✅ Company information found - will be displayed on end card'
            : '⚠️ No company information found - end card will be blank or show placeholder'
        });
        
        console.log('📹 Video timeline:', {
          videoDuration: `${finalDuration.toFixed(1)}s (actual video content)`,
          endCardDuration: shouldShowEndCard ? `${endCardDuration}s (end card AFTER video)` : 'disabled',
          totalDuration: `${totalDuration.toFixed(1)}s (video + end card)`,
          videoFrames: videoFrames,
          endCardFrames: endCardFrames,
          totalFrames: totalFrames,
          frameRate: frameRate,
          endCardEnabled: endCardEnabled,
          hasLogo: !!logoImage,
          hasCompanyInfo: hasCompanyInfo,
          note: shouldShowEndCard 
            ? `End card will appear for ${endCardDuration}s after video finishes (${endCardFrames} frames)` 
            : 'End card is disabled'
        });
        
        // CRITICAL: Log logo loading status - this determines if logo will be in video
        if (logoImage) {
          console.log('✅ Logo loaded successfully - WILL BE EMBEDDED in video file:', {
            source: logoUrlToUse ? 'branding settings URL' : 'public folder',
            logoUrl: logoUrlToUse || 'public/Screenshot 2026-01-15 at 10.58.35 PM.png',
            position: watermarkPosition,
            logoSize: `${logoImage.width}x${logoImage.height}px`,
            note: 'Logo will be embedded in video - appears throughout video + on end card'
          });
        } else {
          console.warn('⚠️ Logo NOT FOUND - video will be processed WITHOUT logo watermark');
          console.warn('   Tried logoUrl:', logoUrlToUse || 'none');
          console.warn('   Expected location: public/Screenshot 2026-01-15 at 10.58.35 PM.png');
          console.warn('   Or upload logo in Settings → Media Branding & Watermark');
        }
        
        // Log end card status
        console.log('📋 End Card Configuration:', {
          enabled: endCardEnabled,
          duration: `${endCardDuration}s`,
          hasLogo: !!logoImage,
          hasCompanyInfo: hasCompanyInfo,
          companyName: brandingSettings?.company_name || 'not set',
          companyAddress: brandingSettings?.company_address || 'not set',
          companyPhone: brandingSettings?.company_phone || 'not set',
          companyEmail: brandingSettings?.company_email || 'not set',
          willShowEndCard: shouldShowEndCard,
          note: shouldShowEndCard 
            ? `End card will show for ${endCardDuration}s after video finishes` 
            : 'End card disabled or no content to show'
        });
        
        // Calculate quality settings to maintain clarity
        // Use target bitrate but ensure minimum quality
        const videoBitrate = Math.max(targetBitrate * 1000, 2000000); // Minimum 2Mbps for quality
        
        onProgress?.(5);
        
        // Create canvas for video processing with high quality settings
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d', {
          willReadFrequently: false,
          alpha: false,
          desynchronized: false, // Better quality
        });
        
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Use highest quality rendering settings
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Try different codecs in order of preference (best quality first)
        const codecOptions = [
          { mimeType: 'video/webm;codecs=vp9', label: 'VP9' },
          { mimeType: 'video/webm;codecs=vp8', label: 'VP8' },
          { mimeType: 'video/webm', label: 'WebM' },
          { mimeType: 'video/mp4', label: 'MP4' },
        ];
        
        let selectedCodec = codecOptions[0];
        for (const codec of codecOptions) {
          if (MediaRecorder.isTypeSupported(codec.mimeType)) {
            selectedCodec = codec;
            break;
          }
        }
        
        console.log('Using video codec:', selectedCodec.label);
        
        // Set up MediaRecorder with optimal settings for quality
        // Use the frameRate calculated earlier (already accounts for sharpening)
        const captureFrameRate = frameRate;
        const stream = canvas.captureStream(captureFrameRate);
        const videoTrack = stream.getVideoTracks()[0];
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: selectedCodec.mimeType,
          videoBitsPerSecond: videoBitrate,
        });
        
        const chunks: Blob[] = [];
        let recordingStarted = false;
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          if (chunks.length === 0) {
            URL.revokeObjectURL(url);
            reject(new Error('No video data recorded'));
            return;
          }
          
          const processedBlob = new Blob(chunks, { type: selectedCodec.mimeType });
          const fileExtension = selectedCodec.mimeType.includes('mp4') ? 'mp4' : 'webm';
          const processedFile = new File(
            [processedBlob],
            videoFile.name.replace(/\.[^/.]+$/, `.${fileExtension}`),
            {
              type: selectedCodec.mimeType,
              lastModified: Date.now(),
            }
          );
          
          URL.revokeObjectURL(url);
          onProgress?.(100);
          
          const logoStatus = logoImage 
            ? `✅ EMBEDDED (${logoImage.width}x${logoImage.height}px logo at ${watermarkPosition})` 
            : '❌ NOT FOUND - Video processed WITHOUT logo!';
          
          const endCardStatus = shouldShowEndCard 
            ? `✅ End card enabled (${endCardDuration}s with company info)` 
            : 'End card disabled';
          
          // CRITICAL: Verify end card was processed
          const endCardFramesProcessed = Math.max(0, frameCount - videoFrames);
          const endCardWasProcessed = endCardFramesProcessed >= endCardFrames * 0.9; // Allow 10% tolerance
          
          console.log('✅✅✅ Video processing COMPLETED:', {
            originalSize: `${(videoFile.size / (1024 * 1024)).toFixed(1)}MB`,
            processedSize: `${(processedFile.size / (1024 * 1024)).toFixed(1)}MB`,
            dimensions: `${targetWidth}x${targetHeight}`,
            duration: `${totalDuration.toFixed(1)}s total (${finalDuration.toFixed(1)}s video content${shouldShowEndCard ? ` + ${endCardDuration}s company info end card AFTER video` : ''})`,
            codec: selectedCodec.label,
            watermark: logoStatus,
            endCard: endCardStatus,
            endCardFramesProcessed: endCardFramesProcessed,
            endCardExpected: endCardFrames,
            endCardComplete: endCardWasProcessed,
            logoPosition: logoImage ? watermarkPosition : 'N/A',
            framesProcessed: frameCount,
            totalFramesExpected: totalFrames,
            sharpening: sharpConfig.enabled ? `Enabled (strength: ${sharpConfig.strength})` : 'Disabled',
            note: shouldShowEndCard && endCardWasProcessed
              ? '✅✅✅ End card with company info is PERMANENTLY EMBEDDED in video file!'
              : shouldShowEndCard
                ? '⚠️⚠️⚠️ WARNING: End card may be incomplete - check frame counts above!'
                : 'End card disabled'
          });
          
          if (!logoImage && endCardEnabled) {
            console.warn('⚠️ End card enabled but no logo found - end card will show company info only');
          }
          
          if (shouldShowEndCard && !endCardWasProcessed) {
            console.error('❌❌❌ CRITICAL: End card frames were not fully processed!');
            console.error(`   Expected: ${endCardFrames} frames, Processed: ${endCardFramesProcessed} frames`);
            console.error('   The end card may be missing or incomplete in the final video');
          }
          
          resolve(processedFile);
        };
        
        mediaRecorder.onerror = (event: any) => {
          URL.revokeObjectURL(url);
          reject(new Error(`MediaRecorder error: ${event.error?.message || 'Unknown error'}`));
        };
        
        // Process video frame by frame with proper timing
        let currentTime = 0;
        const frameInterval = 1 / frameRate;
        let frameCount = 0;
        // Note: videoFrames, endCardFrames, and totalFrames are already calculated above
        let isProcessing = false;
        
        // Calculate logo size (10% of canvas width, maintain aspect ratio)
        const logoMaxWidth = targetWidth * 0.15;
        const logoMaxHeight = targetHeight * 0.15;
        let logoDisplayWidth = 0;
        let logoDisplayHeight = 0;
        let logoPos = { x: 0, y: 0 };
        
        if (logoImage) {
          const logoAspectRatio = logoImage.width / logoImage.height;
          if (logoAspectRatio > 1) {
            // Logo is wider
            logoDisplayWidth = Math.min(logoMaxWidth, logoImage.width);
            logoDisplayHeight = logoDisplayWidth / logoAspectRatio;
          } else {
            // Logo is taller
            logoDisplayHeight = Math.min(logoMaxHeight, logoImage.height);
            logoDisplayWidth = logoDisplayHeight * logoAspectRatio;
          }
          logoPos = getLogoPosition(targetWidth, targetHeight, logoDisplayWidth, logoDisplayHeight, watermarkPosition);
        }
        
        const drawLogo = () => {
          if (!logoImage) return;
          
          // Draw logo with semi-transparent background for better visibility
          ctx.save();
          // Background for logo visibility (optional - can be removed if logo has its own background)
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // Lighter background for better logo visibility
          const logoPadding = 8;
          ctx.fillRect(
            logoPos.x - logoPadding,
            logoPos.y - logoPadding,
            logoDisplayWidth + logoPadding * 2,
            logoDisplayHeight + logoPadding * 2
          );
          // Draw logo with full opacity
          ctx.globalAlpha = 1.0;
          ctx.drawImage(logoImage, logoPos.x, logoPos.y, logoDisplayWidth, logoDisplayHeight);
          ctx.restore();
        };
        
        const processNextFrame = () => {
          // CRITICAL: Check if we've processed all frames including end card
          if (currentTime >= totalDuration) {
            const endCardFramesProcessed = Math.max(0, frameCount - videoFrames);
            const endCardComplete = endCardFramesProcessed >= endCardFrames;
            console.log('🏁 Finished processing all frames:', {
              currentTime: currentTime.toFixed(2),
              totalDuration: totalDuration.toFixed(2),
              frameCount: frameCount,
              totalFrames: totalFrames,
              videoFrames: videoFrames,
              endCardFrames: endCardFrames,
              endCardFramesProcessed: endCardFramesProcessed,
              endCardComplete: endCardComplete,
              shouldShowEndCard: shouldShowEndCard,
              note: endCardComplete && shouldShowEndCard
                ? '✅ All frames including end card processed successfully'
                : shouldShowEndCard
                  ? `⚠️ End card may be incomplete: processed ${endCardFramesProcessed}/${endCardFrames} frames`
                  : 'End card disabled'
            });
            if (recordingStarted) {
              // CRITICAL: Give MediaRecorder EXTRA time to capture all end card frames
              // Calculate wait time based on remaining frames and frame rate
              const remainingFrames = totalFrames - frameCount;
              const framesPerSecond = captureFrameRate;
              const timeForRemainingFrames = (remainingFrames / framesPerSecond) * 1000; // Convert to ms
              
              // For end card, wait longer to ensure all frames are captured
              // Add buffer time: end card duration + 2 seconds extra
              const endCardBufferTime = shouldShowEndCard && endCardFrames > 0 
                ? (endCardDuration * 1000) + 2000 // End card duration in ms + 2 seconds buffer
                : 0;
              
              const waitTime = shouldShowEndCard && endCardFrames > 0 
                ? Math.max(endCardBufferTime, timeForRemainingFrames + 1000) // Use whichever is longer
                : 200;
              
              console.log(`⏳⏳⏳ CRITICAL: Waiting ${waitTime.toFixed(0)}ms (${(waitTime/1000).toFixed(1)}s) before stopping MediaRecorder:`, {
                remainingFrames: remainingFrames,
                framesPerSecond: framesPerSecond,
                timeForRemainingFrames: timeForRemainingFrames.toFixed(0),
                endCardFrames: endCardFrames,
                endCardDuration: endCardDuration,
                endCardBufferTime: endCardBufferTime.toFixed(0),
                waitTime: waitTime.toFixed(0),
                note: 'CRITICAL: This ensures all end card frames are captured by MediaRecorder'
              });
              
              setTimeout(() => {
                console.log('🛑🛑🛑 Stopping MediaRecorder NOW - end card should be included in final video');
                console.log('   Final frame count:', frameCount, 'of', totalFrames);
                console.log('   End card frames processed:', Math.max(0, frameCount - videoFrames), 'of', endCardFrames);
                mediaRecorder.stop();
              }, waitTime);
            }
            return;
          }
          
          if (isProcessing) return;
          isProcessing = true;
          
          // Check if we're in the end card section (ONLY after video finishes)
          // This ensures the end card appears AFTER the complete video, not during it
          const isEndCardSection = shouldShowEndCard && currentTime >= finalDuration;
          
          // CRITICAL VERIFICATION: Log if we should be in end card but aren't
          if (shouldShowEndCard && currentTime >= finalDuration && !isEndCardSection) {
            console.error('❌❌❌ CRITICAL ERROR: Should be in end card section but isEndCardSection is false!');
            console.error('   currentTime:', currentTime, 'finalDuration:', finalDuration);
            console.error('   shouldShowEndCard:', shouldShowEndCard);
          }
          
          // Log when we enter end card section
          if (isEndCardSection && frameCount === videoFrames) {
            console.log('🎬🎬🎬 ENTERING END CARD SECTION:', {
              currentTime: currentTime.toFixed(2),
              finalDuration: finalDuration.toFixed(2),
              endCardDuration: endCardDuration,
              endCardFrames: endCardFrames,
              frameCount: frameCount,
              totalFrames: totalFrames,
              note: `Will process ${endCardFrames} end card frames`
            });
          }
          
          if (isEndCardSection) {
            // Draw end card frame with company information
            // This section runs ONLY after the video has finished (currentTime >= finalDuration)
            // CRITICAL: Clear and redraw everything to ensure MediaRecorder captures it
            ctx.clearRect(0, 0, targetWidth, targetHeight);
            
            // Force canvas update - this ensures MediaRecorder captures the frame
            // Draw a full frame to trigger the stream update
            ctx.save();
            
            // Background: gradient from dark to slightly lighter
            const gradient = ctx.createLinearGradient(0, 0, 0, targetHeight);
            gradient.addColorStop(0, '#1a1a1a');
            gradient.addColorStop(1, '#0a0a0a');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            
            // Log first frame of end card for debugging
            if (frameCount === videoFrames) {
              console.log('🎬🎬🎬 DRAWING END CARD FRAME #1:', {
                currentTime: currentTime.toFixed(2),
                finalDuration: finalDuration.toFixed(2),
                endCardDuration: endCardDuration,
                hasLogo: !!logoImage,
                hasCompanyInfo: hasCompanyInfo,
                brandingSettingsAvailable: !!brandingSettings,
                brandingSettingsObject: brandingSettings ? {
                  company_name: brandingSettings.company_name,
                  company_address: brandingSettings.company_address,
                  company_phone: brandingSettings.company_phone,
                  company_email: brandingSettings.company_email,
                  company_website_url: brandingSettings.company_website_url,
                } : 'NULL',
                companyName: brandingSettings?.company_name || 'NOT SET',
                companyAddress: brandingSettings?.company_address || 'NOT SET',
                companyPhone: brandingSettings?.company_phone || 'NOT SET',
                companyEmail: brandingSettings?.company_email || 'NOT SET',
                companyWebsite: brandingSettings?.company_website_url || 'NOT SET',
                companyNameLength: brandingSettings?.company_name?.length || 0,
                companyAddressLength: brandingSettings?.company_address?.length || 0,
                note: 'End card rendering started - VERIFY VALUES ABOVE ARE NOT EMPTY'
              });
            }
            
            // Draw logo in center-top if available
            if (logoImage) {
              const centerLogoWidth = targetWidth * 0.25;
              const centerLogoHeight = (logoImage.height / logoImage.width) * centerLogoWidth;
              const centerX = (targetWidth - centerLogoWidth) / 2;
              const logoTopY = targetHeight * 0.15;
              
              ctx.save();
              ctx.globalAlpha = 1.0;
              ctx.drawImage(logoImage, centerX, logoTopY, centerLogoWidth, centerLogoHeight);
              ctx.restore();
            }
            
            // Draw company information text
            // CRITICAL: Ensure brandingSettings is available in this scope
            if (!brandingSettings) {
              console.error('❌ CRITICAL: brandingSettings is null in end card rendering!');
              if (frameCount === videoFrames) {
                console.error('   This means the settings were not fetched properly');
              }
            }
            
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Set up text styling - make text more visible
            const textColor = '#ffffff';
            const textColorSecondary = '#e0e0e0'; // Lighter gray for better visibility
            const baseY = logoImage ? targetHeight * 0.45 : targetHeight * 0.35;
            let currentY = baseY;
            const lineSpacing = 45; // Increased spacing
            const fontSize = Math.max(32, targetWidth / 35); // Larger font size
            const fontSizeSmall = Math.max(22, targetWidth / 50); // Larger small font
            
            let hasAnyText = false;
            let textItems: string[] = []; // Track what we're drawing
            
            // Company Name (largest, bold)
            const companyNameValue = brandingSettings?.company_name;
            if (companyNameValue && typeof companyNameValue === 'string' && companyNameValue.trim()) {
              try {
                ctx.fillStyle = textColor;
                ctx.font = `bold ${fontSize + 10}px Arial, sans-serif`;
                ctx.textBaseline = 'top'; // Use top baseline for more predictable positioning
                const companyNameText = companyNameValue.trim();
                // Add stroke for better visibility
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'; // Darker stroke for better visibility
                ctx.lineWidth = 3; // Thicker stroke
                ctx.strokeText(companyNameText, targetWidth / 2, currentY);
                ctx.fillText(companyNameText, targetWidth / 2, currentY);
                currentY += lineSpacing + 15;
                hasAnyText = true;
                textItems.push(`Company Name: ${companyNameText}`);
                // Log on first frame
                if (frameCount === videoFrames) {
                  console.log('✅✅✅ Drawing company name:', {
                    text: companyNameText,
                    length: companyNameText.length,
                    y: currentY,
                    fontSize: fontSize + 10,
                    canvasWidth: targetWidth,
                    canvasHeight: targetHeight
                  });
                }
              } catch (error) {
                console.error('❌ Error drawing company name:', error);
              }
            } else if (frameCount === videoFrames) {
              console.warn('⚠️⚠️⚠️ Company name not found or empty!');
              console.warn('   brandingSettings exists:', !!brandingSettings);
              console.warn('   company_name value:', companyNameValue);
              console.warn('   company_name type:', typeof companyNameValue);
              console.warn('   company_name is string:', typeof companyNameValue === 'string');
              console.warn('   company_name trimmed:', companyNameValue?.trim?.());
            }
            
            // Company Address
            if (brandingSettings?.company_address && brandingSettings.company_address.trim()) {
              ctx.fillStyle = textColorSecondary;
              ctx.font = `${fontSizeSmall}px Arial, sans-serif`;
              ctx.textBaseline = 'top';
              const addressText = brandingSettings.company_address.trim();
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
              ctx.lineWidth = 1;
              ctx.strokeText(addressText, targetWidth / 2, currentY);
              ctx.fillText(addressText, targetWidth / 2, currentY);
              currentY += lineSpacing;
              hasAnyText = true;
              textItems.push(`Address: ${addressText}`);
              if (frameCount === videoFrames) {
                console.log('✅✅✅ Drawing company address:', addressText);
              }
            } else if (frameCount === videoFrames) {
              console.warn('⚠️ Company address not found. Value:', brandingSettings?.company_address);
            }
            
            // Company Phone
            if (brandingSettings?.company_phone && brandingSettings.company_phone.trim()) {
              ctx.fillStyle = textColorSecondary;
              ctx.font = `${fontSizeSmall}px Arial, sans-serif`;
              ctx.textBaseline = 'top';
              const phoneText = brandingSettings.company_phone.trim();
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
              ctx.lineWidth = 1;
              ctx.strokeText(phoneText, targetWidth / 2, currentY);
              ctx.fillText(phoneText, targetWidth / 2, currentY);
              currentY += lineSpacing;
              hasAnyText = true;
              textItems.push(`Phone: ${phoneText}`);
              if (frameCount === videoFrames) {
                console.log('✅✅✅ Drawing company phone:', phoneText);
              }
            } else if (frameCount === videoFrames) {
              console.warn('⚠️ Company phone not found. Value:', brandingSettings?.company_phone);
            }
            
            // Company Email
            if (brandingSettings?.company_email && brandingSettings.company_email.trim()) {
              ctx.fillStyle = textColorSecondary;
              ctx.font = `${fontSizeSmall}px Arial, sans-serif`;
              ctx.textBaseline = 'top';
              const emailText = brandingSettings.company_email.trim();
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
              ctx.lineWidth = 1;
              ctx.strokeText(emailText, targetWidth / 2, currentY);
              ctx.fillText(emailText, targetWidth / 2, currentY);
              currentY += lineSpacing;
              hasAnyText = true;
              textItems.push(`Email: ${emailText}`);
              if (frameCount === videoFrames) {
                console.log('✅✅✅ Drawing company email:', emailText);
              }
            } else if (frameCount === videoFrames) {
              console.warn('⚠️ Company email not found. Value:', brandingSettings?.company_email);
            }
            
            // Company Website
            if (brandingSettings?.company_website_url && brandingSettings.company_website_url.trim()) {
              ctx.fillStyle = textColor;
              ctx.font = `${fontSizeSmall}px Arial, sans-serif`;
              ctx.textBaseline = 'top';
              // Remove protocol for cleaner display
              const websiteDisplay = brandingSettings.company_website_url.replace(/^https?:\/\//, '').trim();
              if (websiteDisplay) {
                ctx.fillText(websiteDisplay, targetWidth / 2, currentY);
                hasAnyText = true;
                textItems.push(`Website: ${websiteDisplay}`);
                if (frameCount === videoFrames) {
                  console.log('✅ Drawing company website:', websiteDisplay);
                }
              }
            }
            
            // Log what was drawn on first frame
            if (frameCount === videoFrames) {
              if (textItems.length > 0) {
                console.log('✅✅✅ End card text items drawn:', textItems);
              } else {
                console.warn('⚠️⚠️⚠️ NO TEXT ITEMS DRAWN ON END CARD!');
                console.warn('   Branding settings available:', !!brandingSettings);
                console.warn('   Company name:', brandingSettings?.company_name || 'MISSING');
                console.warn('   Company address:', brandingSettings?.company_address || 'MISSING');
                console.warn('   Company phone:', brandingSettings?.company_phone || 'MISSING');
                console.warn('   Company email:', brandingSettings?.company_email || 'MISSING');
              }
            }
            
            // If no text or logo, show a placeholder message
            if (!hasAnyText && !logoImage) {
              ctx.fillStyle = textColorSecondary;
              ctx.font = `${fontSizeSmall}px Arial, sans-serif`;
              ctx.textBaseline = 'middle';
              ctx.fillText('Add company information in Settings', targetWidth / 2, targetHeight / 2);
            }
            
            ctx.restore();
            
            // CRITICAL: Force canvas to flush and ensure MediaRecorder captures this frame
            // Get image data and put it back to force a canvas update
            const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            ctx.putImageData(imageData, 0, 0);
            
            // CRITICAL: Ensure MediaRecorder is recording before processing end card frames
            if (!recordingStarted) {
              console.log('🎬 Starting MediaRecorder for end card frames');
              recordingStarted = true;
              mediaRecorder.start(100); // Collect data every 100ms
            }
            
            // CRITICAL: Explicitly request a frame from the stream to ensure MediaRecorder captures it
            // This is especially important for end card frames
            if (videoTrack && videoTrack.readyState === 'live') {
              try {
                videoTrack.requestFrame();
              } catch (error) {
                // Some browsers may not support requestFrame, that's okay
                console.warn('requestFrame not supported, using automatic capture:', error);
              }
            }
            
            // Update progress
            frameCount++;
            const progress = 10 + (frameCount / totalFrames) * 85;
            onProgress?.(Math.min(95, progress));
            
            // Log every 10th end card frame to verify processing
            if ((frameCount - videoFrames) % 10 === 0 && frameCount > videoFrames) {
              console.log(`📊 Processing end card frame ${frameCount - videoFrames}/${endCardFrames}`, {
                currentTime: currentTime.toFixed(2),
                totalDuration: totalDuration.toFixed(2),
                remaining: (totalDuration - currentTime).toFixed(2),
                note: 'End card frame drawn and should be captured by MediaRecorder'
              });
            }
            
            // Move to next frame
            currentTime += frameInterval;
            isProcessing = false;
            
            // CRITICAL: For end card frames, ensure proper timing for MediaRecorder capture
            // The canvas stream needs time to capture each frame
            // Use requestAnimationFrame to ensure canvas is rendered, then wait for proper frame timing
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                // For end card frames, use a longer delay to ensure MediaRecorder captures them
                // This is critical because end card frames are static and need time to be captured
                const frameDelay = 1000 / captureFrameRate; // e.g., 1000/15 = 66.67ms for 15fps
                const minDelay = 200; // Increased minimum delay for end card frames
                const actualDelay = Math.max(minDelay, frameDelay * 1.5); // 1.5x delay for end card
                
                // Log every 5th frame to verify we're processing
                if ((frameCount - videoFrames) % 5 === 0) {
                  console.log(`🎬 End card frame ${frameCount - videoFrames}/${endCardFrames} processed, waiting ${actualDelay.toFixed(0)}ms`);
                }
                
                setTimeout(processNextFrame, actualDelay);
              });
            });
          } else {
            // Process video frame
            const seekTime = currentTime;
            video.currentTime = seekTime;
            
            video.onseeked = () => {
              // Clear canvas with black background (for letterboxing/pillarboxing)
              ctx.fillStyle = '#000000';
              ctx.fillRect(0, 0, targetWidth, targetHeight);
              
              // Draw video frame fitted to maintain aspect ratio (preserves full content)
              try {
                ctx.drawImage(
                  video,
                  cropX, cropY, cropWidth, cropHeight, // Source (full video, no crop)
                  offsetX, offsetY, fitWidth, fitHeight // Destination (fitted with letterboxing/pillarboxing)
                );
                
                // Apply video sharpening to enhance clarity (especially for blurry videos)
                applyVideoSharpening(ctx, targetWidth, targetHeight, sharpConfig);
                
                // CRITICAL: Draw logo watermark on EVERY video frame
                if (logoImage) {
                  drawLogo();
                  // Log on first frame to confirm logo is being drawn
                  if (frameCount === 0) {
                    console.log('✅ Drawing logo on video frames:', {
                      logoSize: `${logoDisplayWidth}x${logoDisplayHeight}px`,
                      position: watermarkPosition,
                      logoPos: logoPos,
                      note: 'Logo will appear on every frame'
                    });
                  }
                } else {
                  // Log warning if logo should be there but isn't
                  if (frameCount === 0) {
                    console.error('❌ Logo image not available - video frame processed WITHOUT logo!');
                    console.error('   Check logo loading above - logo must be loaded before processing');
                  }
                }
              } catch (drawError) {
                console.warn('Error drawing frame, skipping:', drawError);
                isProcessing = false;
                currentTime += frameInterval;
                setTimeout(processNextFrame, 0);
                return;
              }
              
              // Update progress
              frameCount++;
              const progress = 10 + (frameCount / totalFrames) * 85;
              onProgress?.(Math.min(95, progress));
              
              // Move to next frame
              currentTime += frameInterval;
              isProcessing = false;
              
              // Process next frame with small delay to prevent overwhelming the browser
              setTimeout(processNextFrame, 10);
            };
            
            video.onerror = () => {
              isProcessing = false;
              // Continue processing even if one frame fails
              currentTime += frameInterval;
              setTimeout(processNextFrame, 10);
            };
          }
        };
        
        // Start recording when ready
        video.oncanplay = () => {
          if (!recordingStarted) {
            recordingStarted = true;
            console.log('🎥 Starting MediaRecorder:', {
              totalDuration: totalDuration.toFixed(2),
              videoDuration: finalDuration.toFixed(2),
              endCardDuration: shouldShowEndCard ? endCardDuration : 0,
              frameRate: captureFrameRate,
              totalFrames: totalFrames,
              note: 'MediaRecorder will capture all frames including end card'
            });
            mediaRecorder.start(100); // Collect data every 100ms
            onProgress?.(10);
            
            // Start processing frames
            video.currentTime = 0;
            video.onseeked = () => {
              processNextFrame();
            };
          }
        };
        
      } catch (error) {
        console.error('❌ Error in video processing:', error);
        // Even if there's an error, try to ensure we've processed the end card
        // This is a fallback - the error might have occurred before end card processing
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    
    video.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video for processing'));
    };
    
    video.src = url;
    video.load();
  });
}

// Process video for platform (validation version - for checking requirements)
export async function validateVideoForPlatform(
  videoFile: File,
  platform: string = 'instagram'
): Promise<{
  needsProcessing: boolean;
  metadata: {
    duration: number;
    width: number;
    height: number;
    fileSize: number;
    bitrate: number;
  };
  requirements: {
    targetWidth: number;
    targetHeight: number;
    maxLength: number;
    maxFileSize: number;
    targetBitrate: number;
  };
  processingInfo: {
    needsResize: boolean;
    needsTrim: boolean;
    needsCompression: boolean;
    reasons: string[];
  };
}> {
  const metadata = await getVideoMetadata(videoFile);
  const platformSpecs = PLATFORM_VIDEO_DIMENSIONS[platform] || PLATFORM_VIDEO_DIMENSIONS.instagram;
  const processingInfo = videoNeedsProcessing(metadata, platform);
  
  return {
    needsProcessing: processingInfo.needsResize || processingInfo.needsTrim || processingInfo.needsCompression,
    metadata,
    requirements: {
      targetWidth: platformSpecs.width,
      targetHeight: platformSpecs.height,
      maxLength: platformSpecs.maxLength,
      maxFileSize: platformSpecs.maxFileSize,
      targetBitrate: platformSpecs.bitrate,
    },
    processingInfo,
  };
}

// Create a preview of video with platform dimensions (for UI display)
export async function createVideoPreview(
  videoFile: File,
  platform: string = 'instagram',
  maxDuration: number = 10 // Preview first 10 seconds
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(videoFile);
    const platformSpecs = PLATFORM_VIDEO_DIMENSIONS[platform] || PLATFORM_VIDEO_DIMENSIONS.instagram;
    
    video.onloadedmetadata = () => {
      const canvas = document.createElement('canvas');
      canvas.width = platformSpecs.width;
      canvas.height = platformSpecs.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Set video to first frame
      video.currentTime = 0;
      
      video.onseeked = () => {
        // Draw video frame to canvas with platform dimensions
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to blob URL
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            const previewUrl = URL.createObjectURL(blob);
            resolve(previewUrl);
          } else {
            reject(new Error('Failed to create preview'));
          }
        }, 'image/jpeg', 0.9);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video'));
      };
    };
    
    video.src = url;
    video.load();
  });
}

