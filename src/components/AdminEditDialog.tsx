import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContentItem } from '@/hooks/useContent';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Instagram, Facebook, Youtube, Image as ImageIcon, Sparkles, Wand2, Loader2, RefreshCw, Upload, Link as LinkIcon, Plus, Trash2, Type } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ImageViewer } from '@/components/ImageViewer';
import { VideoTextOverlay } from '@/hooks/useContent';

interface AdminEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: ContentItem | null;
  onSave: (adminDescription: string, adminNotes: string, platform: string, watermarkLogoUrl?: string, watermarkWebsiteUrl?: string, watermarkPosition?: string, textOverlays?: VideoTextOverlay[]) => void;
  onReprocess?: (contentId: string, mediaUrl: string, mediaType: string, platform: string) => void;
}

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  facebook: Facebook,
};

export function AdminEditDialog({ open, onOpenChange, content, onSave, onReprocess }: AdminEditDialogProps) {
  const [adminDescription, setAdminDescription] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [platform, setPlatform] = useState<string>('instagram');
  const [generating, setGenerating] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [watermarkLogoUrl, setWatermarkLogoUrl] = useState('');
  const [watermarkWebsiteUrl, setWatermarkWebsiteUrl] = useState('');
  const [watermarkPosition, setWatermarkPosition] = useState('bottom-right');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [textOverlays, setTextOverlays] = useState<VideoTextOverlay[]>([]);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (content) {
      // Only use admin_description, never user description as default
      setAdminDescription(content.admin_description || '');
      setAdminNotes(content.admin_notes || '');
      // Normalize platform: if old content used twitter/linkedin, default to instagram
      const normalizedPlatform =
        content.platform === 'twitter' || content.platform === 'linkedin'
          ? 'instagram'
          : content.platform || 'instagram';
      setPlatform(normalizedPlatform);
      setWatermarkLogoUrl(content.watermark_logo_url || '');
      setWatermarkWebsiteUrl(content.watermark_website_url || '');
      setWatermarkPosition(content.watermark_position || 'bottom-right');
      // Parse text overlays from JSON or use empty array
      // Ensure backward compatibility: if displayMode is not set, default to 'timeframe' if startTime/endTime exist, otherwise 'repeat'
      try {
        const overlays = content.video_text_overlays || [];
        const processedOverlays = Array.isArray(overlays) 
          ? overlays.map((overlay: VideoTextOverlay) => {
              // If displayMode is not set, infer it from existing properties
              if (!overlay.displayMode) {
                if (overlay.startTime !== undefined || overlay.endTime !== undefined) {
                  return { ...overlay, displayMode: 'timeframe' as const };
                } else if (overlay.repeatEverySeconds !== undefined || overlay.showForSeconds !== undefined) {
                  return { ...overlay, displayMode: 'repeat' as const };
                } else {
                  // Default to timeframe for new behavior
                  return { ...overlay, displayMode: 'timeframe' as const };
                }
              }
              return overlay;
            })
          : [];
        setTextOverlays(processedOverlays);
      } catch (e) {
        setTextOverlays([]);
      }
    }
  }, [content]);

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

      // Use supabase.functions.invoke instead of manual fetch for better error handling
      const { data, error } = await supabase.functions.invoke('generate-caption', {
        body: {
          userDescription: content.description || '',
          title: content.title,
          platform: platform,
          mediaType: content.media_type || 'image',
        },
      });

      console.log('Generate caption response:', { data, error });

      if (error) {
        console.error('Function invocation error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No response from function. Check Supabase Dashboard → Edge Functions → Logs for details.');
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
      const errorMessage = error instanceof Error ? error.message : String(error || 'Could not generate caption.');
      let errorDescription = errorMessage;
      
      // Add troubleshooting tips
      if (errorMessage.includes('not deployed') || errorMessage.includes('Function not found') || errorMessage.includes('404')) {
        errorDescription = 'Function not found. Deploy the function using: supabase functions deploy generate-caption';
      } else if (errorMessage.includes('API keys') || errorMessage.includes('API key')) {
        errorDescription = 'API keys not configured. Go to Supabase Dashboard → Edge Functions → Secrets and add GEMINI_API_KEY, OPENROUTER_API_KEY, or OPENAI_API_KEY.';
      } else if (errorMessage.includes('Network') || errorMessage.includes('Failed to connect') || errorMessage.includes('fetch')) {
        errorDescription = 'Network error. Check your internet connection and Supabase project URL.';
      } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
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

  const handleReprocessMedia = async () => {
    if (!content || !content.media_url || !onReprocess) return;
    
    setReprocessing(true);
    try {
      const mediaUrlToProcess = content.original_media_url || content.media_url;
      const mediaType = content.media_type || 'image';
      
      await onReprocess(content.id, mediaUrlToProcess, mediaType, platform);
      
      toast({
        title: 'Media Re-processing Started',
        description: `Re-processing ${mediaType} for ${platform}... This may take a few moments.`,
      });
    } catch (error: any) {
      toast({
        title: 'Re-processing Failed',
        description: error.message || 'Could not re-process media. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setReprocessing(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !content) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload an image file (PNG, JPG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    setUploadingLogo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${content.id}/watermark-${Date.now()}.${fileExt}`;
      const filePath = `watermarks/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('content')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('content')
        .getPublicUrl(filePath);

      setWatermarkLogoUrl(publicUrl);
      toast({
        title: 'Logo Uploaded',
        description: 'Company logo has been uploaded successfully.',
      });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Upload Failed',
        description: error.message || 'Could not upload logo. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that admin description is provided
    if (!adminDescription.trim()) {
      toast({
        title: 'Caption Required',
        description: 'Please write a post caption. This is required for publishing.',
        variant: 'destructive',
      });
      return;
    }
    
    onSave(adminDescription, adminNotes, platform, watermarkLogoUrl || undefined, watermarkWebsiteUrl || undefined, watermarkPosition, textOverlays.length > 0 ? textOverlays : undefined);
    onOpenChange(false);
  };

  const addTextOverlay = () => {
    // Calculate default start/end times based on existing overlays
    // If there are existing overlays, start the new one after the last one ends
    let defaultStartTime = 0;
    let defaultEndTime = 5;
    
    if (textOverlays.length > 0) {
      // Find the maximum end time from existing overlays
      const maxEndTime = Math.max(
        ...textOverlays
          .filter(o => (o.displayMode || 'timeframe') === 'timeframe' && o.endTime !== undefined)
          .map(o => o.endTime ?? 0)
      );
      defaultStartTime = maxEndTime;
      defaultEndTime = defaultStartTime + 3; // Default 3 second duration
    }
    
    const newOverlay: VideoTextOverlay = {
      id: `overlay-${Date.now()}`,
      text: `Text Slot ${textOverlays.length + 1}`,
      displayMode: 'timeframe', // Default to timeframe mode for time slots
      startTime: defaultStartTime,
      endTime: defaultEndTime,
      repeatEverySeconds: 5,
      showForSeconds: 2,
      position: 'center',
      fontSize: 24,
      fontColor: '#FFFFFF',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      opacity: 1,
      animation: 'fade',
    };
    setTextOverlays([...textOverlays, newOverlay]);
  };

  const removeTextOverlay = (id: string) => {
    setTextOverlays(textOverlays.filter(o => o.id !== id));
  };

  const updateTextOverlay = (id: string, updates: Partial<VideoTextOverlay>) => {
    setTextOverlays(textOverlays.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  if (!content) return null;

  const displayMedia = content.enhanced_media_url || content.media_url;
  // Detect if content is a video - check media_type first, then file extension
  const isVideo = content.media_type === 'video' || 
                 displayMedia?.toLowerCase().includes('.mp4') || 
                 displayMedia?.toLowerCase().includes('.mov') || 
                 displayMedia?.toLowerCase().includes('.webm') ||
                 displayMedia?.toLowerCase().includes('.avi') ||
                 displayMedia?.toLowerCase().includes('.mkv') ||
                 content.media_url?.toLowerCase().includes('video');
  
  // Debug log (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('AdminEditDialog - Video detection:', {
      media_type: content.media_type,
      displayMedia: displayMedia?.substring(0, 50),
      isVideo,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] bg-card border-border flex flex-col">
          <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-semibold">
            Edit Content for Publishing
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 space-y-5 mt-4">
          <div className="flex-1 overflow-y-auto pr-2 space-y-5">
          {/* Platform Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
            <Label>Social Media Platform</Label>
              {content?.media_url && onReprocess && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleReprocessMedia();
                  }}
                  disabled={reprocessing || content.preprocessing_status === 'pending'}
                  className="flex items-center gap-2"
                >
                  {reprocessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Re-processing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Re-process Media
                    </>
                  )}
                </Button>
              )}
            </div>
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
              Select the platform where this content will be published. Changing platform will re-process the media for optimal dimensions.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Media Preview */}
            <div className="space-y-2">
              <Label>Preprocessed Media Preview</Label>
              <div className="aspect-video bg-secondary rounded-lg overflow-hidden">
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
                        src={displayMedia}
                        controls
                        muted
                        watermarkLogoUrl={watermarkLogoUrl || undefined}
                        watermarkWebsiteUrl={watermarkWebsiteUrl || undefined}
                        watermarkPosition={watermarkPosition}
                        textOverlays={textOverlays.length > 0 ? textOverlays : undefined}
                        onDurationChange={setVideoDuration}
                      />
                    ) : (
                      <ImageViewer
                        src={displayMedia}
                        alt={content.title}
                        watermarkLogoUrl={watermarkLogoUrl || undefined}
                        watermarkWebsiteUrl={watermarkWebsiteUrl || undefined}
                        watermarkPosition={watermarkPosition}
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
              This caption will be posted to {platform} when you publish
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

          {/* Media Branding & Watermark Section - Show for both images and videos */}
          <div className="space-y-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <Label className="text-base font-semibold">Media Branding & Watermark</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Add your company logo and website link to {isVideo ? 'videos' : 'images'}. The logo will appear as a watermark {isVideo ? 'during playback' : 'on the image'}, and viewers can click to visit your website.
            </p>

              {/* Logo Upload */}
              <div className="space-y-2">
                <Label htmlFor="watermark-logo">Company Logo (for watermark)</Label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Input
                      id="watermark-logo"
                      type="text"
                      placeholder="Logo URL or upload image"
                      value={watermarkLogoUrl}
                      onChange={(e) => setWatermarkLogoUrl(e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div className="relative">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                      disabled={uploadingLogo}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('logo-upload')?.click()}
                      disabled={uploadingLogo}
                      className="flex items-center gap-2"
                    >
                      {uploadingLogo ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Upload
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                {watermarkLogoUrl && (
                  <div className="mt-2">
                    <img
                      src={watermarkLogoUrl}
                      alt="Watermark preview"
                      className="h-12 w-auto object-contain bg-secondary rounded p-1"
                      onError={() => {
                        toast({
                          title: 'Image Load Error',
                          description: 'Could not load logo image. Please check the URL.',
                          variant: 'destructive',
                        });
                      }}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Upload a transparent PNG logo for best results. Recommended size: 200x200px or smaller.
                </p>
              </div>

              {/* Website URL */}
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
                  onChange={(e) => setWatermarkWebsiteUrl(e.target.value)}
                  className="bg-secondary border-border"
                />
                <p className="text-xs text-muted-foreground">
                  This link will be clickable {isVideo ? 'during video playback' : 'when viewing the image'}. Viewers can click to visit your website.
                </p>
              </div>

              {/* Position Selector */}
              <div className="space-y-2">
                <Label htmlFor="watermark-position">Watermark Position</Label>
                <Select value={watermarkPosition} onValueChange={setWatermarkPosition}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-left">Top Left</SelectItem>
                    <SelectItem value="top-right">Top Right</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose where the logo watermark appears on the {isVideo ? 'video' : 'image'}.
                </p>
              </div>
            </div>

          {/* Video Text Overlays Section - Only show for videos */}
          {isVideo && (
            <div className="space-y-4 p-4 bg-accent/5 rounded-lg border border-accent/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-accent" />
                  <Label className="text-base font-semibold">Text Overlays</Label>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTextOverlay}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Time Slot
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Add multiple text slots at different times (e.g., Slot 1: 1-3s, Slot 2: 3-4s, Slot 3: 5-7s). Each slot can have different text.
                </p>
                {videoDuration !== null && (
                  <Badge variant="outline" className="text-xs">
                    Video Duration: {Math.floor(videoDuration)}s
                  </Badge>
                )}
              </div>

              {textOverlays.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No text slots added yet. Click "Add Time Slot" to create your first slot (e.g., 1-3 seconds).
                </div>
              ) : (
                <div className="space-y-4">
                  {textOverlays.map((overlay, index) => {
                    const displayMode = overlay.displayMode || 'timeframe';
                    const timeInfo = displayMode === 'timeframe' 
                      ? `${overlay.startTime ?? 0}s - ${overlay.endTime ?? 0}s`
                      : `Every ${overlay.repeatEverySeconds ?? 0}s for ${overlay.showForSeconds ?? 0}s`;
                    
                    return (
                      <div key={overlay.id} className="p-4 bg-secondary rounded-lg border border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-semibold">Time Slot #{index + 1}</Label>
                          <Badge variant="outline" className="text-xs">
                            {timeInfo}
                          </Badge>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTextOverlay(overlay.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Text Content */}
                      <div className="space-y-2">
                        <Label htmlFor={`overlay-text-${overlay.id}`}>Text Content for This Slot</Label>
                        <Input
                          id={`overlay-text-${overlay.id}`}
                          value={overlay.text}
                          onChange={(e) => updateTextOverlay(overlay.id, { text: e.target.value })}
                          placeholder={`Enter text for slot ${index + 1}`}
                          className="bg-background border-border"
                        />
                        <p className="text-xs text-muted-foreground">
                          This text will appear during the time frame specified below.
                        </p>
                      </div>

                      {/* Display Mode Selection */}
                      <div className="space-y-2">
                        <Label htmlFor={`overlay-mode-${overlay.id}`}>Display Mode</Label>
                        <Select
                          value={overlay.displayMode || 'timeframe'}
                          onValueChange={(value) => updateTextOverlay(overlay.id, { displayMode: value as 'repeat' | 'timeframe' })}
                        >
                          <SelectTrigger className="bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="timeframe">Specific Time Frame</SelectItem>
                            <SelectItem value="repeat">Repeat at Intervals</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {overlay.displayMode === 'timeframe' 
                            ? 'Text will appear at a specific time range during playback.'
                            : 'Text will repeat at regular intervals throughout the video.'}
                        </p>
                      </div>

                      {/* Timing - Show different inputs based on mode */}
                      {overlay.displayMode === 'timeframe' ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor={`overlay-start-${overlay.id}`}>
                              Start Time (seconds)
                              {videoDuration !== null && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  (max: {Math.floor(videoDuration)}s)
                                </span>
                              )}
                            </Label>
                            <Input
                              id={`overlay-start-${overlay.id}`}
                              type="number"
                              min="0"
                              max={videoDuration ?? undefined}
                              step="0.1"
                              value={overlay.startTime ?? 0}
                              onChange={(e) =>
                                updateTextOverlay(overlay.id, {
                                  startTime: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="bg-background border-border"
                              placeholder="0"
                            />
                            <p className="text-xs text-muted-foreground">When text appears</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`overlay-end-${overlay.id}`}>
                              End Time (seconds)
                              {videoDuration !== null && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  (max: {Math.floor(videoDuration)}s)
                                </span>
                              )}
                            </Label>
                            <Input
                              id={`overlay-end-${overlay.id}`}
                              type="number"
                              min="0"
                              max={videoDuration ?? undefined}
                              step="0.1"
                              value={overlay.endTime ?? 5}
                              onChange={(e) =>
                                updateTextOverlay(overlay.id, {
                                  endTime: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="bg-background border-border"
                              placeholder="5"
                            />
                            <p className="text-xs text-muted-foreground">When text disappears</p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor={`overlay-repeat-${overlay.id}`}>Repeat Every (seconds)</Label>
                            <Input
                              id={`overlay-repeat-${overlay.id}`}
                              type="number"
                              min="0"
                              step="0.1"
                              value={overlay.repeatEverySeconds ?? 5}
                              onChange={(e) =>
                                updateTextOverlay(overlay.id, {
                                  repeatEverySeconds: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="bg-background border-border"
                              placeholder="5"
                            />
                            <p className="text-xs text-muted-foreground">Interval between appearances</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`overlay-duration-${overlay.id}`}>Show For (seconds)</Label>
                            <Input
                              id={`overlay-duration-${overlay.id}`}
                              type="number"
                              min="0"
                              step="0.1"
                              value={overlay.showForSeconds ?? 2}
                              onChange={(e) =>
                                updateTextOverlay(overlay.id, {
                                  showForSeconds: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="bg-background border-border"
                              placeholder="2"
                            />
                            <p className="text-xs text-muted-foreground">Duration each time it appears</p>
                          </div>
                        </div>
                      )}

                      {/* Position */}
                      <div className="space-y-2">
                        <Label htmlFor={`overlay-position-${overlay.id}`}>Position</Label>
                        <Select
                          value={overlay.position}
                          onValueChange={(value) => updateTextOverlay(overlay.id, { position: value as VideoTextOverlay['position'] })}
                        >
                          <SelectTrigger className="bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="top-left">Top Left</SelectItem>
                            <SelectItem value="top-center">Top Center</SelectItem>
                            <SelectItem value="top-right">Top Right</SelectItem>
                            <SelectItem value="center-left">Center Left</SelectItem>
                            <SelectItem value="center">Center</SelectItem>
                            <SelectItem value="center-right">Center Right</SelectItem>
                            <SelectItem value="bottom-left">Bottom Left</SelectItem>
                            <SelectItem value="bottom-center">Bottom Center</SelectItem>
                            <SelectItem value="bottom-right">Bottom Right</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Style Options */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`overlay-fontsize-${overlay.id}`}>Font Size</Label>
                          <Input
                            id={`overlay-fontsize-${overlay.id}`}
                            type="number"
                            min="12"
                            max="72"
                            value={overlay.fontSize || 24}
                            onChange={(e) => updateTextOverlay(overlay.id, { fontSize: parseInt(e.target.value) || 24 })}
                            className="bg-background border-border"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`overlay-animation-${overlay.id}`}>Animation</Label>
                          <Select
                            value={overlay.animation || 'fade'}
                            onValueChange={(value) => updateTextOverlay(overlay.id, { animation: value as VideoTextOverlay['animation'] })}
                          >
                            <SelectTrigger className="bg-background border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="fade">Fade In</SelectItem>
                              <SelectItem value="slide">Slide In</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Colors */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`overlay-fontcolor-${overlay.id}`}>Text Color</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`overlay-fontcolor-${overlay.id}`}
                              type="color"
                              value={overlay.fontColor || '#FFFFFF'}
                              onChange={(e) => updateTextOverlay(overlay.id, { fontColor: e.target.value })}
                              className="w-16 h-10 bg-background border-border"
                            />
                            <Input
                              type="text"
                              value={overlay.fontColor || '#FFFFFF'}
                              onChange={(e) => updateTextOverlay(overlay.id, { fontColor: e.target.value })}
                              placeholder="#FFFFFF"
                              className="flex-1 bg-background border-border"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`overlay-bgcolor-${overlay.id}`}>Background Color</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`overlay-bgcolor-${overlay.id}`}
                              type="color"
                              value={overlay.backgroundColor?.replace('rgba(', '').replace(')', '').split(',')[0] === '0' ? '#000000' : overlay.backgroundColor || '#000000'}
                              onChange={(e) => {
                                const color = e.target.value;
                                updateTextOverlay(overlay.id, { backgroundColor: `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.7)` });
                              }}
                              className="w-16 h-10 bg-background border-border"
                            />
                            <Input
                              type="text"
                              value={overlay.backgroundColor || 'rgba(0, 0, 0, 0.7)'}
                              onChange={(e) => updateTextOverlay(overlay.id, { backgroundColor: e.target.value })}
                              placeholder="rgba(0, 0, 0, 0.7)"
                              className="flex-1 bg-background border-border"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          </div>

          <DialogFooter className="flex-shrink-0 pt-4 border-t border-border mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="glow">
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
