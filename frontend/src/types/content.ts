export type ContentStatus = 'draft' | 'pending' | 'approved' | 'scheduled' | 'published';

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  status: ContentStatus;
  scheduledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  platform?: 'instagram' | 'facebook' | 'youtube';
}

export const STATUS_CONFIG: Record<ContentStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'status-draft' },
  pending: { label: 'Pending Review', color: 'status-pending' },
  approved: { label: 'Approved', color: 'status-approved' },
  scheduled: { label: 'Scheduled', color: 'status-scheduled' },
  published: { label: 'Published', color: 'status-published' },
};
