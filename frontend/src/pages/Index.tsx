import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { CreateContentDialog } from '@/components/CreateContentDialog';
import { ExportPostDialog } from '@/components/ExportPostDialog';
import { useContent, type ContentItem } from '@/hooks/useContent';
import { useUserRole } from '@/hooks/useUserRole';
import { Link, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';

export default function Index() {
  const { contents, loading, createContent } = useContent();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exportContent, setExportContent] = useState<ContentItem | null>(null);

  const handleSubmit = async (data: {
    title: string;
    description?: string;
    platform: string;
    media_url?: string;
    scheduled_date?: string;
    media_type?: 'image' | 'video';
  }) => {
    return createContent(data);
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-2 px-4 text-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
        <p className="text-xs text-muted-foreground max-w-sm">
          First request after idle may take up to a minute while the API on Render wakes up.
        </p>
      </div>
    );
  }

  // Only redirect if role is fully loaded and user is definitely admin
  // Wait for roleLoading to be false before redirecting
  if (!roleLoading && isAdmin) {
    return <Navigate to="/admin" replace />;
  }


  return (
    <div className="min-h-screen bg-background">
      <Sidebar onCreateClick={() => setDialogOpen(true)} isAdmin={false} />
      
      <main className="pl-64">
        <div className="p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Upload Your Content</h1>
            <p className="text-muted-foreground">
              Upload images or videos with descriptions. We'll automatically process and enhance them for you.
            </p>
          </div>

          {/* Upload Card */}
          <Card className="mb-8 bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Create New Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg bg-secondary/50">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Upload Images or Videos</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add a title and description. We'll automatically resize and enhance your media.
                  </p>
                </div>
                <button
                  onClick={() => setDialogOpen(true)}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  Upload Content
                </button>
              </div>
            </CardContent>
          </Card>

          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Your recent uploads</h2>
              <Link to="/history" className="text-sm text-primary hover:underline">
                View all history
              </Link>
            </div>
            {loading && contents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading your uploads…</p>
            ) : contents.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Nothing uploaded yet. Use Upload Content and it will appear here.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contents.slice(0, 6).map((item) => {
                  const preview = item.enhanced_media_url || item.media_url;
                  const isVideo = item.media_type === 'video' || preview?.includes('.mp4') || preview?.includes('.mov');
                  return (
                    <Card key={item.id} className="overflow-hidden bg-card border-border">
                      <div className="aspect-video bg-secondary">
                        {preview ? (
                          isVideo ? (
                            <video src={preview} className="h-full w-full object-cover" muted />
                          ) : (
                            <img src={preview} alt={item.title} className="h-full w-full object-cover" />
                          )
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <Upload className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-foreground line-clamp-1">{item.title}</h3>
                          <Badge variant="secondary">{item.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground capitalize">{item.platform}</p>
                        {preview && (item.status === 'approved' || item.preprocessing_status === 'completed') && (
                          <Button
                            size="sm"
                            className="w-full mt-1"
                            onClick={() => setExportContent(item)}
                            disabled={item.preprocessing_status === 'pending'}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download for posting
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <Card className="bg-blue-500/10 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Upload className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">View Your Content History</h3>
                  <p className="text-sm text-muted-foreground">
                    Check the History section in the sidebar to manage submissions and track their status.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <CreateContentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />
      <ExportPostDialog
        open={!!exportContent}
        onOpenChange={(open) => !open && setExportContent(null)}
        content={exportContent}
      />
    </div>
  );
}
