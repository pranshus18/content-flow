import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  AdminAsset,
  AdminAssetCategory,
  ADMIN_ASSET_CATEGORY_LABELS,
  isImageAsset,
  listAdminAssets,
} from '@/lib/adminAssets';
import { errorMessage } from '@/lib/utils';
import { FileText, FolderOpen, Loader2, Search } from 'lucide-react';

type AssetPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: AdminAsset) => void;
  title?: string;
  description?: string;
  categories?: AdminAssetCategory[];
  imagesOnly?: boolean;
};

export function AssetPickerDialog({
  open,
  onOpenChange,
  onSelect,
  title = 'Choose from asset library',
  description = 'Pick a file you uploaded in Assets. Upload new files from the Assets page in the sidebar.',
  categories,
  imagesOnly = false,
}: AssetPickerDialogProps) {
  const [assets, setAssets] = useState<AdminAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await listAdminAssets();
        if (!cancelled) setAssets(rows);
      } catch (error: unknown) {
        if (!cancelled) {
          toast({
            title: 'Could not load assets',
            description: errorMessage(
              error,
              'Run the admin_assets migration in Supabase if this is a new install.',
            ),
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (categories?.length && !categories.includes(asset.category)) return false;
      if (imagesOnly && !isImageAsset(asset)) return false;
      if (!q) return true;
      return (
        asset.name.toLowerCase().includes(q)
        || ADMIN_ASSET_CATEGORY_LABELS[asset.category].toLowerCase().includes(q)
      );
    });
  }, [assets, categories, imagesOnly, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or type…"
            className="pl-9 bg-secondary border-border"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto border border-border rounded-lg bg-secondary/30 p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading library…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4 text-sm text-muted-foreground">
              No matching files yet. Open <strong className="text-foreground font-medium">Assets</strong> in the
              sidebar to upload logos and documents, then pick them here.
            </div>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    className="w-full text-left rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-card/80 transition-colors p-2 flex flex-col gap-2"
                    onClick={() => {
                      onSelect(asset);
                      onOpenChange(false);
                    }}
                  >
                    <div className="aspect-video rounded-md bg-secondary flex items-center justify-center overflow-hidden">
                      {isImageAsset(asset) ? (
                        <img src={asset.file_url} alt="" className="max-h-full max-w-full object-contain p-1" />
                      ) : (
                        <FileText className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground truncate" title={asset.name}>
                        {asset.name}
                      </p>
                      <Badge variant="outline" className="text-[10px] mt-1">
                        {ADMIN_ASSET_CATEGORY_LABELS[asset.category]}
                      </Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
