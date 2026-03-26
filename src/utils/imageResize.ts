// Detect blur level in image (returns 0-1, where 1 is very blurry)
function detectBlurLevel(data: Uint8ClampedArray, width: number, height: number): number {
  let edgeVariance = 0;
  let sampleCount = 0;
  const sampleStep = Math.max(1, Math.floor(Math.sqrt(width * height) / 50)); // Sample every Nth pixel
  
  for (let y = 1; y < height - 1; y += sampleStep) {
    for (let x = 1; x < width - 1; x += sampleStep) {
      const idx = (y * width + x) * 4;
      const idxTop = ((y - 1) * width + x) * 4;
      const idxBottom = ((y + 1) * width + x) * 4;
      const idxLeft = (y * width + (x - 1)) * 4;
      const idxRight = (y * width + (x + 1)) * 4;
      
      // Calculate Laplacian variance (blur detection)
      const laplacianR = Math.abs(4 * data[idx] - data[idxTop] - data[idxBottom] - data[idxLeft] - data[idxRight]);
      const laplacianG = Math.abs(4 * data[idx + 1] - data[idxTop + 1] - data[idxBottom + 1] - data[idxLeft + 1] - data[idxRight + 1]);
      const laplacianB = Math.abs(4 * data[idx + 2] - data[idxTop + 2] - data[idxBottom + 2] - data[idxLeft + 2] - data[idxRight + 2]);
      
      const laplacian = (laplacianR + laplacianG + laplacianB) / 3;
      edgeVariance += laplacian;
      sampleCount++;
    }
  }
  
  const avgEdgeVariance = edgeVariance / sampleCount;
  // Normalize: low variance = blurry (high blur level), high variance = sharp (low blur level)
  // Typical sharp images have variance > 20, blurry images < 10
  const blurLevel = Math.max(0, Math.min(1, 1 - (avgEdgeVariance / 30)));
  
  return blurLevel;
}

// Advanced image enhancement function with blur detection and adaptive enhancement
function enhanceImage(imageData: ImageData, width: number, height: number): ImageData {
  try {
    const data = new Uint8ClampedArray(imageData.data.buffer);
    
    // Validate data
    if (!data || data.length === 0 || data.length !== width * height * 4) {
      console.warn('Invalid image data, returning original');
      return imageData;
    }
    
    // Detect blur level
    const blurLevel = detectBlurLevel(data, width, height);
    console.log(`Blur detection: ${(blurLevel * 100).toFixed(1)}% blurry (${blurLevel > 0.5 ? 'HIGH' : blurLevel > 0.3 ? 'MEDIUM' : 'LOW'})`);
    
    let processed: Uint8ClampedArray = data;
    
    // Step 1: Apply AGGRESSIVE sharpening based on blur level (MAXIMUM STRENGTH FOR VISIBLE RESULTS)
    try {
      if (blurLevel > 0.45) {
        // Very blurry image - EXTREMELY AGGRESSIVE sharpening with 3 passes
        console.log('Applying EXTREMELY AGGRESSIVE sharpening (3 passes) for very blurry image...');
        processed = applyUnsharpMask(processed, width, height, 3.0, 1); // Very strong, low threshold
        processed = applyUnsharpMask(processed, width, height, 2.5, 2); // Second pass
        processed = applyUnsharpMask(processed, width, height, 2.0, 3); // Third pass
      } else if (blurLevel > 0.25) {
        // Moderately blurry - VERY AGGRESSIVE sharpening with 3 passes (FOR YOUR IMAGE TYPE)
        console.log('Applying VERY AGGRESSIVE sharpening (3 passes) for moderately blurry image...');
        processed = applyUnsharpMask(processed, width, height, 2.8, 1); // Very strong first pass
        processed = applyUnsharpMask(processed, width, height, 2.2, 2); // Second pass
        processed = applyUnsharpMask(processed, width, height, 1.8, 3); // Third pass
      } else {
        // Slightly soft - strong sharpening with 2 passes
        console.log('Applying strong sharpening (2 passes) for slightly soft image...');
        processed = applyUnsharpMask(processed, width, height, 2.0, 2);
        processed = applyUnsharpMask(processed, width, height, 1.5, 3);
      }
    } catch (error) {
      console.warn('Sharpening failed, continuing without it:', error);
    }
    
    // Step 2: Enhance contrast (MAXIMUM FOR BETTER CLARITY)
    try {
      const contrastFactor =
        blurLevel > 0.45 ? 1.35 : blurLevel > 0.25 ? 1.30 : 1.25; // Much stronger contrast
      processed = enhanceContrast(processed, width, height, contrastFactor);
      // Apply contrast twice for blurry images for cumulative effect
      if (blurLevel > 0.25) {
        processed = enhanceContrast(processed, width, height, 1.15); // Second pass
      }
    } catch (error) {
      console.warn('Contrast enhancement failed, continuing:', error);
    }
    
    // Step 3: Boost saturation and vibrancy (very subtle to avoid noise)
    try {
      processed = enhanceSaturation(processed, width, height);
    } catch (error) {
      console.warn('Saturation enhancement failed, continuing:', error);
    }
    
    // Step 4: Adjust brightness and exposure (keep very mild)
    try {
      processed = adjustBrightness(processed, width, height);
    } catch (error) {
      console.warn('Brightness adjustment failed, continuing:', error);
    }
    
    // Step 5: Color balance correction
    try {
      processed = correctColorBalance(processed, width, height);
    } catch (error) {
      console.warn('Color balance correction failed, continuing:', error);
    }
    
    // Create new ImageData with proper typing
    const resultData = new Uint8ClampedArray(processed);
    return new ImageData(resultData, width, height);
  } catch (error) {
    console.error('Image enhancement failed completely, returning original:', error);
    // Return original if all enhancement fails
    return imageData;
  }
}

