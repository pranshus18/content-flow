import { useRef, useEffect, useState } from 'react';
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

interface VideoPlayerProps {
  src: string;
  className?: string;
  controls?: boolean;
  muted?: boolean;
  watermarkLogoUrl?: string | null;
  vendorLogoUrl?: string | null;
  watermarkWebsiteUrl?: string | null;
  watermarkPosition?: string | null;
  vendorLogoPosition?: string | null;
  platformLogoThroughout?: boolean;
  vendorLogoThroughout?: boolean;
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
  vendorLogoUrl,
  watermarkWebsiteUrl,
  watermarkPosition = 'bottom-right',
  vendorLogoPosition = 'bottom-left',
  platformLogoThroughout = true,
  vendorLogoThroughout = false,
  introFrameUrl,
  outroFrameUrl,
  introDuration = 3,
  outroDuration = 5,
  previewTemplateFrames = false,
  brandingBaked = false,
}: VideoPlayerProps) {
  const effectiveLogoUrl = watermarkLogoUrl || null;
  const effectiveVendorUrl = vendorLogoUrl || null;
  const effectiveWebsiteUrl = watermarkWebsiteUrl || null;
  const platformPos = watermarkPosition || 'bottom-right';
  const vendorPos = vendorLogoPosition || 'bottom-left';
  const sameCorner = Boolean(effectiveLogoUrl && effectiveVendorUrl && platformPos === vendorPos);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const skipIntroRef = useRef(false);
  const introTimerRef = useRef<number | null>(null);
  const outroTimerRef = useRef<number | null>(null);
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
    const handleEnded = () => {
      skipIntroRef.current = false;
      if (showOutroPreview) {
        setTemplatePhase('outro');
        outroTimerRef.current = window.setTimeout(() => {
          setTemplatePhase('idle');
        }, Math.max(1, outroDuration) * 1000);
      }
    };
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('ended', handleEnded);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      clearTimers();
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('ended', handleEnded);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [src, showIntroPreview, showOutroPreview, introDuration, outroDuration]);

  const handleWatermarkClick = () => {
    if (effectiveWebsiteUrl) {
      window.open(effectiveWebsiteUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const onIntroOutroCards = templatePhase === 'intro' || templatePhase === 'outro';
  const onMainClip = templatePhase === 'video' || (templatePhase === 'idle' && !showIntroPreview);
  const platformOnMainClip = platformLogoThroughout !== false;
  const showPlatform = !brandingBaked && effectiveLogoUrl && (
    (platformOnMainClip && onMainClip) || onIntroOutroCards
  );
  const showVendor = !brandingBaked && effectiveVendorUrl && (
    (vendorLogoThroughout && onMainClip) || (!vendorLogoThroughout && onIntroOutroCards)
  );
  const showClickable = !brandingBaked && effectiveWebsiteUrl && showPlatform;
  const posMode = isFullscreen ? 'fixed' : 'absolute';

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

      {showPlatform && (
        <div
          className={`${posMode} ${positionClasses(platformPos)} transition-opacity duration-300 ${
            showClickable ? 'cursor-pointer hover:opacity-80' : ''
          }`}
          onClick={showClickable ? handleWatermarkClick : undefined}
          style={{
            pointerEvents: showClickable ? 'auto' : 'none',
            zIndex: 9999,
          }}
        >
          <div className="flex items-center gap-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
            <img
              src={effectiveLogoUrl!}
              alt="Platform logo"
              className="h-10 w-auto object-contain max-w-[150px] opacity-95 drop-shadow-[0_0_6px_rgba(0,0,0,0.35)]"
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
          className={`${posMode} ${positionClasses(vendorPos)}`}
          style={{
            pointerEvents: 'none',
            zIndex: 9999,
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
          className={`${posMode} ${positionClasses(platformPos)}`}
          onClick={handleWatermarkClick}
          style={{ zIndex: 9999 }}
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
