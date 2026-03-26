import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ImageViewer } from '@/components/ImageViewer';
import { 
  Image as ImageIcon, 
  Video, 
  Clock, 
  User, 
  Mail, 
  FileText,
  Instagram,
  Facebook,
  Sparkles,
  CheckCircle,
  Calendar,
  Send
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface UserContentItem {
  id: string;
  title: string;
  description: string | null;
  admin_description: string | null;
  admin_notes: string | null;
  status: string;
  platform: string;
  media_url: string | null;
  media_type: string | null;
  enhanced_media_url: string | null;
  original_media_url: string | null;
  scheduled_date: string | null;
  published_at: string | null;
  preprocessing_status: string | null;
  social_post_id: string | null;
  likes_count: number | null;
  comments_count: number | null;
  shares_count: number | null;
  reach_count: number | null;
  created_at: string;
  updated_at: string;
}

interface ContentViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: UserContentItem | null;
  userEmail?: string | null;
  userFirstName?: string | null;
  userLastName?: string | null;
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
  draft: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  approved: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  scheduled: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  published: 'bg-green-500/10 text-green-600 border-green-500/20',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
};

export function ContentViewDialog({ 
  open, 
  onOpenChange, 
  content,
  userEmail,
  userFirstName,
  userLastName
}: ContentViewDialogProps) {
  if (!content) return null;

  const displayMedia = content.enhanced_media_url || content.media_url;
  const isVideo = content.media_type === 'video' || 
                 displayMedia?.includes('.mp4') || 
                 displayMedia?.includes('.mov') || 
                 displayMedia?.includes('.webm') ||
                 displayMedia?.includes('.avi') ||
                 displayMedia?.includes('.mkv');
  const PlatformIcon = platformIcons[content.platform] || FileText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] bg-card border-border flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0 pb-4 border-b border-border">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Content Details
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6 mt-4">
          {/* User Info */}
          {(userEmail || userFirstName || userLastName) && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm mb-2">
                <User className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-foreground">Submitted By:</span>
              </div>
              <div className="space-y-1 ml-6">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium text-foreground">
                    {userFirstName || userLastName
                      ? `${userFirstName || ''} ${userLastName || ''}`.trim() || 'Unknown User'
                      : 'Unknown User'}
                  </span>
                </div>
                {userEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium text-foreground font-mono text-sm">{userEmail}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Media Preview */}
          {displayMedia && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Media Preview</h3>
                {content.enhanced_media_url && (
                  <Badge variant="outline" className="text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Preprocessed & Enhanced
                  </Badge>
                )}
                {content.preprocessing_status === 'completed' && (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Processed
                  </Badge>
                )}
                {content.preprocessing_status === 'pending' && (
                  <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                    Processing...
                  </Badge>
                )}
              </div>
              <div className="aspect-video bg-secondary rounded-lg overflow-hidden border border-border">
                {isVideo ? (
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
              </div>
            </div>
          )}

          {/* Title and Basic Info */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{content.title}</h3>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn('text-xs', statusColors[content.status] || statusColors.draft)}
                >
                  {statusLabels[content.status] || content.status}
                </Badge>
                <Badge variant="outline" className={cn('text-xs', platformColors[content.platform])}>
                  <PlatformIcon className="w-3 h-3 mr-1" />
                  {content.platform}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  Created: {format(new Date(content.created_at), 'MMM d, yyyy h:mm a')}
                </div>
                {content.updated_at !== content.created_at && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Updated: {format(new Date(content.updated_at), 'MMM d, yyyy h:mm a')}
                  </div>
                )}
              </div>
            </div>

            {/* User's Description */}
            {content.description && (
              <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">User's Description:</span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{content.description}</p>
              </div>
            )}

            {/* Admin Description */}
            {content.admin_description && (
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Send className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">Admin Caption (for {content.platform}):</span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{content.admin_description}</p>
              </div>
            )}

            {/* Admin Notes */}
            {content.admin_notes && (
              <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-600">Internal Notes:</span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{content.admin_notes}</p>
              </div>
            )}
          </div>

          {/* Dates and Scheduling */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/30 rounded-lg border border-border">
            {content.scheduled_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Scheduled Date:</p>
                  <p className="text-sm font-medium text-foreground">
                    {format(new Date(content.scheduled_date), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            )}
            {content.published_at && (
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Published At:</p>
                  <p className="text-sm font-medium text-foreground">
                    {format(new Date(content.published_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            )}
            {content.social_post_id && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Social Post ID:</p>
                <p className="text-sm font-mono text-foreground break-all">{content.social_post_id}</p>
              </div>
            )}
          </div>

          {/* Analytics (if published) */}
          {content.status === 'published' && (
            <div className="p-4 bg-gradient-to-br from-secondary to-card rounded-lg border border-border">
              <h4 className="text-sm font-semibold text-foreground mb-3">Social Media Analytics</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center p-3 bg-card rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-red-400 mb-1">
                    <span className="text-lg font-bold">{content.likes_count || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Likes/Reactions</p>
                </div>
                <div className="text-center p-3 bg-card rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
                    <span className="text-lg font-bold">{content.comments_count || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Comments</p>
                </div>
                <div className="text-center p-3 bg-card rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
                    <span className="text-lg font-bold">{content.shares_count || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Shares</p>
                </div>
                <div className="text-center p-3 bg-card rounded-lg">
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
          )}

          {/* Media Info */}
          <div className="p-4 bg-secondary/30 rounded-lg border border-border">
            <h4 className="text-sm font-semibold text-foreground mb-3">Media Information</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Media Type:</span>
                <span className="ml-2 font-medium text-foreground">
                  {content.media_type || (isVideo ? 'Video' : 'Image')}
                </span>
              </div>
              {content.original_media_url && (
                <div>
                  <span className="text-muted-foreground">Has Original:</span>
                  <span className="ml-2 font-medium text-green-600">Yes</span>
                </div>
              )}
              {content.enhanced_media_url && (
                <div>
                  <span className="text-muted-foreground">Has Enhanced:</span>
                  <span className="ml-2 font-medium text-green-600">Yes</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