// Unsharp masking for sharpness enhancement (IMPROVED - More effective for blurry images)
// Supports custom amount and threshold for adaptive sharpening
function applyUnsharpMask(
  data: Uint8ClampedArray, 
  width: number, 
  height: number, 
  amount: number = 1.3, 
  threshold: number = 3
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data);
  
  // Improved sharpening algorithm - works better on blurry images
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const idxTop = ((y - 1) * width + x) * 4;
      const idxBottom = ((y + 1) * width + x) * 4;
      const idxLeft = (y * width + (x - 1)) * 4;
      const idxRight = (y * width + (x + 1)) * 4;
      
      // Calculate edge strength (Laplacian-like) - improved detection
      const edgeR = Math.abs(4 * data[idx] - data[idxTop] - data[idxBottom] - data[idxLeft] - data[idxRight]);
      const edgeG = Math.abs(4 * data[idx + 1] - data[idxTop + 1] - data[idxBottom + 1] - data[idxLeft + 1] - data[idxRight + 1]);
      const edgeB = Math.abs(4 * data[idx + 2] - data[idxTop + 2] - data[idxBottom + 2] - data[idxLeft + 2] - data[idxRight + 2]);
      
      const edgeStrength = (edgeR + edgeG + edgeB) / 3;
      
      // AGGRESSIVE sharpening - sharpen more areas for blurry images
      // For blurry images (low threshold), sharpen almost everything
      if (edgeStrength > threshold) {
        // Strong edges - full sharpening
        const sharpenR = (data[idx] - (data[idxTop] + data[idxBottom] + data[idxLeft] + data[idxRight]) / 4) * amount;
        const sharpenG = (data[idx + 1] - (data[idxTop + 1] + data[idxBottom + 1] + data[idxLeft + 1] + data[idxRight + 1]) / 4) * amount;
        const sharpenB = (data[idx + 2] - (data[idxTop + 2] + data[idxBottom + 2] + data[idxLeft + 2] + data[idxRight + 2]) / 4) * amount;
        
        result[idx] = Math.min(255, Math.max(0, data[idx] + sharpenR));
        result[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + sharpenG));
        result[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + sharpenB));
      } else if (threshold <= 2) {
        // For blurry images (threshold <= 2), sharpen medium edges too (more aggressive)
        const adaptiveAmount = amount * 0.75; // 75% strength for medium edges (increased from 0.6)
        const sharpenR = (data[idx] - (data[idxTop] + data[idxBottom] + data[idxLeft] + data[idxRight]) / 4) * adaptiveAmount;
        const sharpenG = (data[idx + 1] - (data[idxTop + 1] + data[idxBottom + 1] + data[idxLeft + 1] + data[idxRight + 1]) / 4) * adaptiveAmount;
        const sharpenB = (data[idx + 2] - (data[idxTop + 2] + data[idxBottom + 2] + data[idxLeft + 2] + data[idxRight + 2]) / 4) * adaptiveAmount;
        
        result[idx] = Math.min(255, Math.max(0, data[idx] + sharpenR));
        result[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + sharpenG));
        result[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + sharpenB));
      } else {
        // Keep original for very smooth areas (only for already sharp images)
        result[idx] = data[idx];
        result[idx + 1] = data[idx + 1];
        result[idx + 2] = data[idx + 2];
      }
      result[idx + 3] = data[idx + 3];
    }
  }
  
  return result;
}

