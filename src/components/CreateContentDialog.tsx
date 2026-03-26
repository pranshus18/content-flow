import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Upload, X, Loader2, Instagram, Facebook, Youtube, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContentItem } from '@/hooks/useContent';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface CreateContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (content: {
    title: string;
    description?: string;
    platform: string;
    media_url?: string;
    scheduled_date?: string;
    media_type?: 'image' | 'video';
  }) => void;
  editContent?: ContentItem | null;
  initialScheduledDate?: Date; // For scheduling from calendar
  enableScheduling?: boolean; // Show scheduling UI
}

export function CreateContentDialog({ open, onOpenChange, onSubmit, editContent, initialScheduledDate, enableScheduling = false }: CreateContentDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [platform, setPlatform] = useState<string>('instagram');
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(initialScheduledDate);
  const [scheduledTime, setScheduledTime] = useState<string>('09:00');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (editContent) {
      setTitle(editContent.title);
      setDescription(editContent.description || '');
      setMediaUrl(editContent.media_url || '');
      setPlatform(editContent.platform);
      if (editContent.scheduled_date) {
        const scheduledDate = new Date(editContent.scheduled_date);
        setScheduledAt(scheduledDate);
        // Extract time from scheduled date
        const hours = scheduledDate.getHours().toString().padStart(2, '0');
        const minutes = scheduledDate.getMinutes().toString().padStart(2, '0');
        setScheduledTime(`${hours}:${minutes}`);
      } else {
        setScheduledAt(undefined);
        setScheduledTime('09:00');
      }
    } else if (initialScheduledDate) {
      setScheduledAt(initialScheduledDate);
    } else {
      resetForm();
    }
  }, [editContent, open, initialScheduledDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: 'Title Required',
        description: 'Please enter a title for your content.',
        variant: 'destructive',
      });
      return;
    }

    if (!mediaFile && !editContent) {
      toast({
        title: 'Media Required',
        description: 'Please upload an image or video.',
        variant: 'destructive',
      });
      return;
    }
    
    let finalMediaUrl = mediaUrl;
    
    // Upload file to Supabase storage if a new file was selected
    if (mediaFile && user) {
      setUploading(true);
      try {
        finalMediaUrl = await uploadMedia(mediaFile);
        
        if (!finalMediaUrl) {
          toast({
            title: 'Upload Failed',
            description: 'Failed to upload media. Please try again.',
            variant: 'destructive',
          });
          setUploading(false);
          return;
        }

        toast({
          title: 'Upload Complete',
          description: 'Your file has been uploaded successfully. Processing will happen automatically in the background.',
        });
      } catch (error: any) {
        console.error('Upload error details:', error);
        toast({
          title: 'Upload Error',
          description: error.message || 'Failed to upload media. Please check file size (max 50MB) and try again.',
          variant: 'destructive',
        });
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }
    
    // Ensure media_type is set correctly based on file or URL
    const detectedMediaType = mediaType || 
      (finalMediaUrl?.includes('.mp4') || finalMediaUrl?.includes('.mov') || finalMediaUrl?.includes('.webm') || finalMediaUrl?.includes('video') ? 'video' : 'image');
    
    // Combine date and time for scheduled_date
    let finalScheduledDate: string | undefined = undefined;
    if (scheduledAt) {
      const [hours, minutes] = scheduledTime.split(':');
      const scheduledDateTime = new Date(scheduledAt);
      scheduledDateTime.setHours(parseInt(hours, 10));
      scheduledDateTime.setMinutes(parseInt(minutes, 10));
      scheduledDateTime.setSeconds(0);
      scheduledDateTime.setMilliseconds(0);
      finalScheduledDate = scheduledDateTime.toISOString();
    }
    
    // Use the selected platform for new content (users select platform)
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      platform: platform, // Use user-selected platform
      media_url: finalMediaUrl || undefined,
      scheduled_date: finalScheduledDate,
      media_type: detectedMediaType,
    });
    
    resetForm();
    onOpenChange(false);
  };

  // Helper function to resize image using canvas
  const resizeImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1920, quality: number = 0.9): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;

          // Only resize if image is larger than max dimensions
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
          }

          // Create canvas and resize
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Draw resized image
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob and then to File
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob'));
                return;
              }
              const resizedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(resizedFile);
            },
            file.type,
            quality
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const uploadMedia = async (file: File): Promise<string | null> => {
    if (!user) return null;

    try {
      let fileToUpload = file;

      // OPTIMIZED: Skip ALL client-side processing for fastest uploads
      // Upload original file immediately - server will handle all processing in background
      // This makes uploads instant (no waiting for compression/resizing)
      
      // Skip image compression entirely - upload original and let server handle it
      // This makes uploads much faster, especially for large images
      fileToUpload = file;

      // For videos: Upload immediately, process with logo in background (FAST UPLOAD!)
      // Logo processing happens server-side after upload via preprocess-media edge function
      if (file.type.startsWith('video/')) {
        console.log('Uploading video - logo will be added server-side after upload:', {
          size: `${(file.size / (1024 * 1024)).toFixed(1)}MB`,
          type: file.type,
          note: 'Fast upload - processing happens in background'
        });
        // Upload original video immediately - logo processing happens server-side
        // This makes uploads fast (seconds instead of minutes)
      }

      // Get file extension
      const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const fileName = `${user.id}/${timestamp}-${randomId}.${fileExt}`;
      const filePath = `${fileName}`;

      // Show upload progress (minimal UI feedback for speed)
      setUploadProgress(20);
      
      // Upload file to Supabase storage (FAST - no processing, just upload)
      // Processing happens completely in background after upload completes
      const { data, error } = await supabase.storage
        .from('content-media')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
          contentType: fileToUpload.type,
        });

      if (error) {
        console.error('Upload error:', error);
        setUploadProgress(0);
        throw error;
      }

      setUploadProgress(100);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('content-media')
        .getPublicUrl(filePath);

      console.log('File uploaded successfully:', {
        fileName: fileToUpload.name,
        fileSize: fileToUpload.size,
        fileType: fileToUpload.type,
        url: urlData.publicUrl,
        note: 'Processing will happen server-side'
      });

      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Error uploading media:', error);
      setUploadProgress(0);
      throw error;
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setMediaUrl('');
    setMediaFile(null);
    setMediaType(null);
    setPlatform('instagram');
    setScheduledAt(initialScheduledDate);
    setScheduledTime('09:00');
    setUploadProgress(0);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload an image or video file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (different limits for images vs videos)
    const isVideo = file.type.startsWith('video/');
    const maxImageSize = 50 * 1024 * 1024; // 50MB for images
    const maxVideoSize = 500 * 1024 * 1024; // 500MB for videos
    
    if (isVideo && file.size > maxVideoSize) {
      toast({
        title: 'Video Too Large',
        description: 'Please upload a video smaller than 500MB. Large videos will be compressed during processing.',
        variant: 'destructive',
      });
      return;
    } else if (!isVideo && file.size > maxImageSize) {
      toast({
        title: 'Image Too Large',
        description: 'Please upload an image smaller than 50MB.',
        variant: 'destructive',
      });
      return;
    }

    setMediaFile(file);
    
    // Determine media type (isVideo already declared above)
    setMediaType(isVideo ? 'video' : 'image');

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] bg-card border-border flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-semibold">
            {editContent ? 'Edit Content' : 'Create New Content'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 space-y-5 mt-4">
          <div className="flex-1 overflow-y-auto pr-2 space-y-5">
          {/* Media Upload */}
          <div className="space-y-2">
            <Label>Media</Label>
            <div
              className={cn(
                'relative border-2 border-dashed rounded-lg transition-colors cursor-pointer overflow-hidden',
                dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                mediaUrl ? 'h-48' : 'h-32'
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              
              {mediaUrl ? (
                <>
                  {mediaType === 'video' ? (
                    <video src={mediaUrl} className="w-full h-full object-contain" controls />
                  ) : (
                  <img src={mediaUrl} alt="Preview" className="w-full h-full object-contain" />
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMediaUrl('');
                      setMediaFile(null);
                      setMediaType(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <p className="text-sm">Drop images or videos here or click to upload</p>
                  <p className="text-xs">Max size: 50MB</p>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="bg-card rounded-lg p-4 flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-sm">Uploading media...</p>
                    {uploadProgress > 0 && (
                      <div className="w-48 h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Enter content title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-secondary border-border"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Write your content description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-secondary border-border resize-none"
            />
          </div>

          {/* Platform Selection - Required for users */}
          <div className="space-y-2">
            <Label htmlFor="platform">Social Media Platform *</Label>
            <Select value={platform} onValueChange={setPlatform} required>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Select platform for posting" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">
                  <div className="flex items-center gap-2">
                    <Instagram className="w-4 h-4" />
                    Instagram (1080x1080 - Square)
                  </div>
                </SelectItem>
                <SelectItem value="facebook">
                  <div className="flex items-center gap-2">
                    <Facebook className="w-4 h-4" />
                    Facebook (1200x630 - Link Preview)
                  </div>
                </SelectItem>
                <SelectItem value="youtube">
                  <div className="flex items-center gap-2">
                    <Youtube className="w-4 h-4" />
                    YouTube (1920x1080 - 16:9)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Your image/video will be automatically resized and optimized for {platform.charAt(0).toUpperCase() + platform.slice(1)} posting format
            </p>
          </div>

          {/* Scheduling (shown when enableScheduling is true or when editing) */}
          {(enableScheduling || editContent) && (
            <div className="space-y-2">
              <Label>Schedule Post (Optional)</Label>
              <div className="grid grid-cols-2 gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-secondary border-border",
                        !scheduledAt && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledAt ? format(scheduledAt, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledAt}
                      onSelect={setScheduledAt}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="pl-10 bg-secondary border-border"
                    disabled={!scheduledAt}
                  />
                </div>
              </div>
              {scheduledAt && (
                <p className="text-xs text-muted-foreground">
                  Post will be scheduled for {format(scheduledAt, "PPP")} at {scheduledTime}
                </p>
              )}
              {scheduledAt && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setScheduledAt(undefined);
                    setScheduledTime('09:00');
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear schedule
                </Button>
              )}
            </div>
          )}
          </div>

          <DialogFooter className="flex-shrink-0 pt-4 border-t border-border mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button type="submit" className="glow" disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                editContent ? 'Save Changes' : 'Create Content'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
