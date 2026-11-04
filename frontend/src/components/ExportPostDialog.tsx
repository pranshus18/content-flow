import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ImageViewer } from '@/components/ImageViewer';
import { useToast } from '@/hooks/use-toast';
import { downloadBackend, invokeBackend, saveBlob } from '@/lib/backend';
import { errorMessage } from '@/lib/utils';
import type { ContentItem } from '@/hooks/useContent';
import {
  backgroundMusicAttributionLine,
  getBackgroundMusicTrack,
  isAdminAssetMusicTrackId,
} from '@/lib/backgroundMusicCatalog';
import {
  Check,
  Copy,
  Download,
  FileText,
  Instagram,
  Facebook,
  Loader2,
  Youtube,
} from 'lucide-react';

type PostPackage = {
  contentId: string;
  title: string;
  platform: string;
  mediaType: 'video' | 'image';
  mediaUrl: string | null;
  caption: string;
  captionWithoutBranding: string;
  hashtags: string[];
  websiteUrl: string | null;
  companyName: string | null;
  downloadFileName: string;
  characterCounts: { title: number; caption: number };
  platformLimits: { titleMax: number; captionMax: number };
  recommendedSize: { width: number; height: number; aspect: string };
  youtubePrivacy: string | null;
  postingNotes: string[];
  processing: boolean;
  ready: { hasMedia: boolean; hasCaption: boolean };
};

interface ExportPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: ContentItem | null;
  captionOverride?: string;
  platformOverride?: string;
}

const platformIcons: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
};