// Enhance contrast with adaptive algorithm
function enhanceContrast(
  data: Uint8ClampedArray, 
  width: number, 
  height: number, 
  factor: number = 1.3
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data);
  
  for (let i = 0; i < data.length; i += 4) {
    // Apply contrast to each channel with better algorithm
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Enhanced contrast with midpoint adjustment
    result[i] = Math.min(255, Math.max(0, (r - 128) * factor + 128));
    result[i + 1] = Math.min(255, Math.max(0, (g - 128) * factor + 128));
    result[i + 2] = Math.min(255, Math.max(0, (b - 128) * factor + 128));
    result[i + 3] = data[i + 3]; // Alpha
  }
  
  return result;
}

// Enhance saturation and vibrancy
function enhanceSaturation(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data);
  const saturationFactor = 1.18; // Much stronger saturation for better colors
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Calculate luminance (perceived brightness)
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Apply saturation boost (preserve luminance)
    result[i] = Math.min(255, Math.max(0, luminance + (r - luminance) * saturationFactor));
    result[i + 1] = Math.min(255, Math.max(0, luminance + (g - luminance) * saturationFactor));
    result[i + 2] = Math.min(255, Math.max(0, luminance + (b - luminance) * saturationFactor));
    result[i + 3] = data[i + 3];
  }
  
  return result;
}

// Adjust brightness and exposure
function adjustBrightness(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data);
  const brightness = 1.05; // Slight brightness boost
  const exposure = 1.02; // Slight exposure adjustment
  
  for (let i = 0; i < data.length; i += 4) {
    // Apply brightness
    let r = data[i] * brightness;
    let g = data[i + 1] * brightness;
    let b = data[i + 2] * brightness;
    
    // Apply exposure (gamma-like adjustment)
    r = Math.pow(r / 255, 1 / exposure) * 255;
    g = Math.pow(g / 255, 1 / exposure) * 255;
    b = Math.pow(b / 255, 1 / exposure) * 255;
    
    result[i] = Math.min(255, Math.max(0, r));
    result[i + 1] = Math.min(255, Math.max(0, g));
    result[i + 2] = Math.min(255, Math.max(0, b));
    result[i + 3] = data[i + 3];
  }
  
  return result;
}

