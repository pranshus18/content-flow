import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Import ImageMagick WASM for high-quality image processing
import { initializeImageMagick, ImageMagick, MagickFormat, MagickGeometry } from "https://deno.land/x/imagemagick_deno@0.0.11/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Platform-specific dimensions
const PLATFORM_DIMENSIONS: Record<string, { width: number; height: number }> = {
  instagram: { width: 1080, height: 1080 },
  facebook: { width: 1200, height: 630 },
  twitter: { width: 1200, height: 675 },
  linkedin: { width: 1200, height: 627 },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mediaUrl, contentId, mediaType, platform } = await req.json();
    
    if (!mediaUrl) {
      throw new Error('mediaUrl is required');
    }

    const targetPlatform = platform || 'instagram';
    const dimensions = PLATFORM_DIMENSIONS[targetPlatform] || PLATFORM_DIMENSIONS.instagram;
    const isVideo = mediaType === 'video' || 
                   mediaUrl?.includes('.mp4') || 
                   mediaUrl?.includes('.mov') || 
                   mediaUrl?.includes('.webm');

    console.log('Processing media:', { 
      contentId, 
      mediaType, 
      platform: targetPlatform,
      isVideo,
      dimensions 
    });

    // Fetch the media file
    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) {
      throw new Error(`Failed to fetch media: ${mediaResponse.statusText}`);
    }

    const mediaBuffer = await mediaResponse.arrayBuffer();
    const mediaBytes = new Uint8Array(mediaBuffer);

    if (isVideo) {
      // For videos, we'll return the original for now
      // Video processing with FFmpeg requires a separate service
      // Client-side processing is already handling this well
      return new Response(
        JSON.stringify({
          success: true,
          processedMediaUrl: mediaUrl, // Use original (client-side already processed)
          note: 'Video processing handled client-side. For server-side video processing, consider using FFmpeg in a separate service.',
          dimensions: {
            width: dimensions.width,
            height: dimensions.height,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize ImageMagick WASM
    await initializeImageMagick();

    // Process image with ImageMagick
    let processedImage: Uint8Array;
    
    ImageMagick.read(mediaBytes, (img) => {
      // Get original dimensions
      const originalWidth = img.width;
      const originalHeight = img.height;
      const originalAspectRatio = originalWidth / originalHeight;
      const targetAspectRatio = dimensions.width / dimensions.height;

      // Calculate fit dimensions (preserve aspect ratio, add letterboxing/pillarboxing)
      let fitWidth = dimensions.width;
      let fitHeight = dimensions.height;
      let offsetX = 0;
      let offsetY = 0;

      if (originalAspectRatio > targetAspectRatio) {
        // Image is wider - fit to width
        fitHeight = Math.round(dimensions.width / originalAspectRatio);
        offsetY = Math.round((dimensions.height - fitHeight) / 2);
      } else {
        // Image is taller - fit to height
        fitWidth = Math.round(dimensions.height * originalAspectRatio);
        offsetX = Math.round((dimensions.width - fitWidth) / 2);
      }

      // Create canvas with target dimensions
      img.resize(new MagickGeometry(dimensions.width, dimensions.height));
      
      // If aspect ratios don't match, we need to fit and add black bars
      if (Math.abs(originalAspectRatio - targetAspectRatio) > 0.01) {
        // Resize to fit dimensions first
        img.resize(new MagickGeometry(fitWidth, fitHeight));
        
        // Create new image with target dimensions and black background
        ImageMagick.read(new Uint8Array(), (canvas) => {
          canvas.read({
            width: dimensions.width,
            height: dimensions.height,
            format: MagickFormat.Rgb,
            depth: 8,
          });
          
          // Fill with black
          canvas.backgroundColor = '#000000';
          
          // Composite the resized image onto canvas at calculated offset
          canvas.composite(img, offsetX, offsetY);
          
          // Apply high-quality settings
          img.quality = 95; // High quality
          img.filterType = 1; // Lanczos filter (best quality)
          img.unsharpMask(0, 0.5, 1.0, 0.05); // Subtle sharpening
          
          // Write processed image
          img.write((data) => {
            processedImage = data;
          }, MagickFormat.Jpeg);
        });
      } else {
        // Aspect ratios match, just resize
        img.quality = 95;
        img.filterType = 1; // Lanczos filter
        img.unsharpMask(0, 0.5, 1.0, 0.05); // Subtle sharpening
        
        img.write((data) => {
          processedImage = data;
        }, MagickFormat.Jpeg);
      }
    });

    // Upload processed image to Supabase Storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const fileExt = 'jpg';
    const fileName = `${contentId || 'processed'}-${Date.now()}.${fileExt}`;
    const filePath = `processed/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('content')
      .upload(filePath, processedImage, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload processed image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('content')
      .getPublicUrl(filePath);

    console.log('Image processed successfully:', {
      originalSize: mediaBytes.length,
      processedSize: processedImage.length,
      dimensions: `${dimensions.width}x${dimensions.height}`,
      url: publicUrl?.substring(0, 50),
    });

    return new Response(
      JSON.stringify({
        success: true,
        processedMediaUrl: publicUrl,
        originalMediaUrl: mediaUrl,
        dimensions: {
          width: dimensions.width,
          height: dimensions.height,
        },
        note: `Image processed with ImageMagick: resized to ${dimensions.width}x${dimensions.height}, high quality (95%), Lanczos filtering, subtle sharpening applied.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in process-media-server:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ 
        error: message,
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
