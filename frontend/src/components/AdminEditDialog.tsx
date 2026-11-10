import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogFullscreenContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { invokeBackend } from '@/lib/backend';
import { cn, errorMessage } from '@/lib/utils';
import { Youtube, Image as ImageIcon, Wand2, Loader2, Download, Clapperboard, Film } from 'lucide-react';
import {
  ACTIVE_CONTENT_PLATFORMS,
  ACTIVE_CONTENT_PLATFORM_LABELS,
  DEFAULT_CONTENT_PLATFORM,
  coerceActiveContentPlatform,
} from '@/lib/platforms';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VideoEditorStudio } from '@/components/video-editor/VideoEditorStudio';
import type { EditorPlatform, EditorTimeline } from '@/lib/editorTimeline';
import { resolveEditorPlatform } from '@/lib/editorTimeline';
import { ExportPostDialog } from '@/components/ExportPostDialog';
import { Input } from '@/components/ui/input';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ImageViewer } from '@/components/ImageViewer';
import { TemplateFramesSection } from '@/components/TemplateFramesSection';
import { BackgroundMusicSection } from '@/components/BackgroundMusicSection';
import { ContentItem, useContent } from '@/hooks/useContent';
import { uploadAdminAsset } from '@/lib/adminAssets';

interface AdminEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: ContentItem | null;
  onSave: (
    adminDescription: string,
    adminNotes: string,
    platform: string,
    watermarkLogoUrl?: string,
    vendorLogoUrl?: string,
    watermarkWebsiteUrl?: string,
    watermarkPosition?: string,
    vendorLogoPosition?: string,
    templateFrames?: {
      intro_frame_url?: string | null;
      outro_frame_url?: string | null;
      intro_frame_duration?: number;
      outro_frame_duration?: number;
    },
    logoVideoScope?: {
      platform_logo_throughout?: boolean;
      vendor_logo_throughout?: boolean;
    },
    backgroundMusic?: {
      background_music_track_id?: string | null;
      background_music_volume?: number;
    },
  ) => void | Promise<void>;
  onContentUpdated?: (content: ContentItem) => void;
}

