import { ContentItem } from '@/hooks/useContent';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ImageViewer } from '@/components/ImageViewer';
import { 
  Check, 
  X, 
  Edit, 
  Trash2, 
  Send, 
  RefreshCw,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Image as ImageIcon,
  Sparkles,
  Clock,
  Instagram,
  Facebook,
  Wand2,
  Calendar as CalendarIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AdminContentCardProps {
  content: ContentItem;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPublish?: () => void;
  onSchedule?: () => void;
  onRefreshAnalytics?: () => void;
  onReprocess?: () => void;
  isRefreshing?: boolean;
  isReprocessing?: boolean;
  showPublishButton?: boolean;
  showAnalytics?: boolean;
  showScheduleButton?: boolean;
}

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  facebook: Facebook,
};

const platformColors: Record<string, string> = {
  instagram: 'text-pink-500',
  facebook: 'text-blue-500',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  pending: 'bg-yellow-500',
  approved: 'bg-blue-500',
  scheduled: 'bg-purple-500',
  published: 'bg-green-500',
};

export function AdminContentCard({
  content,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  onPublish,
  onSchedule,
  onRefreshAnalytics,
  onReprocess,
  isRefreshing,
  isReprocessing,
  showPublishButton,
  showAnalytics,
  showScheduleButton,
}: AdminContentCardProps) {
  const displayMedia = content.enhanced_media_url || content.media_url;
  const isEnhanced = !!content.enhanced_media_url;
  const PlatformIcon = platformIcons[content.platform] || ImageIcon;
  
  // Detect if media is a video
  const isVideo = (url: string | null) => {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv'];
    const videoPatterns = ['video', 'mp4', 'mov', 'webm'];
    const lowerUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowerUrl.includes(ext)) || 
           videoPatterns.some(pattern => lowerUrl.includes(pattern));
  };
  
  const mediaIsVideo = isVideo(displayMedia || content.media_url);

  return (
    <Card className="overflow-hidden bg-card border-border hover:border-primary/30 transition-all">
      {/* Media Preview */}
      <div className="relative aspect-video bg-secondary">
        {displayMedia ? (
          <>
            {mediaIsVideo ? (
              <VideoPlayer
                src={displayMedia}
                controls
                muted
                watermarkLogoUrl={content.watermark_logo_url}
                watermarkWebsiteUrl={content.watermark_website_url}
                watermarkPosition={content.watermark_position}
                textOverlays={content.video_text_overlays}
              />
            ) : (
              <ImageViewer
                src={displayMedia}
                alt={content.title}
                watermarkLogoUrl={content.watermark_logo_url}
                watermarkWebsiteUrl={content.watermark_website_url}
                watermarkPosition={content.watermark_position}
              />
            )}
            {isEnhanced && (
              <div className="absolute bottom-2 left-2 bg-accent/90 text-accent-foreground px-2 py-0.5 rounded text-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Preprocessed
              </div>
            )}
            {(content.preprocessing_status === 'pending' || isReprocessing) && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="flex items-center gap-2 text-white">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span className="text-sm">{isReprocessing ? 'Re-processing...' : 'Processing...'}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Status & Platform badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <Badge className={cn('text-white', statusColors[content.status])}>
            {content.status}
          </Badge>
          <div className={cn('p-1.5 bg-card/80 rounded-full backdrop-blur-sm', platformColors[content.platform])}>
            <PlatformIcon className="w-4 h-4" />
          </div>
        </div>
      </div>

      <CardHeader className="pb-2">
        <h3 className="font-semibold text-foreground line-clamp-1">{content.title}</h3>
        <div className="space-y-2">
          {content.description && (
            <div className="p-2 bg-secondary rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">User's Description:</p>
              <p className="text-sm text-foreground line-clamp-2">{content.description}</p>
            </div>
          )}
          {content.admin_description ? (
            <div className="p-2 bg-primary/10 rounded-lg">
              <p className="text-xs text-primary font-medium mb-1">Admin Caption (for {content.platform}):</p>
              <p className="text-sm text-foreground line-clamp-2">{content.admin_description}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No admin caption set yet</p>
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          {format(new Date(content.created_at), 'MMM d, yyyy')}
        </div>

        {/* Analytics */}
        {showAnalytics && content.status === 'published' && (
          <div className="mt-3 space-y-2">
            <div className="p-3 bg-gradient-to-br from-secondary to-card rounded-lg border border-border">
              <p className="text-xs font-medium text-muted-foreground mb-3">Social Media Analytics</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 bg-card rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-red-400 mb-1">
                    <Heart className="w-4 h-4" />
                    <span className="text-lg font-bold">{content.likes_count || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Likes/Reactions</p>
                </div>
                <div className="text-center p-2 bg-card rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-lg font-bold">{content.comments_count || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Comments</p>
                </div>
                <div className="text-center p-2 bg-card rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
                    <Share2 className="w-4 h-4" />
                    <span className="text-lg font-bold">{content.shares_count || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Shares</p>
                </div>
                <div className="text-center p-2 bg-card rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-purple-400 mb-1">
                    <Eye className="w-4 h-4" />
                    <span className="text-lg font-bold">{content.reach_count || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {content.platform === 'youtube' ? 'Views' : 'Reach'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 pt-2">
        {onApprove && content.status === 'pending' && (
          <Button size="sm" onClick={onApprove} className="flex-1">
            <Check className="w-4 h-4 mr-1" />
            Approve
          </Button>
        )}
        {onReject && content.status === 'pending' && (
          <Button size="sm" variant="outline" onClick={onReject} className="flex-1">
            <X className="w-4 h-4 mr-1" />
            Reject
          </Button>
        )}
        {showScheduleButton && onSchedule && (content.status === 'approved' || content.status === 'pending') && (
          <Button size="sm" onClick={onSchedule} variant="outline" className="flex-1">
            <CalendarIcon className="w-4 h-4 mr-1" />
            Schedule
          </Button>
        )}
        {showPublishButton && onPublish && (
          <Button size="sm" onClick={onPublish} className="flex-1 glow">
            <Send className="w-4 h-4 mr-1" />
            Publish Now
          </Button>
        )}
        {onReprocess && content.media_url && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onReprocess} 
            disabled={isReprocessing || content.preprocessing_status === 'pending'}
            className="flex-1"
          >
            <Wand2 className={cn('w-4 h-4 mr-1', isReprocessing && 'animate-spin')} />
            {isReprocessing ? 'Re-processing...' : 'Re-process Media'}
          </Button>
        )}
        {showAnalytics && onRefreshAnalytics && (
          <Button size="sm" variant="outline" onClick={onRefreshAnalytics} disabled={isRefreshing}>
            <RefreshCw className={cn('w-4 h-4 mr-1', isRefreshing && 'animate-spin')} />
            Refresh Stats
          </Button>
        )}
        {onEdit && (
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Edit className="w-4 h-4" />
          </Button>
        )}
        {onDelete && (
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
