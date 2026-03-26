import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { CreateContentDialog } from '@/components/CreateContentDialog';
import { useContent } from '@/hooks/useContent';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload } from 'lucide-react';

export default function Index() {
  const { loading, createContent } = useContent();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSubmit = async (data: {
    title: string;
    description?: string;
    platform: string;
    media_url?: string;
    scheduled_date?: string;
    media_type?: 'image' | 'video';
  }) => {
      await createContent(data);
  };

  // Show loading while checking role - don't redirect during loading
  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Only redirect if role is fully loaded and user is definitely admin
  // Wait for roleLoading to be false before redirecting
  if (!roleLoading && isAdmin) {
    console.log('✅ Admin detected, redirecting to admin dashboard...');
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

          {/* Quick Info */}
            <Card className="bg-blue-500/10 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Upload className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">View Your Content History</h3>
                    <p className="text-sm text-muted-foreground">
                    Check the "History" section in the sidebar to view all your uploaded content, manage your submissions, and track their status.
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
    </div>
  );
}