// Correct color balance
function correctColorBalance(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data);
  
  // Calculate average color to detect color cast
  let avgR = 0, avgG = 0, avgB = 0;
  const sampleSize = Math.min(10000, width * height);
  const step = Math.max(1, Math.floor((width * height) / sampleSize));
  
  for (let i = 0; i < data.length; i += step * 4) {
    avgR += data[i];
    avgG += data[i + 1];
    avgB += data[i + 2];
  }
  
  const count = sampleSize;
  avgR /= count;
  avgG /= count;
  avgB /= count;
  
  // Calculate correction factors (neutral gray target)
  const avgGray = (avgR + avgG + avgB) / 3;
  const rFactor = avgGray / Math.max(avgR, 1);
  const gFactor = avgGray / Math.max(avgG, 1);
  const bFactor = avgGray / Math.max(avgB, 1);
  
  // Apply gentle color balance correction
  const balanceStrength = 0.2; // Very gentle correction to avoid color shifts
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    result[i] = Math.min(255, Math.max(0, r + (r * (rFactor - 1)) * balanceStrength));
    result[i + 1] = Math.min(255, Math.max(0, g + (g * (gFactor - 1)) * balanceStrength));
    result[i + 2] = Math.min(255, Math.max(0, b + (b * (bFactor - 1)) * balanceStrength));
    result[i + 3] = data[i + 3];
  }
  
  return result;
}

// Platform-specific image dimensions
export const PLATFORM_DIMENSIONS: Record<string, { width: number; height: number; aspectRatio: number }> = {
  instagram: {
    width: 1080,
    height: 1080,
    aspectRatio: 1, // Square (can also be 1080x1350 portrait or 1080x566 landscape, but square is most common)
  },
  facebook: {
    width: 1200,
    height: 630,
    aspectRatio: 1.91, // Link preview format (most common)
  },
  twitter: {
    width: 1200,
    height: 675,
    aspectRatio: 1.78, // 16:9 format
  },
  linkedin: {
    width: 1200,
    height: 627,
    aspectRatio: 1.91, // Link preview format
  },
  youtube: {
    width: 1920,
    height: 1080,
    aspectRatio: 16 / 9,
  },
};

