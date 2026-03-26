import { useRef, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { VideoTextOverlay } from '@/hooks/useContent';
import { useBrandingSettings } from '@/hooks/useBrandingSettings';

interface VideoPlayerProps {
  src: string;
  className?: string;
  controls?: boolean;
  muted?: boolean;
  watermarkLogoUrl?: string | null;
  watermarkWebsiteUrl?: string | null;
  watermarkPosition?: string | null;
  textOverlays?: VideoTextOverlay[] | null;
  onDurationChange?: (duration: number) => void;
}

export function VideoPlayer({
  src,
  className = '',
  controls = true,
  muted = false,
  watermarkLogoUrl,
  watermarkWebsiteUrl,
  watermarkPosition = 'bottom-right',
  textOverlays,
  onDurationChange,
}: VideoPlayerProps) {
  // Fallback to branding settings if content doesn't have watermark URLs
  const { settings: brandingSettings } = useBrandingSettings();
  
  // Use content watermark URLs first, fallback to branding settings
  const effectiveLogoUrl = watermarkLogoUrl || brandingSettings?.company_logo_url || null;
  const effectiveWebsiteUrl = watermarkWebsiteUrl || brandingSettings?.company_website_url || null;
  const effectivePosition = watermarkPosition || brandingSettings?.watermark_position || 'bottom-right';
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      if (video.duration && onDurationChange) {
        onDurationChange(video.duration);
      }
    };

    // Handle fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Check if duration is already available
    if (video.duration && onDurationChange) {
      onDurationChange(video.duration);
    }

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [onDurationChange]);

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

  const showWatermark = effectiveLogoUrl && isPlaying;
  const showClickable = effectiveWebsiteUrl && isPlaying;

  // Get active text overlays based on current time, supporting both repeat and timeframe modes
  const activeOverlays =
    textOverlays?.filter((overlay) => {
      const displayMode = overlay.displayMode || 'timeframe'; // Default to timeframe for backward compatibility
      
      if (displayMode === 'timeframe') {
        // Time frame mode: show between startTime and endTime
        const startTime = overlay.startTime ?? 0;
        const endTime = overlay.endTime ?? 0;
        if (endTime <= startTime) return false; // Invalid time range
        return currentTime >= startTime && currentTime <= endTime;
      } else {
        // Repeat mode: show at regular intervals
        const repeat = overlay.repeatEverySeconds ?? 0;
        const duration = overlay.showForSeconds ?? 0;
        if (!repeat || repeat <= 0 || !duration || duration <= 0) return false;

        // Phase of current time within the repeat window
        const phase = currentTime % repeat;
        return phase >= 0 && phase <= duration;
      }
    }) || [];

  const getTextPositionClasses = (position: string) => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 -translate-x-1/2';
      case 'top-right':
        return 'top-4 right-4';
      case 'center-left':
        return 'top-1/2 -translate-y-1/2 left-4';
      case 'center':
        return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
      case 'center-right':
        return 'top-1/2 -translate-y-1/2 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-center':
        return 'bottom-4 left-1/2 -translate-x-1/2';
      case 'bottom-right':
        return 'bottom-4 right-4';
      default:
        return 'top-4 left-4';
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        controls={controls}
        muted={muted}
      />
      
      {/* Watermark Overlay */}
      {showWatermark && (
        <div
          className={`${isFullscreen ? 'fixed' : 'absolute'} ${getPositionClasses()} transition-opacity duration-300 ${
            showClickable ? 'cursor-pointer hover:opacity-80' : ''
          }`}
          onClick={showClickable ? handleWatermarkClick : undefined}
          style={{
            pointerEvents: showClickable ? 'auto' : 'none',
            zIndex: 9999, // Very high z-index to ensure visibility in fullscreen
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
          className={`${isFullscreen ? 'fixed' : 'absolute'} ${getPositionClasses()}`}
          onClick={handleWatermarkClick}
          style={{
            zIndex: 9999, // Very high z-index to ensure visibility in fullscreen
          }}
        >
          <div className="bg-primary/90 hover:bg-primary text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer transition-colors shadow-lg">
            <span className="text-sm font-medium">Visit Website</span>
            <ExternalLink className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Text Overlays */}
      {activeOverlays.map((overlay) => {
        const animationClass = overlay.animation === 'fade' 
          ? 'animate-fade-in' 
          : overlay.animation === 'slide' 
          ? 'animate-slide-in' 
          : '';
        
        return (
          <div
            key={overlay.id}
            className={`${isFullscreen ? 'fixed' : 'absolute'} ${getTextPositionClasses(overlay.position)} ${animationClass} transition-opacity duration-300`}
            style={{
              fontSize: `${overlay.fontSize || 24}px`,
              color: overlay.fontColor || '#FFFFFF',
              backgroundColor: overlay.backgroundColor || 'rgba(0, 0, 0, 0.7)',
              opacity: overlay.opacity !== undefined ? overlay.opacity : 1,
              padding: '12px 20px',
              borderRadius: '8px',
              fontWeight: '600',
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
              whiteSpace: 'nowrap',
              maxWidth: '90%',
              zIndex: 9999, // Very high z-index to ensure visibility in fullscreen
            }}
          >
            {overlay.text}
          </div>
        );
      })}
    </div>
  );
}
