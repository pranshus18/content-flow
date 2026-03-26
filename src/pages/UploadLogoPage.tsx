import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBrandingSettings } from '@/hooks/useBrandingSettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, CheckCircle2, Copy } from 'lucide-react';

export default function UploadLogoPage() {
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { user } = useAuth();
  const { updateSettings } = useBrandingSettings();
  const { toast } = useToast();

  const uploadLogoFromPublic = async () => {
    if (!user) {
      toast({
        title: 'Not Authenticated',
        description: 'Please log in first.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      // Fetch the logo from the public folder
      const logoPath = '/Screenshot%202026-01-15%20at%2010.58.35%20PM.png';
      const response = await fetch(logoPath);
      
      if (!response.ok) {
        throw new Error('Could not fetch logo file. Make sure it exists in the public folder.');
      }

      const blob = await response.blob();
      const fileName = 'tatva-ops-logo.png';
      const filePath = `branding/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('content-media')
        .upload(filePath, blob, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        // If file exists, try to update
        if (uploadError.message?.includes('already exists') || uploadError.message?.includes('duplicate')) {
          const { error: updateError } = await supabase.storage
            .from('content-media')
            .update(filePath, blob, {
              contentType: 'image/png',
              cacheControl: '3600',
            });
          
          if (updateError) throw updateError;
        } else {
          throw uploadError;
        }
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('content-media')
        .getPublicUrl(filePath);

      setLogoUrl(publicUrl);

      // Automatically update branding settings with the new logo URL
      await updateSettings({ company_logo_url: publicUrl });

      toast({
        title: 'Logo Uploaded Successfully',
        description: 'The logo has been uploaded and saved to your branding settings.',
      });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      let errorMessage = error.message || 'Could not upload logo.';
      
      if (errorMessage.includes('row-level security') || errorMessage.includes('RLS')) {
        errorMessage = 'Permission denied. Please make sure you are logged in as an admin user.';
      } else if (errorMessage.includes('JWT') || errorMessage.includes('token')) {
        errorMessage = 'Authentication error. Please log in again.';
      }

      toast({
        title: 'Upload Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const copyUrl = async () => {
    if (logoUrl) {
      await navigator.clipboard.writeText(logoUrl);
      toast({
        title: 'URL Copied',
        description: 'Logo URL has been copied to clipboard.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Logo to Supabase
            </CardTitle>
            <CardDescription>
              Upload your logo from the public folder to Supabase storage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                <strong>File:</strong> Screenshot 2026-01-15 at 10.58.35 PM.png
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Destination:</strong> content-media/branding/tatva-ops-logo.png
              </p>
              <p className="text-sm text-muted-foreground">
                The logo will be automatically saved to your branding settings.
              </p>
            </div>

            <Button
              onClick={uploadLogoFromPublic}
              disabled={uploading || !user}
              className="w-full"
              size="lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Logo
                </>
              )}
            </Button>

            {!user && (
              <p className="text-sm text-muted-foreground text-center">
                Please log in to upload the logo.
              </p>
            )}

            {logoUrl && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                      ✅ Logo uploaded successfully!
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded flex-1 break-all">
                        {logoUrl}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyUrl}
                        className="shrink-0"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-2">
                      The logo URL has been automatically saved to your branding settings.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
