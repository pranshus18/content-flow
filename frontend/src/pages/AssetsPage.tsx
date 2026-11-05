import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { errorMessage } from '@/lib/utils';
import {
  AdminAsset,
  AdminAssetCategory,
  ADMIN_ASSET_CATEGORY_LABELS,
  deleteAdminAsset,
  isImageAsset,
  listAdminAssets,
  uploadAdminAsset,
} from '@/lib/adminAssets';
import {
  Copy,
  FileText,
  FolderOpen,
  Loader2,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';

let cachedAdminAssets: AdminAsset[] | null = null;
let cachedAssetsOwnerId: string | null = null;

export default function AssetsPage() {
  const { user } = useAuth();
  const cacheValid = Boolean(user && cachedAssetsOwnerId === user.id && cachedAdminAssets);
  const [assets, setAssets] = useState<AdminAsset[]>(cacheValid ? cachedAdminAssets! : []);
  const [loading, setLoading] = useState(!cacheValid);
  const hasLoadedOnceRef = useRef(cacheValid);
  const [uploading, setUploading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<AdminAssetCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [uploadCategory, setUploadCategory] = useState<AdminAssetCategory>('platform_logo');
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const loadAssets = useCallback(async (background = false) => {
    const showLoader = !hasLoadedOnceRef.current && !background;
    if (showLoader) setLoading(true);
    try {
      const rows = await listAdminAssets();
      cachedAdminAssets = rows;
      cachedAssetsOwnerId = user?.id ?? null;
      hasLoadedOnceRef.current = true;
      setAssets(rows);
    } catch (error: unknown) {
      toast({
        title: 'Could not load assets',
        description: errorMessage(
          error,
          'Apply the admin_assets migration in Supabase SQL, then refresh.',
        ),
        variant: 'destructive',
      });
    } finally {
      if (showLoader) setLoading(false);
      hasLoadedOnceRef.current = true;
    }
  }, [toast]);

  useEffect(() => {
    if (!user) return;
    if (cachedAssetsOwnerId === user.id && cachedAdminAssets) {
      setAssets(cachedAdminAssets);
      setLoading(false);
      hasLoadedOnceRef.current = true;
      return;
    }
    cachedAdminAssets = null;
    cachedAssetsOwnerId = null;
    hasLoadedOnceRef.current = false;
    void loadAssets();
  }, [user?.id, loadAssets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (filterCategory !== 'all' && a.category !== filterCategory) return false;
      if (!q) return true;
      return a.name.toLowerCase().includes(q);
    });
  }, [assets, filterCategory, search]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadAdminAsset(file, { category: uploadCategory });
      }
      toast({
        title: 'Uploaded',
        description:
          files.length === 1
            ? 'File added to your asset library.'
            : `${files.length} files added to your asset library.`,
      });
      await loadAssets();
    } catch (error: unknown) {
      toast({
        title: 'Upload failed',
        description: errorMessage(error, 'Could not upload to the asset library.'),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (asset: AdminAsset) => {
    if (
      !window.confirm(
        `Delete "${asset.name}" from the library?\n\nThe file and database record will be removed. Any posts using this logo, frame, or music will have that field cleared.`,
      )
    ) {
      return;
    }
    try {
      await deleteAdminAsset(asset);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      toast({
        title: 'Deleted',
        description: 'Removed from storage and database. Linked post fields were cleared.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Delete failed',
        description: errorMessage(error, 'Could not delete this asset.'),
        variant: 'destructive',
      });
    }
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Copied', description: 'File URL copied to clipboard.' });
    } catch {
      toast({
        title: 'Copy failed',
        description: url,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onCreateClick={() => {}} isAdmin />

      <main className="pl-64">
        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-b border-primary/20 px-8 py-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-primary">ADMIN PORTAL</span>
            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-xs">
              Assets
            </Badge>
          </div>
        </div>

        <div className="p-8 max-w-6xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
              <FolderOpen className="w-7 h-7 text-primary" />
              Asset library
            </h1>
            <p className="text-muted-foreground text-sm max-w-2xl">
              Upload logos, intro/outro frames, and documents once. When you edit content and click Upload on a
              logo or frame, choose <strong className="text-foreground font-medium">Library</strong> to pick from
              here.
            </p>
          </div>

          <Card className="bg-card border-border mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Upload files</CardTitle>
              <CardDescription>PNG logos with transparency work best. PDFs and other docs are supported too.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-4 sm:items-end">
              <div className="space-y-2 flex-1 max-w-xs">
                <Label>Category</Label>
                <Select
                  value={uploadCategory}
                  onValueChange={(v) => setUploadCategory(v as AdminAssetCategory)}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ADMIN_ASSET_CATEGORY_LABELS) as AdminAssetCategory[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {ADMIN_ASSET_CATEGORY_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.pdf,.doc,.docx,.txt,.svg"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button
                type="button"
                className="glow shrink-0"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload to library
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Input
              placeholder="Search assets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-secondary border-border max-w-sm"
            />
            <Select
              value={filterCategory}
              onValueChange={(v) => setFilterCategory(v as AdminAssetCategory | 'all')}
            >
              <SelectTrigger className="bg-secondary border-border w-full sm:w-52">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(Object.keys(ADMIN_ASSET_CATEGORY_LABELS) as AdminAssetCategory[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {ADMIN_ASSET_CATEGORY_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={() => void loadAssets(true)} disabled={loading && assets.length === 0}>
              Refresh
            </Button>
          </div>

          {loading && assets.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading assets…
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                No assets yet. Upload platform logos, vendor logos, and template frames above.
              </CardContent>
            </Card>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((asset) => (
                <li key={asset.id}>
                  <Card className="bg-card border-border overflow-hidden h-full">
                    <div className="aspect-video bg-secondary flex items-center justify-center border-b border-border">
                      {isImageAsset(asset) ? (
                        <img
                          src={asset.file_url}
                          alt={asset.name}
                          className="max-h-full max-w-full object-contain p-3"
                        />
                      ) : (
                        <FileText className="w-12 h-12 text-muted-foreground" />
                      )}
                    </div>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <p className="font-medium text-foreground truncate" title={asset.name}>
                          {asset.name}
                        </p>
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {ADMIN_ASSET_CATEGORY_LABELS[asset.category]}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" asChild>
                          <a href={asset.file_url} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => copyUrl(asset.file_url)}>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copy URL
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(asset)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