// Process image file: resize, crop, and enhance for platform
// ALWAYS resizes to platform dimensions, even if enhancement fails
// Professional quality: 0.92 (92%) - optimal balance for social media posting
export async function processImageForPlatform(
  file: File,
  platform: string = 'instagram',
  quality: number = 0.92
): Promise<File> {
  return new Promise((resolve, reject) => {
    const dimensions = PLATFORM_DIMENSIONS[platform] || PLATFORM_DIMENSIONS.instagram;
    const targetWidth = dimensions.width;
    const targetHeight = dimensions.height;
    const targetAspectRatio = dimensions.aspectRatio;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      
      // Set up error handling with retry
      let retryCount = 0;
      const maxRetries = 2;
      
      const loadImage = () => {
        img.onload = () => {
          try {
            // Validate image dimensions
            if (!img.width || !img.height || img.width <= 0 || img.height <= 0) {
              throw new Error('Invalid image dimensions');
            }

            const currentAspectRatio = img.width / img.height;
            
            // Calculate dimensions to fit within target while maintaining aspect ratio (FIT mode, not CROP)
            // This preserves the entire image without cutting off any content
            let fitWidth = targetWidth;
            let fitHeight = targetHeight;
            let offsetX = 0;
            let offsetY = 0;
            
            if (currentAspectRatio > targetAspectRatio) {
              // Image is wider than target - fit to width, add letterboxing (black bars top/bottom)
              fitHeight = targetWidth / currentAspectRatio;
              offsetY = (targetHeight - fitHeight) / 2;
            } else {
              // Image is taller than target - fit to height, add pillarboxing (black bars left/right)
              fitWidth = targetHeight * currentAspectRatio;
              offsetX = (targetWidth - fitWidth) / 2;
            }

            // Create canvas for final output
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = targetWidth;
            finalCanvas.height = targetHeight;
            const finalCtx = finalCanvas.getContext('2d', {
              willReadFrequently: true,
              imageSmoothingEnabled: true,
              imageSmoothingQuality: 'high'
            });
            
            if (!finalCtx) {
              throw new Error('Could not get final canvas context');
            }

            // Fill with black background (for letterboxing/pillarboxing)
            finalCtx.fillStyle = '#000000';
            finalCtx.fillRect(0, 0, targetWidth, targetHeight);

            // Use high-quality resizing - FIT the image within target dimensions (preserves full content)
            const ctx2d = finalCtx as CanvasRenderingContext2D;
            ctx2d.imageSmoothingEnabled = true;
            ctx2d.imageSmoothingQuality = 'high';
            // Draw image centered and fitted to maintain aspect ratio
            ctx2d.drawImage(img, offsetX, offsetY, fitWidth, fitHeight);

            // Try to apply enhancement, but if it fails, use the resized image
            let finalImageData: ImageData;
            try {
              const imageData = ctx2d.getImageData(0, 0, targetWidth, targetHeight);
              finalImageData = enhanceImage(imageData, targetWidth, targetHeight);
              ctx2d.putImageData(finalImageData, 0, 0);
            } catch (enhanceError) {
              console.warn('Enhancement failed, using resized image:', enhanceError);
              // Enhancement failed, but we still have a properly resized image
              // Get the current image data (already resized)
              finalImageData = ctx2d.getImageData(0, 0, targetWidth, targetHeight);
            }

            // Validate canvas size before converting
            if (finalCanvas.width !== targetWidth || finalCanvas.height !== targetHeight) {
              console.error(`Canvas size mismatch! Expected ${targetWidth}x${targetHeight}, got ${finalCanvas.width}x${finalCanvas.height}`);
              // Force correct size
              const correctedCanvas = document.createElement('canvas');
              correctedCanvas.width = targetWidth;
              correctedCanvas.height = targetHeight;
              const correctedCtx = correctedCanvas.getContext('2d') as CanvasRenderingContext2D | null;
              if (correctedCtx) {
                correctedCtx.drawImage(finalCanvas, 0, 0, targetWidth, targetHeight);
                finalCanvas.width = targetWidth;
                finalCanvas.height = targetHeight;
                ctx2d.drawImage(correctedCanvas, 0, 0);
              }
            }
            
            console.log(`Image processed: ${finalCanvas.width}x${finalCanvas.height} (target: ${targetWidth}x${targetHeight})`);
            
            // Convert to blob and create File - THIS MUST SUCCEED
            finalCanvas.toBlob(
              (blob) => {
                if (!blob) {
                  // Last resort: try with lower quality
                  console.warn('First blob creation failed, trying lower quality...');
                  finalCanvas.toBlob(
                    (fallbackBlob) => {
                      if (!fallbackBlob) {
                        reject(new Error('Failed to create blob even with fallback'));
                        return;
                      }
                      const processedFile = new File([fallbackBlob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                      });
                      console.log(`Image successfully processed (fallback): ${targetWidth}x${targetHeight}`);
                      resolve(processedFile);
                    },
                    'image/jpeg',
                    0.85 // Lower quality fallback
                  );
                  return;
                }
                const processedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                console.log(`Image successfully processed: ${targetWidth}x${targetHeight}, size: ${(blob.size / 1024).toFixed(2)}KB`);
                resolve(processedFile);
              },
              'image/jpeg',
              quality
            );
          } catch (error) {
            // If all else fails, try basic resize without enhancement
            console.error('Processing error, attempting basic resize:', error);
            try {
              const basicCanvas = document.createElement('canvas');
              basicCanvas.width = targetWidth;
              basicCanvas.height = targetHeight;
              const basicCtx = basicCanvas.getContext('2d') as CanvasRenderingContext2D | null;
              if (basicCtx) {
                basicCtx.imageSmoothingEnabled = true;
                basicCtx.imageSmoothingQuality = 'high';
                basicCtx.drawImage(img, 0, 0, targetWidth, targetHeight);
                basicCanvas.toBlob(
                  (blob) => {
                    if (blob) {
                      resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                    } else {
                      reject(new Error('Failed to process image even with basic resize'));
                    }
                  },
                  'image/jpeg',
                  0.92 // Professional quality for social media posting
                );
              } else {
                reject(error);
              }
            } catch (fallbackError) {
              reject(new Error(`Image processing failed: ${error instanceof Error ? error.message : String(error)}`));
            }
          }
        };
        
        img.onerror = () => {
          retryCount++;
          if (retryCount < maxRetries) {
            console.warn(`Image load failed, retrying (${retryCount}/${maxRetries})...`);
            // Retry loading
            setTimeout(() => {
              img.src = e.target?.result as string;
            }, 100);
          } else {
            reject(new Error('Failed to load image after retries - image may be corrupted'));
          }
        };
        
        img.src = e.target?.result as string;
      };
      
      loadImage();
    };
    reader.onerror = () => reject(new Error('Failed to read file - file may be corrupted'));
    reader.readAsDataURL(file);
  });
}

