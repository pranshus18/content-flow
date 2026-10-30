import { ExternalLink } from 'lucide-react';

interface ImageViewerProps {
  src: string;
  alt: string;
  className?: string;
  watermarkLogoUrl?: string | null;
  watermarkWebsiteUrl?: string | null;
  watermarkPosition?: string | null;
  brandingBaked?: boolean;
}

export function ImageViewer({
  src,
  alt,
  className = '',
  watermarkLogoUrl,
  watermarkWebsiteUrl,
  watermarkPosition = 'bottom-right',
  brandingBaked = false,
}: ImageViewerProps) {
  const effectiveLogoUrl = watermarkLogoUrl || null;
  const effectiveWebsiteUrl = watermarkWebsiteUrl || null;
  const effectivePosition = watermarkPosition || 'bottom-right';
  const getPositionClasses = () => {
    switch (effectivePosition) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
      default:
        return 'bottom-4 right-4';
    }
  };

  const handleWatermarkClick = () => {
    if (effectiveWebsiteUrl) {
      window.open(effectiveWebsiteUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const showWatermark = !brandingBaked && effectiveLogoUrl;
  const showClickable = !brandingBaked && effectiveWebsiteUrl;

  return (
    <div className={`relative ${className}`}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-contain"
      />
      
      {/* Watermark Overlay */}
      {showWatermark && (
        <div
          className={`absolute ${getPositionClasses()} z-10 transition-opacity duration-300 ${
            showClickable ? 'cursor-pointer hover:opacity-80' : ''
          }`}
          onClick={showClickable ? handleWatermarkClick : undefined}
          style={{
            pointerEvents: showClickable ? 'auto' : 'none',
          }}
        >
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2 flex items-center gap-2">
            {effectiveLogoUrl && (
              <img
                src={effectiveLogoUrl}
                alt="Company logo"
                className="h-8 w-auto object-contain max-w-[120px]"
                onError={(e) => {
                  // Hide image on error
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            {showClickable && (
              <div className="flex items-center gap-1 text-white text-xs font-medium">
                <span>Visit Website</span>
                <ExternalLink className="w-3 h-3" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Website Link Overlay (if no logo but website URL provided) */}
      {!effectiveLogoUrl && showClickable && (
        <div
          className={`absolute ${getPositionClasses()} z-10`}
          onClick={handleWatermarkClick}
        >
          <div className="bg-primary/90 hover:bg-primary text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer transition-colors shadow-lg">
            <span className="text-sm font-medium">Visit Website</span>
            <ExternalLink className="w-4 h-4" />
          </div>
        </div>
      )}
    </div>
  );
}
