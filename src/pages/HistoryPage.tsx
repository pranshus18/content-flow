import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { useContent, ContentItem } from '@/hooks/useContent';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ImageViewer } from '@/components/ImageViewer';
import { Image as ImageIcon, Video, Clock, CheckCircle, Loader2, Trash2, History, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function HistoryPage() {
  const { contents, loading, deleteContent } = useContent();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contentToDelete, setContentToDelete] = useState<ContentItem | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);

  // Filter to show only user's content (all content for history)
  const allUserContents = contents; // Already filtered by user_id in useContent hook
  const pendingContent = allUserContents.filter(c => c.status === 'pending');
  const approvedContent = allUserContents.filter(c => c.status === 'approved' || c.status === 'scheduled');
  const publishedContent = allUserContents.filter(c => c.status === 'published');

  const handleDeleteClick = (content: ContentItem) => {
    setContentToDelete(content);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (contentToDelete) {
      await deleteContent(contentToDelete.id);
      setDeleteDialogOpen(false);
      setContentToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onCreateClick={() => {}} isAdmin={false} />
      
      <main className="pl-64">
        <div className="p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
              <History className="w-8 h-8" />
              My Content History
            </h1>
            <p className="text-muted-foreground">
              View and manage all your uploaded content
            </p>
          </div>

          {/* Content History with Tabs */}
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="bg-secondary">
              <TabsTrigger value="all">All Content ({allUserContents.length})</TabsTrigger>
              <TabsTrigger value="pending">
                Pending ({pendingContent.length})
              </TabsTrigger>
              <TabsTrigger value="approved">Approved ({approvedContent.length})</TabsTrigger>
              <TabsTrigger value="published">Published ({publishedContent.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {allUserContents.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="py-12 text-center">
                    <ImageIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">No content yet. Upload your first content from the home page!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allUserContents.map((content) => (
                    <ContentCard 
                      key={content.id} 
                      content={content} 
                      onDelete={handleDeleteClick}
                      onImageClick={(content) => {
                        setSelectedContent(content);
                        setImageDialogOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pending" className="space-y-4">
              {pendingContent.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No pending content</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingContent.map((content) => (
                    <ContentCard 
                      key={content.id} 
                      content={content} 
                      onDelete={handleDeleteClick}
                      onImageClick={(content) => {
                        setSelectedContent(content);
                        setImageDialogOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="approved" className="space-y-4">
              {approvedContent.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No approved content</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {approvedContent.map((content) => (
                    <ContentCard 
                      key={content.id} 
                      content={content} 
                      onDelete={handleDeleteClick}
                      onImageClick={(content) => {
                        setSelectedContent(content);
                        setImageDialogOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="published" className="space-y-4">
              {publishedContent.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No published content</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {publishedContent.map((content) => (
                    <ContentCard 
                      key={content.id} 
                      content={content} 
                      onDelete={handleDeleteClick}
                      onImageClick={(content) => {
                        setSelectedContent(content);
                        setImageDialogOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{contentToDelete?.title}"? This action cannot be undone and will permanently remove this content from your history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Preview Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] p-0 bg-black/95 border-none">
          <div className="relative w-full h-full flex items-center justify-center">
            {selectedContent && (
              <>
                {(() => {
                  const displayMedia = selectedContent.enhanced_media_url || selectedContent.media_url;
                  const isVideo = selectedContent.media_type === 'video' || 
                                 displayMedia?.includes('.mp4') || 
                                 displayMedia?.includes('.mov') || 
                                 displayMedia?.includes('.webm');
                  
                  return isVideo ? (
                    <div className="max-w-full max-h-[90vh]">
                      <VideoPlayer
                        src={displayMedia || ''}
                        controls
                        watermarkLogoUrl={selectedContent.watermark_logo_url}
                        watermarkWebsiteUrl={selectedContent.watermark_website_url}
                        watermarkPosition={selectedContent.watermark_position}
                        textOverlays={selectedContent.video_text_overlays}
                      />
                    </div>
                  ) : (
                    <ImageViewer
                      src={displayMedia || ''}
                      alt={selectedContent.title}
                      className="max-w-full max-h-[90vh]"
                      watermarkLogoUrl={selectedContent.watermark_logo_url}
                      watermarkWebsiteUrl={selectedContent.watermark_website_url}
                      watermarkPosition={selectedContent.watermark_position}
                    />
                  );
                })()}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full"
                  onClick={() => setImageDialogOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
                <div className="absolute bottom-4 left-4 right-4 bg-black/50 text-white px-4 py-2 rounded-lg">
                  <p className="font-semibold">{selectedContent.title}</p>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Content Card Component
function ContentCard({ 
  content, 
  onDelete,
  onImageClick 
}: { 
  content: ContentItem; 
  onDelete: (content: ContentItem) => void;
  onImageClick: (content: ContentItem) => void;
}) {
  const displayMedia = content.enhanced_media_url || content.media_url;
  const isVideo = displayMedia?.includes('.mp4') || displayMedia?.includes('.mov') || displayMedia?.includes('.webm');
  const isProcessing = content.preprocessing_status === 'pending';
  const isProcessed = content.preprocessing_status === 'completed';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'approved':
      case 'scheduled':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'published':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      default:
        return 'bg-secondary text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Under Review';
      case 'approved':
        return 'Approved';
      case 'scheduled':
        return 'Scheduled';
      case 'published':
        return 'Published';
      default:
        return status;
    }
  };

  return (
    <Card className="overflow-hidden bg-card border-border hover:border-primary/30 transition-all group">
      {/* Media Preview */}
      <div className="relative aspect-video bg-secondary">
        {displayMedia ? (
          <>
            {isVideo ? (
              <div onClick={(e) => {
                e.stopPropagation();
                onImageClick(content);
              }}>
                <VideoPlayer
                  src={displayMedia}
                  controls
                  muted
                  watermarkLogoUrl={content.watermark_logo_url}
                  watermarkWebsiteUrl={content.watermark_website_url}
                  watermarkPosition={content.watermark_position}
                  textOverlays={content.video_text_overlays}
                />
              </div>
            ) : (
              <div onClick={(e) => {
                e.stopPropagation();
                onImageClick(content);
              }}>
                <ImageViewer
                  src={displayMedia}
                  alt={content.title}
                  className="w-full h-full cursor-pointer hover:opacity-90 transition-opacity"
                  watermarkLogoUrl={content.watermark_logo_url}
                  watermarkWebsiteUrl={content.watermark_website_url}
                  watermarkPosition={content.watermark_position}
                />
              </div>
            )}
            {isProcessed && (
              <div className="absolute top-2 right-2 bg-green-500/90 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Processed
              </div>
            )}
            {isProcessing && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="flex items-center gap-2 text-white">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Processing...</span>
                </div>
              </div>
            )}
            {/* Delete Button - appears on hover */}
            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="destructive"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDelete(content)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isVideo ? (
              <Video className="w-12 h-12 text-muted-foreground/30" />
            ) : (
              <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
            )}
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold text-foreground line-clamp-1 mb-2">
          {content.title}
        </h3>
        {content.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {content.description}
          </p>
        )}
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {format(new Date(content.created_at), 'MMM d, yyyy')}
          </div>
          <Badge 
            variant="outline"
            className={cn(getStatusColor(content.status))}
          >
            {getStatusLabel(content.status)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

