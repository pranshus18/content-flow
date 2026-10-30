import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TemplateFrameAiPrompt } from '@/components/TemplateFrameAiPrompt';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { invokeBackend } from '@/lib/backend';
import { errorMessage } from '@/lib/utils';
import type { ContentItem } from '@/hooks/useContent';
import { Clapperboard, Loader2, Sparkles, Trash2, Upload, Wand2 } from 'lucide-react';

type Position = 'intro' | 'outro';

type ApplyBranding = {
  company_logo_url?: string | null;
  vendor_logo_url?: string | null;
  company_website_url?: string | null;
  watermark_position?: string | null;
  follow_cta_enabled?: boolean | null;
  follow_cta_text?: string | null;
  follow_cta_start_seconds?: number | null;
  follow_cta_duration?: number | null;
};

interface TemplateFramesSectionProps {
  content: ContentItem;
  platform: string;
  introFrameUrl: string;
  outroFrameUrl: string;
  introDuration: number;
  outroDuration: number;
  introPrompt: string;
  outroPrompt: string;
  branding?: ApplyBranding;
  onIntroFrameUrlChange: (url: string) => void;
  onOutroFrameUrlChange: (url: string) => void;
  onIntroDurationChange: (value: number) => void;
  onOutroDurationChange: (value: number) => void;
  onIntroPromptChange: (value: string) => void;
  onOutroPromptChange: (value: string) => void;
  onApplied?: (updated: ContentItem) => void;
}

export function TemplateFramesSection({
  content,
  platform,
  introFrameUrl,
  outroFrameUrl,
  introDuration,
  outroDuration,
  introPrompt,
  outroPrompt,
  branding,
  onIntroFrameUrlChange,
  onOutroFrameUrlChange,
  onIntroDurationChange,
  onOutroDurationChange,
  onIntroPromptChange,
  onOutroPromptChange,
  onApplied,
}: TemplateFramesSectionProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const generate = async (position: Position, useAi: boolean) => {
    const prompt = (position === 'intro' ? introPrompt : outroPrompt).trim();
    if (useAi && !prompt) {
      toast({
        title: 'Add an AI prompt',
        description: `Describe the ${position} you want, then click Generate with AI.`,
      });
      return;
    }
    const key = `${position}-${useAi ? 'ai' : 'brand'}`;
    setBusy(key);
    try {
      const data = await invokeBackend<{ success?: boolean; frameUrl?: string; error?: string; model?: string }>(
        'generate-template-frame',
        {
          position,
          contentId: content.id,
          platform,
          title: content.title,
          prompt: prompt || undefined,
          useAi,
          saveTo: 'none',
          branding: branding || undefined,
        },
      );
      if (!data?.frameUrl) {
        throw new Error(data?.error || 'No template frame was returned.');
      }
      if (position === 'intro') onIntroFrameUrlChange(data.frameUrl);
      else onOutroFrameUrlChange(data.frameUrl);
      toast({
        title: useAi ? 'AI template generated' : 'Template frame generated',
        description: useAi
          ? prompt
            ? `Created the ${position} from your prompt${data.model ? ` with ${data.model}` : ''}.`
            : `Created a default ${position} from branding. Add a prompt for a custom look.`
          : `A branded ${position} card was created from your logo and company details.`,
      });
    } catch (error: unknown) {
      toast({
        title: 'Could not generate frame',
        description: errorMessage(error, 'Template generation failed.'),
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const upload = async (position: Position, file: File) => {
    setBusy(`${position}-upload`);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to upload a template frame.');
      const ext = file.name.split('.').pop() || 'png';
      // First folder must be the user id — storage RLS only allows that prefix.
      const filePath = `${user.id}/templates/${content.id}/${position}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('content-media').upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('content-media').getPublicUrl(filePath);
      if (position === 'intro') onIntroFrameUrlChange(data.publicUrl);
      else onOutroFrameUrlChange(data.publicUrl);
      toast({
        title: 'Frame uploaded',
        description: `Custom ${position} image is ready to preview.`,
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
    setBusy('apply');
    try {
      const data = await invokeBackend<{
        success?: boolean;
        error?: string;
        content?: ContentItem;
      }>('apply-template-frames', {
        contentId: content.id,
        introFrameUrl: introFrameUrl || null,
        outroFrameUrl: outroFrameUrl || null,
        introDuration,
        outroDuration,
        introPrompt: introPrompt || null,
        outroPrompt: outroPrompt || null,
        branding: branding || undefined,
      });
      if (!data?.success || !data.content) {
        throw new Error(data?.error || 'Could not apply template frames to the video.');
      }
      onApplied?.(data.content);
      const introSecs = introFrameUrl ? introDuration : 0;
      const outroSecs = outroFrameUrl ? outroDuration : 0;
      toast({
        title: 'Intro and outro added',
        description: `Added ${introSecs}s intro and ${outroSecs}s outro to the video.`,
      });
    } catch (error: unknown) {
      toast({
        title: 'Could not apply frames',
        description: errorMessage(error, 'Video wrapping failed.'),
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4 p-4 bg-secondary/40 rounded-lg border border-border">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clapperboard className="w-4 h-4 text-primary" />
            <Label className="text-base font-semibold">Video Template Frames</Label>
            {content.template_frames_applied && (
              <Badge variant="outline" className="text-xs">Applied to video</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Set how many seconds the intro and outro should last, then Apply to video. They are mixed into the same opening and closing shots so they look like they were already in the clip.
          </p>
          <p className="text-xs text-foreground">
            Added time: {introFrameUrl ? `${introDuration}s intro` : 'no intro'}
            {' + '}
            {outroFrameUrl ? `${outroDuration}s outro` : 'no outro'}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={apply}
          disabled={busy !== null}
          className="flex items-center gap-2"
        >
          {busy === 'apply' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Apply to video
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FrameCard
          position="intro"
          heading="Intro (before video)"
          imageUrl={introFrameUrl}
          duration={introDuration}
          prompt={introPrompt}
          busy={busy}
          onPromptChange={onIntroPromptChange}
          onDurationChange={onIntroDurationChange}
          onGenerate={generate}
          onUpload={upload}
          onClear={() => onIntroFrameUrlChange('')}
        />
        <FrameCard
          position="outro"
          heading="Outro (after video)"
          imageUrl={outroFrameUrl}
          duration={outroDuration}
          prompt={outroPrompt}
          busy={busy}
          onPromptChange={onOutroPromptChange}
          onDurationChange={onOutroDurationChange}
          onGenerate={generate}
          onUpload={upload}
          onClear={() => onOutroFrameUrlChange('')}
        />
      </div>
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
  onPromptChange,
  onDurationChange,
  onGenerate,
  onUpload,
  onClear,
}: {
  position: Position;
  heading: string;
  imageUrl: string;
  duration: number;
  prompt: string;
  busy: string | null;
  onPromptChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onGenerate: (position: Position, useAi: boolean) => void;
  onUpload: (position: Position, file: File) => void;
  onClear: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const generating = busy === `${position}-brand`;
  const generatingAi = busy === `${position}-ai`;
  const uploading = busy === `${position}-upload`;
  const locked = busy !== null;

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
            No {position} frame yet. Generate from branding or AI.
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
        <Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => onGenerate(position, false)}>
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
          From branding
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => onGenerate(position, true)}>
          {generatingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />}
          Generate with AI
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
        {imageUrl && (
          <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={onClear} className="text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