export function AdminEditDialog({ open, onOpenChange, content, onSave, onContentUpdated }: AdminEditDialogProps) {
  const { publishToSocial } = useContent();
  const [adminDescription, setAdminDescription] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [platform, setPlatform] = useState<string>(DEFAULT_CONTENT_PLATFORM);
  const [generating, setGenerating] = useState(false);
  const [watermarkLogoUrl, setWatermarkLogoUrl] = useState('');
  const [vendorLogoUrl, setVendorLogoUrl] = useState('');
  const [watermarkWebsiteUrl, setWatermarkWebsiteUrl] = useState('');
  const [watermarkPosition, setWatermarkPosition] = useState('bottom-right');
  const [vendorLogoPosition, setVendorLogoPosition] = useState('bottom-left');
  const [platformLogoThroughout, setPlatformLogoThroughout] = useState(true);
  const [vendorLogoThroughout, setVendorLogoThroughout] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState<string | null>(null);
  const [followCtaEnabled, setFollowCtaEnabled] = useState(true);
  const [followCtaText, setFollowCtaText] = useState('Follow us');
  const [followCtaStart, setFollowCtaStart] = useState<number | ''>('');
  const [followCtaDuration, setFollowCtaDuration] = useState(4);
  const [followCtaRepeat, setFollowCtaRepeat] = useState<number | ''>('');
  const [introFrameUrl, setIntroFrameUrl] = useState('');
  const [outroFrameUrl, setOutroFrameUrl] = useState('');
  const [introDuration, setIntroDuration] = useState(3);
  const [outroDuration, setOutroDuration] = useState(5);
  const [introPrompt, setIntroPrompt] = useState('');
  const [outroPrompt, setOutroPrompt] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMediaUrl, setPreviewMediaUrl] = useState('');
  const [backgroundMusicTrackId, setBackgroundMusicTrackId] = useState<string | null>(null);
  const [editSection, setEditSection] = useState<'publishing' | 'studio'>('publishing');
  const [includeIntro, setIncludeIntro] = useState(false);
  const [includeOutro, setIncludeOutro] = useState(false);
  // True when logos/CTA/frames changed since last successful bake — Apply or Save bakes once.
  const [brandingDirty, setBrandingDirty] = useState(false);
  const { toast } = useToast();
  const initializedForId = useRef<string | null>(null);
  const suppressDirtyRef = useRef(false);

  const markBrandingDirty = () => {
    if (!suppressDirtyRef.current) setBrandingDirty(true);
  };

  const setWatermarkLogoUrlTracked = (value: string) => {
    setWatermarkLogoUrl(value);
    markBrandingDirty();
  };
  const setVendorLogoUrlTracked = (value: string) => {
    setVendorLogoUrl(value);
    markBrandingDirty();
  };
  const setWatermarkWebsiteUrlTracked = (value: string) => {
    setWatermarkWebsiteUrl(value);
    markBrandingDirty();
  };
  const setWatermarkPositionTracked = (value: string) => {
    setWatermarkPosition(value);
    markBrandingDirty();
  };
  const setVendorLogoPositionTracked = (value: string) => {
    setVendorLogoPosition(value);
    markBrandingDirty();
  };
  const setPlatformLogoThroughoutTracked = (value: boolean) => {
    setPlatformLogoThroughout(value);
    markBrandingDirty();
  };
  const setVendorLogoThroughoutTracked = (value: boolean) => {
    setVendorLogoThroughout(value);
    markBrandingDirty();
  };
  const setFollowCtaEnabledTracked = (value: boolean) => {
    setFollowCtaEnabled(value);
    markBrandingDirty();
  };
  const setFollowCtaTextTracked = (value: string) => {
    setFollowCtaText(value);
    markBrandingDirty();
  };
  const setFollowCtaStartTracked = (value: number | '') => {
    setFollowCtaStart(value);
    markBrandingDirty();
  };
  const setFollowCtaDurationTracked = (value: number) => {
    setFollowCtaDuration(value);
    markBrandingDirty();
  };
  const setFollowCtaRepeatTracked = (value: number | '') => {
    setFollowCtaRepeat(value);
    markBrandingDirty();
  };
  const setIntroFrameUrlTracked = (url: string) => {
    setIntroFrameUrl(url);
    markBrandingDirty();
  };
  const setOutroFrameUrlTracked = (url: string) => {
    setOutroFrameUrl(url);
    markBrandingDirty();
  };
  const setIntroDurationTracked = (value: number) => {
    setIntroDuration(value);
    markBrandingDirty();
  };
  const setOutroDurationTracked = (value: number) => {
    setOutroDuration(value);
    markBrandingDirty();
  };
  const setIntroPromptTracked = (value: string) => {
    setIntroPrompt(value);
    markBrandingDirty();
  };
  const setOutroPromptTracked = (value: string) => {
    setOutroPrompt(value);
    markBrandingDirty();
  };
  const setBackgroundMusicTrackIdTracked = (trackId: string | null) => {
    setBackgroundMusicTrackId(trackId);
    markBrandingDirty();
  };

  useEffect(() => {
    if (!open || !content) {
      initializedForId.current = null;
      return;
    }
    // Apply-to-video updates the same content record. Do not reset unsaved logos/CTA/frames.
    if (initializedForId.current === content.id) return;
    initializedForId.current = content.id;
    setEditSection('publishing');

    suppressDirtyRef.current = true;
    setAdminDescription(content.admin_description || '');
    setAdminNotes(content.admin_notes || '');
    const normalizedPlatform =
      content.platform === 'twitter' || content.platform === 'linkedin'
        ? DEFAULT_CONTENT_PLATFORM
        : coerceActiveContentPlatform(content.platform);
    setPlatform(normalizedPlatform);
    setWatermarkLogoUrl(content.watermark_logo_url || '');
    setVendorLogoUrl(content.vendor_logo_url || '');
    setWatermarkWebsiteUrl(content.watermark_website_url || '');
    setWatermarkPosition(content.watermark_position || 'bottom-right');
    setVendorLogoPosition(content.vendor_logo_position || 'bottom-left');
    setPlatformLogoThroughout(content.platform_logo_throughout !== false);
    setVendorLogoThroughout(content.vendor_logo_throughout === true);
    setFollowCtaEnabled(false);
    setFollowCtaText('Follow us');
    setFollowCtaStart('');
    setFollowCtaDuration(4);
    setFollowCtaRepeat('');
    setIntroFrameUrl(content.intro_frame_url || '');
    setOutroFrameUrl(content.outro_frame_url || '');
    setIncludeIntro(Boolean(content.intro_frame_url));
    setIncludeOutro(Boolean(content.outro_frame_url));
    setIntroDuration(content.intro_frame_duration || 3);
    setOutroDuration(content.outro_frame_duration || 5);
    setIntroPrompt('');
    setOutroPrompt('');
    setBrandingDirty(false);
    setPreviewMediaUrl(content.enhanced_media_url || content.media_url || '');
    setBackgroundMusicTrackId(content.background_music_track_id ?? null);
    suppressDirtyRef.current = false;
  }, [open, content]);

  const syncAppliedMedia = (updated: ContentItem) => {
    const nextMedia = updated.enhanced_media_url || updated.media_url || '';
    if (nextMedia) {
      setPreviewMediaUrl(`${nextMedia}${nextMedia.includes('?') ? '&' : '?'}t=${Date.now()}`);
    }
    suppressDirtyRef.current = true;
    setIncludeIntro(Boolean(updated.intro_frame_url));
    setIncludeOutro(Boolean(updated.outro_frame_url));
    setIntroFrameUrl(updated.intro_frame_url || '');
    setOutroFrameUrl(updated.outro_frame_url || '');
    if (updated.intro_frame_duration != null) setIntroDuration(updated.intro_frame_duration);
    if (updated.outro_frame_duration != null) setOutroDuration(updated.outro_frame_duration);
    if (updated.watermark_logo_url != null) setWatermarkLogoUrl(updated.watermark_logo_url || '');
    if (updated.vendor_logo_url != null) setVendorLogoUrl(updated.vendor_logo_url || '');
    if (updated.watermark_website_url != null) setWatermarkWebsiteUrl(updated.watermark_website_url || '');
    if (updated.watermark_position) setWatermarkPosition(updated.watermark_position);
    if (updated.vendor_logo_position) setVendorLogoPosition(updated.vendor_logo_position);
    if (updated.platform_logo_throughout != null) {
      setPlatformLogoThroughout(updated.platform_logo_throughout !== false);
    }
    if (updated.vendor_logo_throughout != null) {
      setVendorLogoThroughout(updated.vendor_logo_throughout === true);
    }
    if (updated.background_music_track_id !== undefined) {
      setBackgroundMusicTrackId(updated.background_music_track_id ?? null);
    }
    suppressDirtyRef.current = false;
    setBrandingDirty(false);
    onContentUpdated?.(updated);
  };

  const handleGenerateCaption = async () => {
    
    if (!content) {
      console.error('No content available');
      toast({
        title: 'Error',
        description: 'No content selected. Please try again.',
        variant: 'destructive',
      });
      return;
    }
    
    setGenerating(true);
    console.log('Starting caption generation...');
    
    try {
      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('Auth error:', authError);
        throw new Error('You must be logged in to generate captions. Please refresh the page and try again.');
      }

      console.log('Generating caption with:', {
        userDescription: content.description || '',
        title: content.title,
        platform: platform,
        mediaType: content.media_type || 'image',
        userId: user.id
      });

      const data = await invokeBackend<{ success?: boolean; caption?: string; error?: string }>('generate-caption', {
        userDescription: content.description || '',
        title: content.title,
        platform: platform,
        mediaType: content.media_type || 'image',
      });

      console.log('Generate caption response:', data);

      if (!data) {
        throw new Error('No response from the local backend. Check the backend terminal on port 8081.');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.success && data?.caption) {
        console.log('Caption generated successfully:', data.caption.substring(0, 50));
        // AI-generated content is admin-written content - save to admin_description
        setAdminDescription(data.caption);
        toast({
          title: 'Caption Generated',
          description: 'AI has generated an optimized caption. This is now your admin-written caption.',
        });
      } else if (data?.caption) {
        // Some functions might return caption directly without success flag
        console.log('Caption received (without success flag):', data.caption.substring(0, 50));
        // AI-generated content is admin-written content - save to admin_description
        setAdminDescription(data.caption);
        toast({
          title: 'Caption Generated',
          description: 'AI has generated an optimized caption. This is now your admin-written caption.',
        });
      } else {
        throw new Error(data?.error || 'Failed to generate caption. The function did not return a caption.');
      }
    } catch (error: unknown) {
      // Safely log the error
        console.error('Error generating caption:', error);
      
      // Extract more detailed error information
      const message = errorMessage(error, 'Could not generate caption.');
      let errorDescription = message;
      
      if (message.includes('Failed to fetch') || message.includes('ECONNREFUSED') || message.includes('Cannot reach the local backend')) {
        errorDescription = 'Backend is not reachable. Start it with: cd backend && npm run dev (port 8081).';
      } else if (message.includes('is missing from backend/.env') || message.includes('not configured')) {
        errorDescription = 'GEMINI_API_KEY is missing from backend/.env. Add the key and restart the backend.';
      } else if (message.includes('401') || message.includes('Unauthorized') || message.includes('expired token')) {
        errorDescription = 'Authentication failed. Your session may have expired. Please refresh the page and log in again.';
      }
      
      toast({
        title: 'Generation Failed',
        description: errorDescription,
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
      console.log('Caption generation finished');
    }
  };

  const handleLogoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'platform' | 'vendor',
  ) => {
    const file = e.target.files?.[0];
    if (!file || !content) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload an image file (PNG, JPG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    setUploadingLogo(kind);
    try {
      const asset = await uploadAdminAsset(file, {
        category: kind === 'platform' ? 'platform_logo' : 'vendor_logo',
      });
      const publicUrl = asset.file_url;

      if (kind === 'platform') {
        setWatermarkLogoUrlTracked(publicUrl);
        setPlatformLogoThroughoutTracked(true);
      } else setVendorLogoUrlTracked(publicUrl);
      const uploadedForVideo = content.media_type === 'video'
        || /\.(mp4|mov|webm|avi|mkv)(\?|$)/i.test(content.media_url || content.enhanced_media_url || '');
      toast({
        title: 'Logo Uploaded',
        description: uploadedForVideo
          ? 'Logo ready. Click Apply to video once — that saves the branded clip.'
          : 'Logo ready. Click Apply to image once — that saves the branded image.',
      });
    } catch (error: unknown) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Upload Failed',
        description: errorMessage(error, 'Could not upload logo. Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(null);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminDescription.trim()) {
      toast({
        title: 'Caption Required',
        description: 'Please write a post caption. This is required for publishing.',
        variant: 'destructive',
      });
      return;
    }

    if (!content) return;

    setSaving(true);
    try {
      await onSave(
        adminDescription,
        adminNotes,
        platform,
        watermarkLogoUrl || undefined,
        vendorLogoUrl || undefined,
        watermarkWebsiteUrl || undefined,
        watermarkPosition,
        vendorLogoPosition,
        {
          intro_frame_url: introFrameUrl || null,
          outro_frame_url: outroFrameUrl || null,
          intro_frame_duration: introDuration,
          outro_frame_duration: outroDuration,
        },
        {
          platform_logo_throughout: platformLogoThroughout,
          vendor_logo_throughout: vendorLogoThroughout,
        },
        {
          background_music_track_id: backgroundMusicTrackId,
          background_music_volume: 1,
        },
      );

      const hasMusicWork = (backgroundMusicTrackId ?? null) !== (content.background_music_track_id ?? null);
      // Only bake when branding changed since last Apply/Save — never re-encode an already-saved video.
      const wantsIntroBake = includeIntro && Boolean(introFrameUrl || introPrompt.trim());
      const wantsOutroBake = includeOutro && Boolean(outroFrameUrl || outroPrompt.trim());
      const hasBrandingWork = Boolean(
        watermarkLogoUrl
        || vendorLogoUrl
        || wantsIntroBake
        || wantsOutroBake
        || followCtaEnabled
        || platformLogoThroughout !== (content.platform_logo_throughout !== false)
        || vendorLogoThroughout !== (content.vendor_logo_throughout === true)
        || hasMusicWork,
      );
      if (brandingDirty && hasBrandingWork) {
        toast({
          title: 'Saving branded video',
          description: 'Baking your selected branding into the media once…',
        });

        const data = await invokeBackend<{
          success?: boolean;
          error?: string;
          content?: ContentItem;
        }>('apply-template-frames', {
          contentId: content.id,
          introFrameUrl: wantsIntroBake ? (introFrameUrl || null) : null,
          outroFrameUrl: wantsOutroBake ? (outroFrameUrl || null) : null,
          introDuration,
          outroDuration,
          introPrompt: wantsIntroBake ? (introPrompt.trim() || null) : null,
          outroPrompt: wantsOutroBake ? (outroPrompt.trim() || null) : null,
          branding: {
            company_logo_url: watermarkLogoUrl || null,
            vendor_logo_url: vendorLogoUrl || null,
            company_website_url: watermarkWebsiteUrl || null,
            watermark_position: watermarkPosition,
            vendor_logo_position: vendorLogoPosition,
            follow_cta_enabled: followCtaEnabled,
            follow_cta_text: followCtaText || 'Follow us',
            follow_cta_start_seconds: followCtaStart === '' ? null : Number(followCtaStart),
            follow_cta_duration: followCtaDuration,
            follow_cta_repeat_seconds: followCtaRepeat === '' ? null : Number(followCtaRepeat),
            platform_logo_throughout: platformLogoThroughout,
            vendor_logo_throughout: vendorLogoThroughout,
            watermark_enabled: true,
          },
          backgroundMusicTrackId: backgroundMusicTrackId || null,
          backgroundMusicVolume: 1,
        });

        if (!data?.success) {
          throw new Error(data?.error || 'Could not apply branding to the media.');
        }

        if (data.content) {
          syncAppliedMedia(data.content);
        }

        toast({
          title: 'Saved with full branding',
          description: 'Branded media is saved. No need to apply again.',
        });
      }

      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: 'Could not save branding',
        description: errorMessage(error, 'Logo positions were not applied. Try again.'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!content) return null;

  const displayMedia = previewMediaUrl || content.enhanced_media_url || content.media_url;
  // Detect if content is a video - check media_type first, then file extension
  const isVideo = content.media_type === 'video' || 
                 displayMedia?.toLowerCase().includes('.mp4') || 
                 displayMedia?.toLowerCase().includes('.mov') || 
                 displayMedia?.toLowerCase().includes('.webm') ||
                 displayMedia?.toLowerCase().includes('.avi') ||
                 displayMedia?.toLowerCase().includes('.mkv') ||
                 content.media_url?.toLowerCase().includes('video');

  const brandingBaked = Boolean(content.template_frames_applied) && !brandingDirty;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogFullscreenContent className="overflow-hidden">
        <div className="flex flex-col flex-1 min-h-0 h-full">
          <DialogHeader className="flex-shrink-0 space-y-0 border-b border-border/70 bg-card/50 backdrop-blur-xl px-4 sm:px-5 py-3 pr-14">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between min-w-0">
              <div className="min-w-0 pr-2">
                <DialogTitle className="text-base sm:text-lg font-semibold truncate text-left tracking-tight">
                  {content.title}
                </DialogTitle>
              </div>
              {isVideo && (
                <Tabs
                  value={editSection}
                  onValueChange={(v) => setEditSection(v as 'publishing' | 'studio')}
                  className="w-full lg:w-auto shrink-0"
                >
                  <TabsList className="grid w-full lg:w-[min(400px,100%)] grid-cols-2 h-10 p-1 bg-secondary/50 border border-border/60">
                    <TabsTrigger
                      value="publishing"
                      className="text-xs sm:text-sm truncate px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      Publishing
                    </TabsTrigger>
                    <TabsTrigger
                      value="studio"
                      className="text-xs sm:text-sm truncate gap-1.5 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      <Film className="w-3.5 h-3.5 shrink-0 opacity-80" />
                      Video studio
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>
          </DialogHeader>

          <div
            className={cn(
              'flex-1 min-h-0 flex flex-col overflow-hidden',
              isVideo && editSection === 'studio' ? 'p-2 sm:p-3 bg-[hsl(222_47%_4%)]' : 'px-4 sm:px-6 py-4',
            )}
          >
        {isVideo && editSection === 'studio' && (
          <div className="flex-1 min-h-0 flex flex-col">
            <VideoEditorStudio
              layout="embedded"
              fillViewport
              contentId={content.id}
              mediaUrl={displayMedia || content.media_url}
              mediaType={content.media_type}
              initialPlatform={resolveEditorPlatform(platform)}
              savedTimeline={(content as ContentItem & { editor_timeline?: EditorTimeline | null }).editor_timeline}
              replaceOptions={[{ id: content.id, title: content.title, status: content.status }]}
              linkedContent={content}
              captionOverride={adminDescription}
              platformOverride={platform}
              onPublishContent={publishToSocial}
              onContentSynced={(updated) => onContentUpdated?.({ ...content, ...updated })}
              onSaved={() => onContentUpdated?.(content)}
              onExportComplete={() => onContentUpdated?.(content)}
            />
          </div>
        )}

        {(!isVideo || editSection === 'publishing') && (
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 min-w-0">
          <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1 space-y-5 min-w-0 pb-4">
          {/* Platform Selection */}
          <div className="space-y-2">
            <Label>Social Media Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {ACTIVE_CONTENT_PLATFORMS.map((id) => (
                  <SelectItem key={id} value={id}>
                    <div className="flex items-center gap-2">
                      <Youtube className="w-4 h-4" />
                      {ACTIVE_CONTENT_PLATFORM_LABELS[id]}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
            {/* Media Preview */}
            <div className="space-y-2 min-w-0">
              <Label>Preview</Label>
              <div className="bg-secondary rounded-lg overflow-hidden">
                {displayMedia ? (
                  (() => {
                    const isVideo = displayMedia.includes('.mp4') || 
                                   displayMedia.includes('.mov') || 
                                   displayMedia.includes('.webm') || 
                                   displayMedia.includes('.avi') ||
                                   displayMedia.includes('.mkv') ||
                                   content.media_url?.toLowerCase().includes('video');
                    return isVideo ? (
                      <VideoPlayer
                        key={displayMedia}
                        src={displayMedia}
                        controls
                        muted
                        watermarkLogoUrl={watermarkLogoUrl || undefined}
                        vendorLogoUrl={vendorLogoUrl || undefined}
                        watermarkWebsiteUrl={watermarkWebsiteUrl || undefined}
                        watermarkPosition={watermarkPosition}
                        vendorLogoPosition={vendorLogoPosition}
                        platformLogoThroughout={platformLogoThroughout}
                        vendorLogoThroughout={vendorLogoThroughout}
                        introFrameUrl={includeIntro ? (introFrameUrl || undefined) : undefined}
                        outroFrameUrl={includeOutro ? (outroFrameUrl || undefined) : undefined}
                        introDuration={introDuration}
                        outroDuration={outroDuration}
                        previewTemplateFrames={!brandingBaked}
                        brandingBaked={brandingBaked}
                      />
                    ) : (
                      <ImageViewer
                        src={displayMedia}
                        alt={content.title}
                        watermarkLogoUrl={watermarkLogoUrl || undefined}
                        vendorLogoUrl={vendorLogoUrl || undefined}
                        watermarkWebsiteUrl={watermarkWebsiteUrl || undefined}
                        watermarkPosition={watermarkPosition}
                        vendorLogoPosition={vendorLogoPosition}
                        brandingBaked={brandingBaked}
                      />
                    );
                  })()
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 min-w-0">
              <Label>User description</Label>
              <div className="p-3 bg-secondary rounded-lg min-h-[120px]">
                <p className="text-sm text-muted-foreground break-words">
                  {content.description || 'No description provided'}
                </p>
              </div>
            </div>
          </div>

          {/* Admin Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="admin-description">Caption *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleGenerateCaption();
                }}
                disabled={generating}
                className="flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Generate with AI
                  </>
                )}
              </Button>
            </div>
            <Textarea
              id="admin-description"
              placeholder="Write the caption to publish…"
              value={adminDescription}
              onChange={(e) => setAdminDescription(e.target.value)}
              rows={5}
              className="bg-secondary border-border resize-none"
              required
            />
          </div>

          {/* Admin Notes */}
          <div className="space-y-2">
            <Label htmlFor="admin-notes">Internal notes</Label>
            <Textarea
              id="admin-notes"
              placeholder="Add any internal notes about this content..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              className="bg-secondary border-border resize-none"
            />
          </div>

          {isVideo && (
            <BackgroundMusicSection
              selectedTrackId={backgroundMusicTrackId}
              onSelectedTrackIdChange={setBackgroundMusicTrackIdTracked}
              disabled={saving}
            />
          )}

          <TemplateFramesSection
            content={content}
            platform={platform}
            isVideo={isVideo}
            backgroundMusicTrackId={backgroundMusicTrackId}
            watermarkLogoUrl={watermarkLogoUrl}
            vendorLogoUrl={vendorLogoUrl}
            watermarkWebsiteUrl={watermarkWebsiteUrl}
            watermarkPosition={watermarkPosition}
            vendorLogoPosition={vendorLogoPosition}
            uploadingLogo={uploadingLogo}
            onWatermarkLogoUrlChange={setWatermarkLogoUrlTracked}
            onVendorLogoUrlChange={setVendorLogoUrlTracked}
            onWatermarkWebsiteUrlChange={setWatermarkWebsiteUrlTracked}
            onWatermarkPositionChange={setWatermarkPositionTracked}
            onVendorLogoPositionChange={setVendorLogoPositionTracked}
            platformLogoThroughout={platformLogoThroughout}
            vendorLogoThroughout={vendorLogoThroughout}
            onPlatformLogoThroughoutChange={setPlatformLogoThroughoutTracked}
            onVendorLogoThroughoutChange={setVendorLogoThroughoutTracked}
            onPlatformLogoFile={(e) => handleLogoUpload(e, 'platform')}
            onVendorLogoFile={(e) => handleLogoUpload(e, 'vendor')}
            followCtaEnabled={followCtaEnabled}
            followCtaText={followCtaText}
            followCtaStart={followCtaStart}
            followCtaDuration={followCtaDuration}
            followCtaRepeat={followCtaRepeat}
            onFollowCtaEnabledChange={setFollowCtaEnabledTracked}
            onFollowCtaTextChange={setFollowCtaTextTracked}
            onFollowCtaStartChange={setFollowCtaStartTracked}
            onFollowCtaDurationChange={setFollowCtaDurationTracked}
            onFollowCtaRepeatChange={setFollowCtaRepeatTracked}
            introFrameUrl={introFrameUrl}
            outroFrameUrl={outroFrameUrl}
            introDuration={introDuration}
            outroDuration={outroDuration}
            introPrompt={introPrompt}
            outroPrompt={outroPrompt}
            onIntroFrameUrlChange={setIntroFrameUrlTracked}
            onOutroFrameUrlChange={setOutroFrameUrlTracked}
            onIntroDurationChange={setIntroDurationTracked}
            onOutroDurationChange={setOutroDurationTracked}
            onIntroPromptChange={setIntroPromptTracked}
            onOutroPromptChange={setOutroPromptTracked}
            includeIntro={includeIntro}
            includeOutro={includeOutro}
            onIncludeIntroChange={(v) => {
              setIncludeIntro(v);
              markBrandingDirty();
            }}
            onIncludeOutroChange={(v) => {
              setIncludeOutro(v);
              markBrandingDirty();
            }}
            onApplied={syncAppliedMedia}
          />

          </div>

          <DialogFooter className="flex-shrink-0 flex-wrap gap-2 pt-4 border-t border-border bg-card/80 backdrop-blur -mx-4 sm:-mx-6 px-4 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="min-w-0">
              Cancel
            </Button>
            {isVideo && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditSection('studio')}
                disabled={saving}
                className="min-w-0"
              >
                <Clapperboard className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">Video studio</span>
              </Button>
            )}
            {(content.enhanced_media_url || content.media_url) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setExportOpen(true)}
                disabled={saving || content.preprocessing_status === 'pending'}
                className="min-w-0"
              >
                <Download className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">Download</span>
              </Button>
            )}
            <Button type="submit" className="glow min-w-0 sm:ml-auto" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" />
                  Saving…
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
        )}
          </div>
        </div>
      </DialogFullscreenContent>
    </Dialog>
    <ExportPostDialog
      open={exportOpen}
      onOpenChange={setExportOpen}
      content={content}
      captionOverride={adminDescription}
      platformOverride={platform}
    />
    </>
  );
}