type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface ImageWatermarkOptions {
  enabled?: boolean
  logoUrl?: string | null
  websiteUrl?: string | null
  position?: WatermarkPosition | string | null
}

async function loadWatermarkLogo(logoUrl?: string | null): Promise<HTMLImageElement | null> {
  if (!logoUrl) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = logoUrl
  })
}

function getWatermarkAnchor(
  canvasWidth: number,
  canvasHeight: number,
  boxWidth: number,
  boxHeight: number,
  position: WatermarkPosition
): { x: number; y: number } {
  const pad = Math.max(16, Math.round(canvasWidth * 0.02))
  switch (position) {
    case 'top-left':
      return { x: pad, y: pad }
    case 'top-right':
      return { x: canvasWidth - boxWidth - pad, y: pad }
    case 'bottom-left':
      return { x: pad, y: canvasHeight - boxHeight - pad }
    case 'bottom-right':
    default:
      return { x: canvasWidth - boxWidth - pad, y: canvasHeight - boxHeight - pad }
  }
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawImageWatermark(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  logoImg: HTMLImageElement | null,
  websiteUrl: string | null | undefined,
  position: WatermarkPosition
) {
  // Scale watermark based on canvas size
  const boxPadX = Math.max(14, Math.round(canvasWidth * 0.012))
  const boxPadY = Math.max(10, Math.round(canvasHeight * 0.012))
  const gap = Math.max(10, Math.round(canvasWidth * 0.01))
  const logoH = Math.max(28, Math.round(canvasHeight * 0.06)) // ~6% height
  const logoW = logoImg ? Math.round((logoImg.width / logoImg.height) * logoH) : 0

  const showWebsite = !!websiteUrl && websiteUrl.trim().length > 0
  const fontSize = Math.max(14, Math.round(canvasHeight * 0.03))
  ctx.save()
  ctx.font = `600 ${fontSize}px Arial, sans-serif`
  const text = showWebsite ? websiteUrl!.trim() : ''
  const textWidth = showWebsite ? ctx.measureText(text).width : 0
  const textH = showWebsite ? Math.round(fontSize * 1.25) : 0

  const contentW = (logoImg ? logoW : 0) + (logoImg && showWebsite ? gap : 0) + (showWebsite ? textWidth : 0)
  const contentH = Math.max(logoImg ? logoH : 0, showWebsite ? textH : 0)

  // If nothing to draw, bail
  if (!logoImg && !showWebsite) {
    ctx.restore()
    return
  }

  const boxW = Math.round(contentW + boxPadX * 2)
  const boxH = Math.round(contentH + boxPadY * 2)
  const anchor = getWatermarkAnchor(canvasWidth, canvasHeight, boxW, boxH, position)

  // Backdrop
  ctx.globalAlpha = 1
  drawRoundedRect(ctx, anchor.x, anchor.y, boxW, boxH, Math.max(10, Math.round(boxH * 0.25)))
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fill()

  // Foreground content
  let cursorX = anchor.x + boxPadX
  const centerY = anchor.y + boxH / 2

  if (logoImg) {
    const drawY = Math.round(centerY - logoH / 2)
    ctx.drawImage(logoImg, cursorX, drawY, logoW, logoH)
    cursorX += logoW + (showWebsite ? gap : 0)
  }

  if (showWebsite) {
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'
    ctx.lineWidth = 3
    const drawY = centerY
    ctx.strokeText(text, cursorX, drawY)
    ctx.fillText(text, cursorX, drawY)
  }

  ctx.restore()
}

// Process image and bake watermark into the output file (for publishing to social platforms)
export async function processImageForPlatformWithWatermark(
  file: File,
  platform: string = 'instagram',
  quality: number = 0.92,
  watermark?: ImageWatermarkOptions
): Promise<File> {
  // First do the normal processing
  const processed = await processImageForPlatform(file, platform, quality)

  const enabled = watermark?.enabled !== false
  const logoUrl = watermark?.logoUrl || null
  const websiteUrl = watermark?.websiteUrl || null
  const pos = (watermark?.position || 'bottom-right') as WatermarkPosition

  if (!enabled || (!logoUrl && !websiteUrl)) {
    return processed
  }

  // Draw watermark on top of processed image
  const logoImg = await loadWatermarkLogo(logoUrl)
  const blob = await processed.arrayBuffer()
  const imgBlob = new Blob([blob], { type: processed.type || 'image/jpeg' })
  const imgUrl = URL.createObjectURL(imgBlob)

  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load processed image for watermarking'))
      img.src = imgUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return processed

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0)
    drawImageWatermark(ctx, canvas.width, canvas.height, logoImg, websiteUrl, pos)

    const outBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to create watermarked image blob'))), 'image/jpeg', quality)
    })

    return new File([outBlob], processed.name, { type: 'image/jpeg', lastModified: Date.now() })
  } finally {
    URL.revokeObjectURL(imgUrl)
  }
}