function formatDetails(pkg: PostPackage, musicCredit?: string | null) {
  return [
    `Platform: ${pkg.platform}`,
    `Title: ${pkg.title}`,
    `Type: ${pkg.mediaType === 'video' ? 'Video' : 'Image'}`,
    `Recommended size: ${pkg.recommendedSize.width}x${pkg.recommendedSize.height} (${pkg.recommendedSize.aspect})`,
    pkg.websiteUrl ? `Website: ${pkg.websiteUrl}` : null,
    pkg.companyName ? `Company: ${pkg.companyName}` : null,
    pkg.youtubePrivacy ? `YouTube privacy: ${pkg.youtubePrivacy}` : null,
    pkg.hashtags.length ? `Hashtags: ${pkg.hashtags.join(' ')}` : null,
    '',
    'Caption to paste:',
    pkg.caption || '(no caption yet)',
    musicCredit ? '' : null,
    musicCredit ? 'Music credit (required for royalty-free license):' : null,
    musicCredit || null,
    '',
    'How to post:',
    ...pkg.postingNotes.map((note) => `- ${note}`),
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function ExportPostDialog({
  open,
  onOpenChange,
  content,
  captionOverride,
  platformOverride,
}: ExportPostDialogProps) {
  const { toast } = useToast();
  const [pkg, setPkg] = useState<PostPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState<'caption' | 'all' | null>(null);

  useEffect(() => {
    if (!open || !content) {
      setPkg(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const hasOverrides = captionOverride !== undefined || Boolean(platformOverride);

    invokeBackend<PostPackage>(
      `content/${content.id}/post-package`,
      hasOverrides ? { caption: captionOverride, platform: platformOverride } : undefined,
      { method: hasOverrides ? 'POST' : 'GET' },
    )
      .then((data) => {
        if (!cancelled) setPkg(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast({
            title: 'Could not load post details',
            description: errorMessage(error, 'Try again after the video finishes processing.'),
            variant: 'destructive',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, content?.id, captionOverride, platformOverride, toast]);

  const copyText = async (value: string, kind: 'caption' | 'all') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
      toast({
        title: kind === 'caption' ? 'Caption copied' : 'Post details copied',
        description: 'Paste this when you upload on the social platform.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Select the text and copy it manually.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadMedia = async () => {
    if (!content) return;
    setDownloading(true);
    try {
      const { blob, fileName } = await downloadBackend(`content/${content.id}/download`);
      saveBlob(blob, fileName || pkg?.downloadFileName || 'content');
      toast({
        title: pkg?.mediaType === 'image' ? 'Image downloaded' : 'Video downloaded',
        description: 'Upload this file on the platform, then paste the caption.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Download failed',
        description: errorMessage(error, 'Could not download the finished file.'),
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadDetails = () => {
    if (!pkg) return;
    saveBlob(new Blob([formatDetails(pkg, musicCredit)], { type: 'text/plain;charset=utf-8' }), `${pkg.platform}-${pkg.title.replace(/[^\w]+/g, '-').slice(0, 40)}-post-details.txt`);
    toast({
      title: 'Post details downloaded',
      description: 'A text file with title, caption, hashtags, and posting notes was saved.',
    });
  };

  const PlatformIcon = platformIcons[pkg?.platform || content?.platform || ''] || FileText;
  const displayMedia = pkg?.mediaUrl || content?.enhanced_media_url || content?.media_url || null;
  const isVideo = pkg?.mediaType === 'video' || content?.media_type === 'video';
  const musicTrackId = content?.background_music_track_id;
  const musicTrack = musicTrackId && !isAdminAssetMusicTrackId(musicTrackId)
    ? getBackgroundMusicTrack(musicTrackId)
    : undefined;
  const musicCredit = musicTrack
    ? backgroundMusicAttributionLine(musicTrack)
    : musicTrackId && isAdminAssetMusicTrackId(musicTrackId)
      ? 'Custom background music (your upload) — confirm you have rights to use it.'
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto z-[70]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Download for posting
          </DialogTitle>
          <DialogDescription>
            Get the finished file and the same title, caption, and details this platform would use to post.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Loading post package...
          </div>
        ) : (
          <div className="space-y-5">
            {displayMedia && (
              <div className="aspect-video bg-secondary rounded-lg overflow-hidden border border-border">
                {isVideo ? (
                  <VideoPlayer
                    src={displayMedia}
                    controls
                    muted
                    watermarkLogoUrl={content?.watermark_logo_url}
                    vendorLogoUrl={content?.vendor_logo_url}
                    watermarkWebsiteUrl={content?.watermark_website_url}
                    watermarkPosition={content?.watermark_position}
                    vendorLogoPosition={content?.vendor_logo_position}
                    platformLogoThroughout={content?.platform_logo_throughout !== false}
                    vendorLogoThroughout={content?.vendor_logo_throughout === true}
                    brandingBaked={content?.preprocessing_status === 'completed'}
                  />
                ) : (
                  <ImageViewer
                    src={displayMedia}
                    alt={content?.title || 'Media'}
                    watermarkLogoUrl={content?.watermark_logo_url}
                    vendorLogoUrl={content?.vendor_logo_url}
                    watermarkWebsiteUrl={content?.watermark_website_url}
                    watermarkPosition={content?.watermark_position}
                    vendorLogoPosition={content?.vendor_logo_position}
                    brandingBaked={content?.preprocessing_status === 'completed'}
                  />
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="capitalize">
                <PlatformIcon className="w-3.5 h-3.5 mr-1" />
                {pkg?.platform || content?.platform}
              </Badge>
              <Badge variant="outline">{isVideo ? 'Video' : 'Image'}</Badge>
              {pkg?.processing && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-500/30">
                  Still processing
                </Badge>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Title</p>
                <p className="font-medium">{pkg?.title || content?.title}</p>
                {pkg?.platform === 'youtube' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {pkg.characterCounts.title}/{pkg.platformLimits.titleMax} characters
                  </p>
                )}
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Recommended size</p>
                <p className="font-medium">
                  {pkg ? `${pkg.recommendedSize.width}×${pkg.recommendedSize.height}` : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{pkg?.recommendedSize.aspect}</p>
              </div>
              {pkg?.websiteUrl && (
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Website</p>
                  <p className="font-medium break-all">{pkg.websiteUrl}</p>
                </div>
              )}
              {pkg?.youtubePrivacy && (
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">YouTube privacy</p>
                  <p className="font-medium capitalize">{pkg.youtubePrivacy}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Caption to paste</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!pkg?.caption}
                  onClick={() => pkg?.caption && copyText(pkg.caption, 'caption')}
                >
                  {copied === 'caption' ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  Copy caption
                </Button>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 whitespace-pre-wrap text-sm min-h-[96px]">
                {pkg?.caption || 'No caption yet. Save a post caption in Edit first.'}
              </div>
              {pkg && (
                <p className="text-xs text-muted-foreground">
                  {pkg.characterCounts.caption}
                  {pkg.platformLimits.captionMax ? ` / ${pkg.platformLimits.captionMax}` : ''} characters
                </p>
              )}
            </div>

            {pkg?.hashtags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {pkg.hashtags.map((tag) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            ) : null}

            {musicCredit ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Music credit (include in caption)</p>
                <p className="text-xs text-muted-foreground p-3 rounded-lg border border-border bg-secondary/40">
                  {musicCredit}
                </p>
              </div>
            ) : null}

            {pkg?.postingNotes?.length ? (
              <div className="text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">How to post separately</p>
                <ul className="list-disc pl-5 space-y-1">
                  {pkg.postingNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                onClick={handleDownloadMedia}
                disabled={downloading || !pkg?.ready.hasMedia || pkg?.processing}
                className="flex-1 min-w-[160px]"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {downloading ? 'Downloading...' : isVideo ? 'Download video' : 'Download image'}
              </Button>
              <Button type="button" variant="outline" onClick={handleDownloadDetails} disabled={!pkg}>
                <FileText className="w-4 h-4 mr-2" />
                Download details
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!pkg}
                onClick={() => pkg && copyText(formatDetails(pkg, musicCredit), 'all')}
              >
                {copied === 'all' ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                Copy all details
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
