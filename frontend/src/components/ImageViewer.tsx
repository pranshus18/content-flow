import { ExternalLink } from 'lucide-react';

function positionClasses(position?: string | null) {
  switch (position || 'bottom-right') {
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
}

interface ImageViewerProps {
  src: string;
  alt: string;
  className?: string;
  watermarkLogoUrl?: string | null;
  vendorLogoUrl?: string | null;
  watermarkWebsiteUrl?: string | null;
  watermarkPosition?: string | null;
  vendorLogoPosition?: string | null;
  brandingBaked?: boolean;
}

export function ImageViewer({
  src,
  alt,
  className = '',
  watermarkLogoUrl,
  vendorLogoUrl,
  watermarkWebsiteUrl,
  watermarkPosition = 'bottom-right',
  vendorLogoPosition = 'bottom-left',
  brandingBaked = false,
}: ImageViewerProps) {
  const effectiveLogoUrl = watermarkLogoUrl || null;
  const effectiveVendorUrl = vendorLogoUrl || null;
  const effectiveWebsiteUrl = watermarkWebsiteUrl || null;
  const platformPos = watermarkPosition || 'bottom-right';
  const vendorPos = vendorLogoPosition || 'bottom-left';
  const sameCorner = Boolean(effectiveLogoUrl && effectiveVendorUrl && platformPos === vendorPos);

  const handleWatermarkClick = () => {
    if (effectiveWebsiteUrl) {
      window.open(effectiveWebsiteUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const showPlatform = !brandingBaked && effectiveLogoUrl;
  const showVendor = !brandingBaked && effectiveVendorUrl;
  const showClickable = !brandingBaked && effectiveWebsiteUrl;

  return (
    <div className={`relative ${className}`}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-contain"
      />

      {showPlatform && (
        <div
          className={`absolute ${positionClasses(platformPos)} z-10 transition-opacity duration-300 ${
            showClickable ? 'cursor-pointer hover:opacity-80' : ''
          }`}
          onClick={showClickable ? handleWatermarkClick : undefined}
          style={{ pointerEvents: showClickable ? 'auto' : 'none' }}
        >
          <div className="flex items-center gap-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
            <img
              src={effectiveLogoUrl!}
              alt="Platform logo"
              className="h-9 w-auto object-contain max-w-[130px] opacity-90"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            {showClickable && (
              <div className="flex items-center gap-1 text-white text-xs font-medium">
                <span>Visit Website</span>
                <ExternalLink className="w-3 h-3" />
              </div>
            )}
          </div>
        </div>
      )}

      {showVendor && (
        <div
          className={`absolute ${positionClasses(vendorPos)} z-10`}
          style={{
            pointerEvents: 'none',
            ...(sameCorner
              ? platformPos.startsWith('top')
                ? { marginTop: '3.25rem' }
                : { marginBottom: '3.25rem' }
              : {}),
          }}
        >
          <div className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
            <img
              src={effectiveVendorUrl!}
              alt="Vendor logo"
              className="h-9 w-auto object-contain max-w-[130px] opacity-90"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </div>
      )}

      {!effectiveLogoUrl && showClickable && (
        <div
          className={`absolute ${positionClasses(platformPos)} z-10`}
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
