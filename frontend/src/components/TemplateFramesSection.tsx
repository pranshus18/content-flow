import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TemplateFrameAiPrompt } from '@/components/TemplateFrameAiPrompt';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { invokeBackend } from '@/lib/backend';
import { errorMessage } from '@/lib/utils';
import type { ContentItem } from '@/hooks/useContent';
import { AssetPickerDialog } from '@/components/AssetPickerDialog';
import type { AdminAsset, AdminAssetCategory } from '@/lib/adminAssets';
import { uploadAdminAsset } from '@/lib/adminAssets';
import {
  Clapperboard,
  FolderOpen,
  ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  Link as LinkIcon,
  Wand2,
} from 'lucide-react';

type FramePosition = 'intro' | 'outro';

interface TemplateFramesSectionProps {
  content: ContentItem;
  platform: string;
  isVideo: boolean;
  // Logos
  watermarkLogoUrl: string;
  vendorLogoUrl: string;
  watermarkWebsiteUrl: string;
  watermarkPosition: string;
  vendorLogoPosition: string;
  platformLogoThroughout: boolean;
  vendorLogoThroughout: boolean;
  onPlatformLogoThroughoutChange: (value: boolean) => void;
  onVendorLogoThroughoutChange: (value: boolean) => void;
  uploadingLogo: string | null;
  onWatermarkLogoUrlChange: (value: string) => void;
  onVendorLogoUrlChange: (value: string) => void;
  onWatermarkWebsiteUrlChange: (value: string) => void;
  onWatermarkPositionChange: (value: string) => void;
  onVendorLogoPositionChange: (value: string) => void;
  onPlatformLogoFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVendorLogoFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // Follow CTA
  followCtaEnabled: boolean;
  followCtaText: string;
  followCtaStart: number | '';
  followCtaDuration: number;
  followCtaRepeat: number | '';
  onFollowCtaEnabledChange: (value: boolean) => void;
  onFollowCtaTextChange: (value: string) => void;
  onFollowCtaStartChange: (value: number | '') => void;
  onFollowCtaDurationChange: (value: number) => void;
  onFollowCtaRepeatChange: (value: number | '') => void;
  // Intro / outro (video)
  introFrameUrl: string;
  outroFrameUrl: string;
  introDuration: number;
  outroDuration: number;
  introPrompt: string;
  outroPrompt: string;
  onIntroFrameUrlChange: (url: string) => void;
  onOutroFrameUrlChange: (url: string) => void;
  onIntroDurationChange: (value: number) => void;
  onOutroDurationChange: (value: number) => void;
  onIntroPromptChange: (value: string) => void;
  onOutroPromptChange: (value: string) => void;
  backgroundMusicTrackId?: string | null;
  onApplied?: (updated: ContentItem) => void;
}