// Resize image to platform-specific dimensions (for URL-based images)
// Professional quality: 0.92 (92%) - optimal balance for social media posting
export async function resizeImageForPlatform(
  imageUrl: string,
  platform: string,
  quality: number = 0.92
): Promise<string> {
  return new Promise((resolve, reject) => {
    const dimensions = PLATFORM_DIMENSIONS[platform] || PLATFORM_DIMENSIONS.instagram;
    const targetWidth = dimensions.width;
    const targetHeight = dimensions.height;
    const targetAspectRatio = dimensions.aspectRatio;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        // Calculate dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        const currentAspectRatio = width / height;

        // Calculate dimensions to fit within target while maintaining aspect ratio (FIT mode)
        // This preserves the entire image without cutting off any content
        let fitWidth = targetWidth;
        let fitHeight = targetHeight;
        let offsetX = 0;
        let offsetY = 0;
        
        if (currentAspectRatio > targetAspectRatio) {
          // Image is wider than target - fit to width, add letterboxing (black bars top/bottom)
          fitHeight = targetWidth / currentAspectRatio;
          offsetY = (targetHeight - fitHeight) / 2;
        } else {
          // Image is taller than target - fit to height, add pillarboxing (black bars left/right)
          fitWidth = targetHeight * currentAspectRatio;
          offsetX = (targetWidth - fitWidth) / 2;
        }

        // Create canvas for final output
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = targetWidth;
        finalCanvas.height = targetHeight;
        const finalCtx = finalCanvas.getContext('2d');
        
        if (!finalCtx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Fill with black background (for letterboxing/pillarboxing)
        finalCtx.fillStyle = '#000000';
        finalCtx.fillRect(0, 0, targetWidth, targetHeight);
        
        // Draw image fitted to maintain aspect ratio (preserves full content)
        finalCtx.drawImage(img, offsetX, offsetY, fitWidth, fitHeight);
        
        // Convert to blob and create data URL
        finalCanvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve(reader.result as string);
            };
            reader.onerror = () => reject(new Error('Failed to read blob'));
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          quality
        );
        return;
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

