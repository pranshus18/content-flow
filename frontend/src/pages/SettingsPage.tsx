import { Sidebar } from '@/components/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';
import { CreateContentDialog } from '@/components/CreateContentDialog';
import { Zap, Bell, Shield, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useContent } from '@/hooks/useContent';
import { useUserRole } from '@/hooks/useUserRole';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { createContent } = useContent();
  const { isAdmin } = useUserRole();

  const handleSubmit = async (data: {
    title: string;
    description?: string;
    platform: string;
    media_url?: string;
    scheduled_date?: string;
  }) => {
    return createContent(data);
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onCreateClick={() => setDialogOpen(true)} isAdmin />
      
      <main className="pl-64">
        {/* Admin Banner */}
        {isAdmin && (
          <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-b border-primary/20 px-8 py-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-primary">ADMIN PORTAL</span>
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-xs">
                Settings
              </Badge>
            </div>
          </div>
        )}
        <div className="p-8 max-w-4xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
                Settings
                {isAdmin && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    Admin
                  </Badge>
                )}
              </h1>
              <p className="text-muted-foreground text-sm">
                Configure your ContentFlow preferences
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{user?.email}</span>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {/* AI Enhancement */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">AI Media Enhancement</CardTitle>
                    <CardDescription>Admin-triggered photo and video quality upgrade</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Every upload is cropped to the platform size and sharpened.
                  Enhance Quality only improves clarity — it does not add logos, text, intro, outro, or animation.
                  Logos, intro, outro, and the follow CTA are added only when you set them in Edit.
                </p>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Notifications</CardTitle>
                    <CardDescription>Manage your notification preferences</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-foreground">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Get notified when content is published</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-foreground">Approval Reminders</Label>
                    <p className="text-sm text-muted-foreground">Remind when content needs review</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

          </div>
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
