/**
 * Video Sharpening Utilities
 * Applies sharpening filters to video frames using Canvas image processing
 * Works seamlessly with existing frame-by-frame video processing
 */

/**
 * Apply unsharp masking to a canvas context
 * This enhances edges and details in the video frame
 * 
 * @param ctx - Canvas 2D context with the frame already drawn
 * @param strength - Sharpening strength (0.0 = no sharpening, 2.0 = very strong)
 *                   Recommended: 0.5 (light), 1.0 (medium), 1.5 (strong)
 * @param radius - Blur radius for unsharp mask (default: 1.0)
 */
export function sharpenCanvasFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number = 1.0,
  radius: number = 1.0
): void {
  if (strength <= 0) return; // No sharpening needed

  try {
    // Get the current frame as ImageData
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const output = new Uint8ClampedArray(data.length);

    // Create a temporary canvas for blurring
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) return;

    // Draw original to temp canvas
    tempCtx.putImageData(imageData, 0, 0);

    // Apply Gaussian blur to temp canvas (this is the "unsharp" part)
    // We'll use a simple box blur approximation for performance
    const blurPasses = Math.ceil(radius);
    for (let pass = 0; pass < blurPasses; pass++) {
      const blurred = tempCtx.getImageData(0, 0, width, height);
      const blurredData = blurred.data;
      
      // Simple box blur (fast approximation of Gaussian)
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          
          // Average with neighbors
          let r = 0, g = 0, b = 0, count = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nIdx = ((y + dy) * width + (x + dx)) * 4;
              r += blurredData[nIdx];
              g += blurredData[nIdx + 1];
              b += blurredData[nIdx + 2];
              count++;
            }
          }
          
          blurredData[idx] = r / count;
          blurredData[idx + 1] = g / count;
          blurredData[idx + 2] = b / count;
        }
      }
      
      tempCtx.putImageData(blurred, 0, 0);
    }

    // Get blurred image
    const blurredImageData = tempCtx.getImageData(0, 0, width, height);
    const blurredData = blurredImageData.data;

    // Apply unsharp masking: original + (original - blurred) * strength
    for (let i = 0; i < data.length; i += 4) {
      // RGB channels only (skip alpha)
      for (let c = 0; c < 3; c++) {
        const original = data[i + c];
        const blurred = blurredData[i + c];
        const diff = original - blurred;
        const sharpened = Math.max(0, Math.min(255, original + diff * strength));
        output[i + c] = sharpened;
      }
      // Preserve alpha channel
      output[i + 3] = data[i + 3];
    }

    // Put sharpened image back to canvas
    const sharpenedImageData = new ImageData(output, width, height);
    ctx.putImageData(sharpenedImageData, 0, 0);
  } catch (error) {
    console.warn('Error applying sharpening, continuing without sharpening:', error);
    // Continue without sharpening if there's an error
  }
}

/**
 * Apply a simpler, faster sharpening using convolution kernel
 * This is faster than unsharp masking but slightly less sophisticated
 * 
 * @param ctx - Canvas 2D context with the frame already drawn
 * @param strength - Sharpening strength (0.0 to 2.0)
 */
export function sharpenCanvasFrameFast(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number = 1.0
): void {
  if (strength <= 0) return;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const output = new Uint8ClampedArray(data.length);

    // Sharpening kernel (3x3)
    // [ 0, -1,  0]
    // [-1,  5, -1]  * strength
    // [ 0, -1,  0]
    const kernel = [
      0, -strength, 0,
      -strength, 1 + 4 * strength, -strength,
      0, -strength, 0
    ];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        for (let c = 0; c < 3; c++) { // RGB only
          let sum = 0;
          let kernelIdx = 0;
          
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixelIdx = ((y + ky) * width + (x + kx)) * 4 + c;
              sum += data[pixelIdx] * kernel[kernelIdx];
              kernelIdx++;
            }
          }
          
          output[idx + c] = Math.max(0, Math.min(255, sum));
        }
        
        // Preserve alpha
        output[idx + 3] = data[idx + 3];
      }
    }

    // Handle edges (copy original for edges)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
          const idx = (y * width + x) * 4;
          output[idx] = data[idx];
          output[idx + 1] = data[idx + 1];
          output[idx + 2] = data[idx + 2];
          output[idx + 3] = data[idx + 3];
        }
      }
    }

    const sharpenedImageData = new ImageData(output, width, height);
    ctx.putImageData(sharpenedImageData, 0, 0);
  } catch (error) {
    console.warn('Error applying fast sharpening, continuing without sharpening:', error);
  }
}

/**
 * Video sharpening configuration
 */
export interface VideoSharpeningConfig {
  /** Enable sharpening (default: true) */
  enabled: boolean;
  /** Sharpening strength: 0.0 (none) to 2.0 (very strong). Recommended: 1.0 (medium) */
  strength: number;
  /** Use fast sharpening algorithm (faster but slightly less quality) */
  useFastAlgorithm: boolean;
}

/**
 * Default sharpening configuration
 * Medium strength for slightly blurry videos
 */
export const DEFAULT_SHARPENING_CONFIG: VideoSharpeningConfig = {
  enabled: true,
  strength: 1.0, // Medium sharpening - good for slightly blurry videos
  useFastAlgorithm: true, // Use fast algorithm for better performance
};

/**
 * Apply sharpening to a video frame based on configuration
 * 
 * @param ctx - Canvas 2D context with the frame already drawn
 * @param width - Canvas width
 * @param height - Canvas height
 * @param config - Sharpening configuration
 */
export function applyVideoSharpening(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: VideoSharpeningConfig = DEFAULT_SHARPENING_CONFIG
): void {
  if (!config.enabled || config.strength <= 0) {
    return;
  }

  if (config.useFastAlgorithm) {
    sharpenCanvasFrameFast(ctx, width, height, config.strength);
  } else {
    sharpenCanvasFrame(ctx, width, height, config.strength);
  }
}
