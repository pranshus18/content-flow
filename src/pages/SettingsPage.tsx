import { Sidebar } from '@/components/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useState, useRef, useEffect } from 'react';
import { CreateContentDialog } from '@/components/CreateContentDialog';
import { Clock, Zap, Bell, Shield, LogOut, Image as ImageIcon, Upload, Loader2, Link as LinkIcon } from 'lucide-react';
import { usePublishingSettings } from '@/hooks/usePublishingSettings';
import { useBrandingSettings } from '@/hooks/useBrandingSettings';
import { useAuth } from '@/hooks/useAuth';
import { useContent } from '@/hooks/useContent';
import { useUserRole } from '@/hooks/useUserRole';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function SettingsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { settings, loading, updateSettings } = usePublishingSettings();
  const { settings: brandingSettings, loading: brandingLoading, updateSettings: updateBrandingSettings } = useBrandingSettings();
  const { user, signOut } = useAuth();
  const { createContent } = useContent();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleSubmit = async (data: {
    title: string;
    description?: string;
    platform: string;
    media_url?: string;
    scheduled_date?: string;
  }) => {
    await createContent(data);
    setDialogOpen(false);
  };

  const handleAutoPublishToggle = async (enabled: boolean) => {
    await updateSettings({ auto_publish_enabled: enabled });
  };

  const handlePublishTimeChange = async (time: string) => {
    await updateSettings({ publish_time: time });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      if (!user) throw new Error('User not authenticated');

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `branding/logo-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('content-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('content-media')
        .getPublicUrl(filePath);

      await updateBrandingSettings({ company_logo_url: publicUrl });
      toast({
        title: 'Logo Uploaded',
        description: 'Company logo has been uploaded successfully. It will be automatically added to all videos.',
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

  // Debounce timer ref for text inputs
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleBrandingUpdate = async (field: string, value: any) => {
    // For text inputs, use debouncing and save silently (no toast notifications)
    // For switches/selects, save immediately with toast
    const isTextInput = ['company_logo_url', 'company_website_url'].includes(field);
    
    if (isTextInput) {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Set new timer - save silently after 1 second of no typing (no toast notification)
      debounceTimerRef.current = setTimeout(async () => {
        await updateBrandingSettings({ [field]: value }, false);
      }, 1000);
    } else {
      // For switches/selects, save immediately with toast
      await updateBrandingSettings({ [field]: value }, true);
    }
  };
  
  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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
            {/* Auto-Publish Settings */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Automated Publishing</CardTitle>
                    <CardDescription>Automatically publish scheduled content at the set time</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-foreground">Enable Auto-Publish</Label>
                    <p className="text-sm text-muted-foreground">Content will be published automatically when scheduled</p>
                  </div>
                  <Switch 
                    checked={settings?.auto_publish_enabled || false} 
                    onCheckedChange={handleAutoPublishToggle}
                    disabled={loading}
                  />
                </div>
                
                {settings?.auto_publish_enabled && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label className="text-foreground">Default Publish Time</Label>
                    <Input
                      type="time"
                      value={settings?.publish_time || '09:00'}
                      onChange={(e) => handlePublishTimeChange(e.target.value)}
                      className="w-40 bg-secondary"
                    />
                    <p className="text-sm text-muted-foreground">
                      Scheduled content will be published around this time daily
                    </p>
                  </div>
                )}

                {!settings?.auto_publish_enabled && (
                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Enable to automatically publish content at scheduled times
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Enhancement */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">AI Media Enhancement</CardTitle>
                    <CardDescription>Automatically enhance images and videos with AI</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  AI-powered media enhancement is available. Use the enhance button on any content card to improve image clarity, color balance, and sharpness.
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

            {/* Media Branding & Watermark - Admin Only */}
            {isAdmin && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Media Branding & Watermark</CardTitle>
                      <CardDescription>Configure automatic logo watermarking for all videos</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-foreground">Enable Automatic Watermarking</Label>
                      <p className="text-sm text-muted-foreground">Automatically add logo to all uploaded videos</p>
                    </div>
                    <Switch 
                      checked={brandingSettings?.watermark_enabled ?? true} 
                      onCheckedChange={(enabled) => handleBrandingUpdate('watermark_enabled', enabled)}
                      disabled={brandingLoading}
                    />
                  </div>

                  {brandingSettings?.watermark_enabled && (
                    <div className="space-y-4 pt-4 border-t border-border">
                      {/* Logo Upload */}
                      <div className="space-y-2">
                        <Label htmlFor="branding-logo">Company Logo (for watermark)</Label>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <Input
                              id="branding-logo"
                              type="text"
                              placeholder="Logo URL or upload image"
                              value={brandingSettings?.company_logo_url || ''}
                              onChange={(e) => handleBrandingUpdate('company_logo_url', e.target.value)}
                              className="bg-secondary border-border"
                            />
                          </div>
                          <div className="relative">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="hidden"
                              id="branding-logo-upload"
                              disabled={uploadingLogo}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => document.getElementById('branding-logo-upload')?.click()}
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
                        {brandingSettings?.company_logo_url && (
                          <div className="mt-2">
                            <img
                              src={brandingSettings.company_logo_url}
                              alt="Logo preview"
                              className="h-16 w-auto object-contain bg-secondary rounded p-2"
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
                          Upload a transparent PNG logo for best results. This logo will appear as a watermark throughout videos and on the end card. Recommended size: 200x200px or smaller.
                        </p>
                      </div>

                      {/* Website URL */}
                      <div className="space-y-2">
                        <Label htmlFor="branding-website">
                          <div className="flex items-center gap-2">
                            <LinkIcon className="w-4 h-4" />
                            Company Website URL
                          </div>
                        </Label>
                        <Input
                          id="branding-website"
                          type="url"
                          placeholder="https://yourcompany.com"
                          value={brandingSettings?.company_website_url || ''}
                          onChange={(e) => handleBrandingUpdate('company_website_url', e.target.value)}
                          className="bg-secondary border-border"
                        />
                        <p className="text-xs text-muted-foreground">
                          Optional: Website URL to display with the logo watermark.
                        </p>
                      </div>

                      {/* Watermark Position */}
                      <div className="space-y-2">
                        <Label htmlFor="watermark-position">Watermark Position</Label>
                        <Select
                          value={brandingSettings?.watermark_position || 'bottom-right'}
                          onValueChange={(value) => handleBrandingUpdate('watermark_position', value)}
                        >
                          <SelectTrigger className="bg-secondary border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="top-left">Top Left</SelectItem>
                            <SelectItem value="top-right">Top Right</SelectItem>
                            <SelectItem value="bottom-left">Bottom Left</SelectItem>
                            <SelectItem value="bottom-right">Bottom Right</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Position where the logo will appear on videos (also applies to end-of-video logo).
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Platform Connections */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Shield className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Platform Connections</CardTitle>
                    <CardDescription>Connect your social media accounts</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Platform integrations for direct publishing to Instagram, Facebook, and YouTube coming soon.
                </p>
                <Button variant="outline" disabled>
                  Connect Platforms (Coming Soon)
                </Button>
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
