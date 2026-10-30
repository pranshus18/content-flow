import { useRef, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  className?: string;
  controls?: boolean;
  muted?: boolean;
  watermarkLogoUrl?: string | null;
  watermarkWebsiteUrl?: string | null;
  watermarkPosition?: string | null;
  introFrameUrl?: string | null;
  outroFrameUrl?: string | null;
  introDuration?: number;
  outroDuration?: number;
  previewTemplateFrames?: boolean;
  brandingBaked?: boolean;
}

export function VideoPlayer({
  src,
  className = '',
  controls = true,
  muted = false,
  watermarkLogoUrl,
  watermarkWebsiteUrl,
  watermarkPosition = 'bottom-right',
  introFrameUrl,
  outroFrameUrl,
  introDuration = 3,
  outroDuration = 5,
  previewTemplateFrames = false,
  brandingBaked = false,
}: VideoPlayerProps) {
  const effectiveLogoUrl = watermarkLogoUrl || null;
  const effectiveWebsiteUrl = watermarkWebsiteUrl || null;
  const effectivePosition = watermarkPosition || 'bottom-right';
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const skipIntroRef = useRef(false);
  const introTimerRef = useRef<number | null>(null);
  const outroTimerRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [templatePhase, setTemplatePhase] = useState<'idle' | 'intro' | 'video' | 'outro'>('idle');
  const showIntroPreview = previewTemplateFrames && !!introFrameUrl;
  const showOutroPreview = previewTemplateFrames && !!outroFrameUrl;

  useEffect(() => {
    skipIntroRef.current = false;
    setAspectRatio(null);
    setTemplatePhase('idle');
    if (introTimerRef.current) window.clearTimeout(introTimerRef.current);
    if (outroTimerRef.current) window.clearTimeout(outroTimerRef.current);
  }, [src, introFrameUrl, outroFrameUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const clearTimers = () => {
      if (introTimerRef.current) window.clearTimeout(introTimerRef.current);
      if (outroTimerRef.current) window.clearTimeout(outroTimerRef.current);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      if (showIntroPreview && !skipIntroRef.current) {
        skipIntroRef.current = true;
        video.pause();
        setTemplatePhase('intro');
        introTimerRef.current = window.setTimeout(() => {
          setTemplatePhase('video');
          void video.play();
        }, Math.max(1, introDuration) * 1000);
      }
    };
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      skipIntroRef.current = false;
      if (showOutroPreview) {
        setTemplatePhase('outro');
        outroTimerRef.current = window.setTimeout(() => {
          setTemplatePhase('idle');
        }, Math.max(1, outroDuration) * 1000);
      }
    };
    // Handle fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    
    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      clearTimers();
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [src, showIntroPreview, showOutroPreview, introDuration, outroDuration]);

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

  const showWatermark = !brandingBaked && effectiveLogoUrl && isPlaying;
  const showClickable = !brandingBaked && effectiveWebsiteUrl && isPlaying;

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={{ aspectRatio: aspectRatio ? String(aspectRatio) : '16 / 9' }}
    >
      <video
        key={src}
        ref={videoRef}
        src={src}
        className="absolute inset-0 w-full h-full object-contain"
        controls={controls}
        muted={muted}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            setAspectRatio(video.videoWidth / video.videoHeight);
          }
        }}
      />

      {(templatePhase === 'intro' && introFrameUrl) && (
        <div className="absolute inset-0 z-20 bg-black flex items-center justify-center">
          <img src={introFrameUrl} alt="Intro template" className="max-w-full max-h-full w-full h-full object-contain" />
        </div>
      )}
      {(templatePhase === 'outro' && outroFrameUrl) && (
        <div className="absolute inset-0 z-20 bg-black flex items-center justify-center">
          <img src={outroFrameUrl} alt="Outro template" className="max-w-full max-h-full w-full h-full object-contain" />
        </div>
      )}
      
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
    </div>
  );
}