export function TemplateFramesSection({
  content,
  platform,
  isVideo,
  watermarkLogoUrl,
  vendorLogoUrl,
  watermarkWebsiteUrl,
  watermarkPosition,
  vendorLogoPosition,
  platformLogoThroughout,
  vendorLogoThroughout,
  onPlatformLogoThroughoutChange,
  onVendorLogoThroughoutChange,
  uploadingLogo,
  onWatermarkLogoUrlChange,
  onVendorLogoUrlChange,
  onWatermarkWebsiteUrlChange,
  onWatermarkPositionChange,
  onVendorLogoPositionChange,
  onPlatformLogoFile,
  onVendorLogoFile,
  followCtaEnabled,
  followCtaText,
  followCtaStart,
  followCtaDuration,
  followCtaRepeat,
  onFollowCtaEnabledChange,
  onFollowCtaTextChange,
  onFollowCtaStartChange,
  onFollowCtaDurationChange,
  onFollowCtaRepeatChange,
  introFrameUrl,
  outroFrameUrl,
  introDuration,
  outroDuration,
  introPrompt,
  outroPrompt,
  onIntroFrameUrlChange,
  onOutroFrameUrlChange,
  onIntroDurationChange,
  onOutroDurationChange,
  onIntroPromptChange,
  onOutroPromptChange,
  backgroundMusicTrackId = null,
  onApplied,
}: TemplateFramesSectionProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [assetPickerTarget, setAssetPickerTarget] = useState<
    'platform_logo' | 'vendor_logo' | 'intro_frame' | 'outro_frame' | null
  >(null);

  const hasLogos = Boolean(watermarkLogoUrl || vendorLogoUrl);
  const branding = {
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
  };

  const generateOne = async (position: FramePosition) => {
    const prompt = (position === 'intro' ? introPrompt : outroPrompt).trim();
    if (!prompt) {
      toast({
        title: `Add an ${position} prompt`,
        description: `Describe the ${position} you want, then click Generate ${position}.`,
      });
      return;
    }
    setBusy(`${position}-ai`);
    try {
      const data = await invokeBackend<{
        success?: boolean;
        frameUrl?: string;
        error?: string;
        model?: string;
      }>('generate-template-frame', {
        position,
        contentId: content.id,
        platform,
        title: content.title,
        prompt,
        stylePrompt: prompt,
        useAi: true,
        saveTo: 'none',
        branding,
      });
      if (!data?.frameUrl) {
        throw new Error(data?.error || `No ${position} frame was returned.`);
      }
      if (position === 'intro') onIntroFrameUrlChange(data.frameUrl);
      else onOutroFrameUrlChange(data.frameUrl);
      toast({
        title: `${position === 'intro' ? 'Intro' : 'Outro'} generated`,
        description: `Only the ${position} was updated. The other frame is unchanged${data.model ? ` (${data.model})` : ''}.`,
      });
    } catch (error: unknown) {
      toast({
        title: `Could not generate ${position}`,
        description: errorMessage(error, 'Template generation failed.'),
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const uploadFrame = async (position: FramePosition, file: File) => {
    setBusy(`${position}-upload`);
    try {
      const asset = await uploadAdminAsset(file, { category: 'template_frame' });
      if (position === 'intro') onIntroFrameUrlChange(asset.file_url);
      else onOutroFrameUrlChange(asset.file_url);
      toast({
        title: 'Frame uploaded',
        description: `Custom ${position} is ready. Click Apply once to save it into the video.`,
      });
    } catch (error: unknown) {
      toast({
        title: 'Upload failed',
        description: errorMessage(error, 'Could not upload the template image.'),
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    const introP = introPrompt.trim() || null;
    const outroP = outroPrompt.trim() || null;
    const hasMusicWork = isVideo && (
      Boolean(backgroundMusicTrackId)
      || (backgroundMusicTrackId ?? null) !== (content.background_music_track_id ?? null)
    );
    if (!hasLogos && !introP && !outroP && !introFrameUrl && !outroFrameUrl && !followCtaEnabled && !hasMusicWork) {
      toast({
        title: 'Add branding or music first',
        description: 'Upload logos, generate intro/outro frames, or pick background music, then Apply.',
      });
      return;
    }

    setBusy('apply');
    try {
      toast({
        title: 'Applying branding…',
        description: isVideo
          ? 'Baking logos, intro, and outro into the video in one pass.'
          : 'Baking logos into the image.',
      });
      const data = await invokeBackend<{
        success?: boolean;
        error?: string;
        content?: ContentItem;
      }>('apply-template-frames', {
        contentId: content.id,
        introFrameUrl: isVideo ? (introFrameUrl || null) : null,
        outroFrameUrl: isVideo ? (outroFrameUrl || null) : null,
        introDuration,
        outroDuration,
        introPrompt: introP,
        outroPrompt: outroP,
        branding,
        platform,
        backgroundMusicTrackId: isVideo ? (backgroundMusicTrackId || null) : undefined,
        backgroundMusicVolume: isVideo ? 1 : undefined,
      });
      if (!data?.success || !data.content) {
        throw new Error(data?.error || 'Could not apply branding.');
      }
      // Parent syncs frame URLs + clears dirty — do not call frame setters here (would re-mark dirty).
      onApplied?.(data.content);
      toast({
        title: isVideo ? 'Video saved' : 'Image saved',
        description: isVideo
          ? `Branded clip saved with logos, ${introDuration}s intro, and ${outroDuration}s outro. No need to save again.`
          : 'Branded image saved. No need to save again.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Could not apply branding',
        description: errorMessage(error, 'Branding failed.'),
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const locked = busy !== null || uploadingLogo !== null;

  const assetPickerCategories: AdminAssetCategory[] | undefined = (() => {
    if (assetPickerTarget === 'platform_logo') return ['platform_logo', 'other'];
    if (assetPickerTarget === 'vendor_logo') return ['vendor_logo', 'other'];
    if (assetPickerTarget === 'intro_frame' || assetPickerTarget === 'outro_frame') {
      return ['template_frame', 'other'];
    }
    return undefined;
  })();

  const applyAssetFromLibrary = (asset: AdminAsset) => {
    switch (assetPickerTarget) {
      case 'platform_logo':
        onWatermarkLogoUrlChange(asset.file_url);
        if (isVideo) onPlatformLogoThroughoutChange(true);
        break;
      case 'vendor_logo':
        onVendorLogoUrlChange(asset.file_url);
        break;
      case 'intro_frame':
        onIntroFrameUrlChange(asset.file_url);
        break;
      case 'outro_frame':
        onOutroFrameUrlChange(asset.file_url);
        break;
      default:
        break;
    }
    setAssetPickerTarget(null);
    toast({
      title: 'Asset selected',
      description: 'Click Apply to bake this into the media when you are ready.',
    });
  };

  return (
    <div className="space-y-5 p-4 bg-primary/5 rounded-lg border border-primary/20 min-w-0 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Clapperboard className="w-4 h-4 text-primary" />
            <Label className="text-base font-semibold">Ready-to-post branding</Label>
            {content.template_frames_applied && (
              <Badge variant="outline" className="text-xs">Applied</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isVideo
              ? 'Generate intro and outro if you want them, then click Apply to video once — that saves the branded clip.'
              : 'Set logos here — then Apply once to save the branded image.'}
          </p>
          {isVideo && (
            <p className="text-xs text-foreground">
              Package: {hasLogos ? 'logos' : 'no logos'} · {introDuration}s intro + {outroDuration}s outro
            </p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={apply}
          disabled={locked}
          className="flex items-center gap-2 shrink-0 w-full sm:w-auto"
        >
          {busy === 'apply' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isVideo ? 'Apply to video' : 'Apply to image'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
        <EditLogoField
          id="platform-logo"
          label="Platform / company logo"
          value={watermarkLogoUrl}
          uploading={uploadingLogo === 'platform'}
          disabled={locked}
          onUrlChange={onWatermarkLogoUrlChange}
          onFileChange={onPlatformLogoFile}
          onLibraryClick={() => setAssetPickerTarget('platform_logo')}
          videoPlacement={isVideo && watermarkLogoUrl ? {
            throughout: platformLogoThroughout,
            onThroughoutChange: onPlatformLogoThroughoutChange,
          } : undefined}
        />
        <EditLogoField
          id="vendor-logo"
          label="Vendor logo"
          value={vendorLogoUrl}
          uploading={uploadingLogo === 'vendor'}
          disabled={locked}
          onUrlChange={onVendorLogoUrlChange}
          onFileChange={onVendorLogoFile}
          onLibraryClick={() => setAssetPickerTarget('vendor_logo')}
          videoPlacement={isVideo && vendorLogoUrl ? {
            throughout: vendorLogoThroughout,
            onThroughoutChange: onVendorLogoThroughoutChange,
          } : undefined}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="watermark-website">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4" />
            Company Website URL
          </div>
        </Label>
        <Input
          id="watermark-website"
          type="url"
          placeholder="https://yourcompany.com"
          value={watermarkWebsiteUrl}
          onChange={(e) => onWatermarkWebsiteUrlChange(e.target.value)}
          disabled={locked}
          className="bg-secondary border-border"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="watermark-position">Platform logo position</Label>
          <Select value={watermarkPosition} onValueChange={onWatermarkPositionChange} disabled={locked}>
            <SelectTrigger id="watermark-position" className="bg-secondary border-border">
              <SelectValue placeholder="Select position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top-left">Top Left</SelectItem>
              <SelectItem value="top-right">Top Right</SelectItem>
              <SelectItem value="bottom-left">Bottom Left</SelectItem>
              <SelectItem value="bottom-right">Bottom Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="vendor-logo-position">Vendor logo position</Label>
          <Select value={vendorLogoPosition} onValueChange={onVendorLogoPositionChange} disabled={locked}>
            <SelectTrigger id="vendor-logo-position" className="bg-secondary border-border">
              <SelectValue placeholder="Select position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top-left">Top Left</SelectItem>
              <SelectItem value="top-right">Top Right</SelectItem>
              <SelectItem value="bottom-left">Bottom Left</SelectItem>
              <SelectItem value="bottom-right">Bottom Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Each logo can sit in any corner. If both use the same corner, they stack so both stay visible.
        {isVideo && (
          <> Company logo defaults to the full main clip; vendor logo can stay intro/outro only or run throughout.</>
        )}
      </p>

      <div className="space-y-3 pt-2 border-t border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <Label>Repeatable CTA at a particular second</Label>
            <p className="text-xs text-muted-foreground">
              {isVideo
                ? 'Show a CTA at a timestamp, optionally repeating every N seconds.'
                : 'Baked onto the image.'}
            </p>
          </div>
          <Switch checked={followCtaEnabled} onCheckedChange={onFollowCtaEnabledChange} disabled={locked} />
        </div>
        {followCtaEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="follow-cta-text">CTA text</Label>
              <Input
                id="follow-cta-text"
                placeholder="Follow us"
                value={followCtaText}
                onChange={(e) => onFollowCtaTextChange(e.target.value)}
                disabled={locked}
                className="bg-secondary border-border"
              />
            </div>
            {isVideo && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="follow-cta-start">Show at (seconds)</Label>
                  <Input
                    id="follow-cta-start"
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="Auto (mid-video)"
                    value={followCtaStart}
                    onChange={(e) => {
                      const raw = e.target.value;
                      onFollowCtaStartChange(raw === '' ? '' : Number(raw));
                    }}
                    disabled={locked}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="follow-cta-duration">Stay on screen</Label>
                  <Input
                    id="follow-cta-duration"
                    type="number"
                    min={1}
                    max={12}
                    value={followCtaDuration}
                    onChange={(e) => onFollowCtaDurationChange(Number(e.target.value) || 4)}
                    disabled={locked}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="follow-cta-repeat">Repeat every (seconds)</Label>
                  <Input
                    id="follow-cta-repeat"
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="Once only"
                    value={followCtaRepeat}
                    onChange={(e) => {
                      const raw = e.target.value;
                      onFollowCtaRepeatChange(raw === '' ? '' : Number(raw));
                    }}
                    disabled={locked}
                    className="bg-secondary border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to show once. Must be longer than “Stay on screen”.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {isVideo && (
        <div className="pt-2 border-t border-primary/20 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Each side has its own prompt. Regenerate one without changing the other, then Apply once to save.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={apply}
              disabled={locked}
              className="flex items-center gap-2"
            >
              {busy === 'apply' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Apply to video
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FrameCard
              position="intro"
              heading="Intro"
              imageUrl={introFrameUrl}
              duration={introDuration}
              prompt={introPrompt}
              busy={busy}
              locked={locked}
              onPromptChange={onIntroPromptChange}
              onDurationChange={onIntroDurationChange}
              onGenerate={() => generateOne('intro')}
              onUpload={uploadFrame}
              onLibraryClick={() => setAssetPickerTarget('intro_frame')}
              onClear={() => onIntroFrameUrlChange('')}
            />
            <FrameCard
              position="outro"
              heading="Outro"
              imageUrl={outroFrameUrl}
              duration={outroDuration}
              prompt={outroPrompt}
              busy={busy}
              locked={locked}
              onPromptChange={onOutroPromptChange}
              onDurationChange={onOutroDurationChange}
              onGenerate={() => generateOne('outro')}
              onUpload={uploadFrame}
              onLibraryClick={() => setAssetPickerTarget('outro_frame')}
              onClear={() => onOutroFrameUrlChange('')}
            />
          </div>
        </div>
      )}

      <AssetPickerDialog
        open={assetPickerTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAssetPickerTarget(null);
        }}
        onSelect={applyAssetFromLibrary}
        categories={assetPickerCategories}
        imagesOnly
        title={
          assetPickerTarget === 'intro_frame' || assetPickerTarget === 'outro_frame'
            ? 'Choose intro / outro frame'
            : 'Choose logo from library'
        }
      />
    </div>
  );
}

function FrameCard({
  position,
  heading,
  imageUrl,
  duration,
  prompt,
  busy,
  locked,
  onPromptChange,
  onDurationChange,
  onGenerate,
  onUpload,
  onLibraryClick,
  onClear,
}: {
  position: FramePosition;
  heading: string;
  imageUrl: string;
  duration: number;
  prompt: string;
  busy: string | null;
  locked: boolean;
  onPromptChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onGenerate: () => void;
  onUpload: (position: FramePosition, file: File) => void;
  onLibraryClick: () => void;
  onClear: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploading = busy === `${position}-upload`;
  const generating = busy === `${position}-ai`;

  return (
    <div className="space-y-3 p-3 rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">{heading}</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0.5}
            max={30}
            step={0.5}
            value={duration}
            onChange={(e) => onDurationChange(Math.min(30, Math.max(0.5, Number(e.target.value) || 0.5)))}
            disabled={locked}
            className="w-16 h-8 bg-secondary border-border text-xs"
          />
          <span className="text-xs text-muted-foreground">sec</span>
        </div>
      </div>

      <div className="rounded-md overflow-hidden bg-secondary border border-border flex items-center justify-center min-h-[8rem]">
        {imageUrl ? (
          <img src={imageUrl} alt={`${position} template`} className="w-full h-auto max-h-80 object-contain" />
        ) : (
          <p className="text-xs text-muted-foreground px-4 text-center">
            No {position} yet. Add a prompt and Generate, or upload.
          </p>
        )}
      </div>

      <TemplateFrameAiPrompt
        position={position}
        value={prompt}
        onChange={onPromptChange}
        disabled={locked}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={locked} onClick={onGenerate}>
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />}
          Generate {position}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(position, file);
            e.target.value = '';
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
          Upload
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={locked} onClick={onLibraryClick}>
          <FolderOpen className="w-3.5 h-3.5 mr-1" />
          Library
        </Button>
        {imageUrl && (
          <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={onClear} className="text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function EditLogoField({
  id,
  label,
  value,
  uploading,
  disabled,
  onUrlChange,
  onFileChange,
  onLibraryClick,
  videoPlacement,
}: {
  id: string;
  label: string;
  value: string;
  uploading: boolean;
  disabled: boolean;
  onUrlChange: (value: string) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLibraryClick: () => void;
  videoPlacement?: {
    throughout: boolean;
    onThroughoutChange: (throughout: boolean) => void;
  };
}) {
  const inputId = `${id}-upload`;
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-background/40 p-3 space-y-3">
      <Label htmlFor={id} className="text-sm font-medium leading-snug">
        {label}
      </Label>

      <div className="flex gap-3 min-w-0">
        <div
          className="h-16 w-16 shrink-0 rounded-md border border-border bg-secondary flex items-center justify-center overflow-hidden"
          aria-hidden={!value}
        >
          {value ? (
            <img src={value} alt="" className="max-h-full max-w-full object-contain p-1" />
          ) : (
            <ImageIcon className="w-7 h-7 text-muted-foreground/50" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <Input
            id={id}
            type="url"
            placeholder="Paste image URL (optional)"
            value={value}
            onChange={(e) => onUrlChange(e.target.value)}
            disabled={disabled}
            className="bg-secondary border-border h-9 text-xs min-w-0"
          />
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled}
            onChange={onFileChange}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => document.getElementById(inputId)?.click()}
              className="h-8"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Upload
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={onLibraryClick}
              className="h-8"
            >
              <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
              Library
            </Button>
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onUrlChange('')}
                className="h-8 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${label}`}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {!value && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Upload a transparent PNG or pick from your asset library.
        </p>
      )}

      {videoPlacement && (
        <div className="space-y-1.5 pt-1 border-t border-border/50">
          <Label className="text-xs text-muted-foreground">Show on video</Label>
          <Select
            value={videoPlacement.throughout ? 'throughout' : 'intro_outro'}
            onValueChange={(v) => videoPlacement.onThroughoutChange(v === 'throughout')}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 bg-secondary border-border text-sm w-full min-w-0">
              <SelectValue placeholder="When to show logo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="intro_outro">Intro &amp; outro only</SelectItem>
              <SelectItem value="throughout">Throughout main video</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
