import { ContentItem } from '@/hooks/useContent';
import { ContentCard } from './ContentCard';
import { cn } from '@/lib/utils';

interface ContentPipelineProps {
  contents: ContentItem[];
  onStatusChange: (id: string, status: string) => void;
  onEdit: (content: ContentItem) => void;
  onDelete: (id: string) => void;
  onEnhance?: (id: string, imageUrl: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-400' },
  pending: { label: 'Pending Review', color: 'bg-yellow-500' },
  approved: { label: 'Approved', color: 'bg-blue-500' },
  scheduled: { label: 'Scheduled', color: 'bg-purple-500' },
  published: { label: 'Published', color: 'bg-green-500' },
};

const PIPELINE_ORDER = ['draft', 'pending', 'approved', 'scheduled', 'published'];

export function ContentPipeline({ contents, onStatusChange, onEdit, onDelete, onEnhance }: ContentPipelineProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-6">
      {PIPELINE_ORDER.map((status, index) => {
        const statusContents = contents.filter(c => c.status === status);
        const config = STATUS_CONFIG[status];
        
        return (
          <div 
            key={status} 
            className="flex flex-col animate-fade-up"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Column Header */}
            <div className="flex items-center gap-2 mb-4 px-1">
              <span className={cn('w-2.5 h-2.5 rounded-full', config.color)} />
              <h3 className="font-medium text-sm text-foreground">
                {config.label}
              </h3>
              <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {statusContents.length}
              </span>
            </div>

            {/* Cards Container */}
            <div className="flex-1 space-y-3 min-h-[200px]">
              {statusContents.length === 0 ? (
                <div className="h-32 rounded-lg border border-dashed border-border/50 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">No content</p>
                </div>
              ) : (
                statusContents.map((content, i) => (
                  <div 
                    key={content.id}
                    className="animate-scale-in"
                    style={{ animationDelay: `${(index * 100) + (i * 50)}ms` }}
                  >
                    <ContentCard
                      content={content}
                      onStatusChange={onStatusChange}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onEnhance={onEnhance}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
