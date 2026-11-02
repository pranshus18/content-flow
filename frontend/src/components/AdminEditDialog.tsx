import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { invokeBackend } from '@/lib/backend';
import { errorMessage } from '@/lib/utils';
import { Instagram, Facebook, Youtube, Image as ImageIcon, Sparkles, Wand2, Loader2, Download } from 'lucide-react';
import { ExportPostDialog } from '@/components/ExportPostDialog';
import { Input } from '@/components/ui/input';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ImageViewer } from '@/components/ImageViewer';
import { TemplateFramesSection } from '@/components/TemplateFramesSection';
import { ContentItem } from '@/hooks/useContent';

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
    }
  ) => void | Promise<void>;
  onContentUpdated?: (content: ContentItem) => void;
}

export function AdminEditDialog({ open, onOpenChange, content, onSave, onContentUpdated }: AdminEditDialogProps) {
  const [adminDescription, setAdminDescription] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [platform, setPlatform] = useState<string>('instagram');
  const [generating, setGenerating] = useState(false);
  const [watermarkLogoUrl, setWatermarkLogoUrl] = useState('');
  const [vendorLogoUrl, setVendorLogoUrl] = useState('');
  const [watermarkWebsiteUrl, setWatermarkWebsiteUrl] = useState('');
  const [watermarkPosition, setWatermarkPosition] = useState('bottom-right');
  const [vendorLogoPosition, setVendorLogoPosition] = useState('bottom-left');
  const [uploadingLogo, setUploadingLogo] = useState<string | null>(null);
  const [followCtaEnabled, setFollowCtaEnabled] = useState(true);
  const [followCtaText, setFollowCtaText] = useState('Follow us');
  const [followCtaStart, setFollowCtaStart] = useState<number | ''>('');
  const [followCtaDuration, setFollowCtaDuration] = useState(4);
  const [introFrameUrl, setIntroFrameUrl] = useState('');
  const [outroFrameUrl, setOutroFrameUrl] = useState('');
  const [introDuration, setIntroDuration] = useState(3);
  const [outroDuration, setOutroDuration] = useState(5);
  const [introPrompt, setIntroPrompt] = useState('');
  const [outroPrompt, setOutroPrompt] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMediaUrl, setPreviewMediaUrl] = useState('');
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

  useEffect(() => {
    if (!open || !content) {
      initializedForId.current = null;
      return;
    }
    // Apply-to-video updates the same content record. Do not reset unsaved logos/CTA/frames.
    if (initializedForId.current === content.id) return;
    initializedForId.current = content.id;

    suppressDirtyRef.current = true;
    setAdminDescription(content.admin_description || '');
    setAdminNotes(content.admin_notes || '');
    const normalizedPlatform =
      content.platform === 'twitter' || content.platform === 'linkedin'
        ? 'instagram'
        : content.platform || 'instagram';
    setPlatform(normalizedPlatform);
    setWatermarkLogoUrl(content.watermark_logo_url || '');
    setVendorLogoUrl(content.vendor_logo_url || '');
    setWatermarkWebsiteUrl(content.watermark_website_url || '');
    setWatermarkPosition(content.watermark_position || 'bottom-right');
    setVendorLogoPosition(content.vendor_logo_position || 'bottom-left');
    setFollowCtaEnabled(false);
    setFollowCtaText('Follow us');
    setFollowCtaStart('');
    setFollowCtaDuration(4);
    setIntroFrameUrl(content.intro_frame_url || '');
    setOutroFrameUrl(content.outro_frame_url || '');
    setIntroDuration(content.intro_frame_duration || 3);
    setOutroDuration(content.outro_frame_duration || 5);
    setIntroPrompt('');
    setOutroPrompt('');
    setBrandingDirty(false);
    setPreviewMediaUrl(content.enhanced_media_url || content.media_url || '');
    suppressDirtyRef.current = false;
  }, [open, content]);

  const syncAppliedMedia = (updated: ContentItem) => {
    const nextMedia = updated.enhanced_media_url || updated.media_url || '';
    if (nextMedia) {
      setPreviewMediaUrl(`${nextMedia}${nextMedia.includes('?') ? '&' : '?'}t=${Date.now()}`);
    }
    suppressDirtyRef.current = true;
    if (updated.intro_frame_url) setIntroFrameUrl(updated.intro_frame_url);
    if (updated.outro_frame_url) setOutroFrameUrl(updated.outro_frame_url);
    if (updated.intro_frame_duration != null) setIntroDuration(updated.intro_frame_duration);
    if (updated.outro_frame_duration != null) setOutroDuration(updated.outro_frame_duration);
    if (updated.watermark_logo_url != null) setWatermarkLogoUrl(updated.watermark_logo_url || '');
    if (updated.vendor_logo_url != null) setVendorLogoUrl(updated.vendor_logo_url || '');
    if (updated.watermark_website_url != null) setWatermarkWebsiteUrl(updated.watermark_website_url || '');
    if (updated.watermark_position) setWatermarkPosition(updated.watermark_position);
    if (updated.vendor_logo_position) setVendorLogoPosition(updated.vendor_logo_position);
    suppressDirtyRef.current = false;
    setBrandingDirty(false);
    onContentUpdated?.(updated);
  };

  const handleGenerateCaption = async () => {
    console.log('Generate with AI button clicked!', { content: !!content, hasDescription: !!content?.description });
    
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/branding/${kind}-${content.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('content-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('content-media')
        .getPublicUrl(filePath);

      if (kind === 'platform') setWatermarkLogoUrlTracked(publicUrl);
      else setVendorLogoUrlTracked(publicUrl);
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
      );

      // Only bake when branding changed since last Apply/Save — never re-encode an already-saved video.
      const hasBrandingWork = Boolean(
        watermarkLogoUrl
        || vendorLogoUrl
        || introFrameUrl
        || outroFrameUrl
        || introPrompt.trim()
        || outroPrompt.trim()
        || followCtaEnabled,
      );
      if (brandingDirty && hasBrandingWork) {
        toast({
          title: 'Saving branded video',
          description: 'Baking logos, intro, and outro into the media once…',
        });

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
            watermark_enabled: true,
          },
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] bg-card border-border flex flex-col">
          <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-semibold">
            Edit Content
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 space-y-5 mt-4">
          <div className="flex-1 overflow-y-auto pr-2 space-y-5">
          {/* Platform Selection */}
          <div className="space-y-2">
            <Label>Social Media Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">
                  <div className="flex items-center gap-2">
                    <Instagram className="w-4 h-4" />
                    Instagram
                  </div>
                </SelectItem>
                <SelectItem value="facebook">
                  <div className="flex items-center gap-2">
                    <Facebook className="w-4 h-4" />
                    Facebook
                  </div>
                </SelectItem>
                <SelectItem value="youtube">
                  <div className="flex items-center gap-2">
                    <Youtube className="w-4 h-4" />
                    YouTube
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select the platform this content is prepared for. Changing platform will re-process the media for optimal dimensions.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Media Preview */}
            <div className="space-y-2">
              <Label>Preprocessed Media Preview</Label>
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
                        introFrameUrl={introFrameUrl || undefined}
                        outroFrameUrl={outroFrameUrl || undefined}
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
              <p className="text-sm font-medium">{content.title}</p>
              {content.enhanced_media_url && (
                <Badge variant="outline" className="text-xs">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Preprocessed & Enhanced
                </Badge>
              )}
            </div>

            {/* User's Description */}
            <div className="space-y-2">
              <Label>User's Original Description</Label>
              <div className="p-3 bg-secondary rounded-lg min-h-[120px]">
                <p className="text-sm text-muted-foreground">
                  {content.description || 'No description provided'}
                </p>
              </div>
            </div>
          </div>

          {/* Admin Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="admin-description">
                Post Caption for {platform.charAt(0).toUpperCase() + platform.slice(1)} *
              </Label>
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
              placeholder={`Write an optimized caption for ${platform}... (Required - this will be posted, not user description)`}
              value={adminDescription}
              onChange={(e) => setAdminDescription(e.target.value)}
              rows={5}
              className="bg-secondary border-border resize-none"
              required
            />
            <p className="text-xs text-muted-foreground">
              ⚠️ This caption will be posted to {platform}. User's description will NOT be posted - only this admin-written caption (including AI-generated captions, which are considered admin-written).
            </p>
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <div className="flex-1">
                <p className="font-medium mb-1">Platform-specific tips:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {platform === 'instagram' && (
                    <>
                      <li>Use relevant hashtags (5-10 recommended)</li>
                      <li>Keep it engaging and visual</li>
                      <li>Include a call-to-action</li>
                    </>
                  )}
                  {platform === 'facebook' && (
                    <>
                      <li>Conversational and friendly tone</li>
                      <li>Ask questions to encourage engagement</li>
                      <li>Use 2-3 relevant hashtags</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              This caption is saved with the {platform} post.
            </p>
          </div>

          {/* Admin Notes */}
          <div className="space-y-2">
            <Label htmlFor="admin-notes">Internal Notes (not posted)</Label>
            <Textarea
              id="admin-notes"
              placeholder="Add any internal notes about this content..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              className="bg-secondary border-border resize-none"
            />
          </div>

          <TemplateFramesSection
            content={content}
            platform={platform}
            isVideo={isVideo}
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
            onPlatformLogoFile={(e) => handleLogoUpload(e, 'platform')}
            onVendorLogoFile={(e) => handleLogoUpload(e, 'vendor')}
            followCtaEnabled={followCtaEnabled}
            followCtaText={followCtaText}
            followCtaStart={followCtaStart}
            followCtaDuration={followCtaDuration}
            onFollowCtaEnabledChange={setFollowCtaEnabledTracked}
            onFollowCtaTextChange={setFollowCtaTextTracked}
            onFollowCtaStartChange={setFollowCtaStartTracked}
            onFollowCtaDurationChange={setFollowCtaDurationTracked}
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
            onApplied={syncAppliedMedia}
          />

          </div>

          <DialogFooter className="flex-shrink-0 pt-4 border-t border-border mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            {(content.enhanced_media_url || content.media_url) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setExportOpen(true)}
                disabled={saving || content.preprocessing_status === 'pending'}
              >
                <Download className="w-4 h-4 mr-2" />
                Download for posting
              </Button>
            )}
            <Button type="submit" className="glow" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
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
