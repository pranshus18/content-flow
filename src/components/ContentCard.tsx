import { ContentItem } from '@/hooks/useContent';
import { StatusBadge } from './StatusBadge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MoreHorizontal, Image as ImageIcon, Sparkles, Send } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ContentCardProps {
  content: ContentItem;
  onStatusChange: (id: string, status: string) => void;
  onEdit: (content: ContentItem) => void;
  onDelete: (id: string) => void;
  onEnhance?: (id: string, imageUrl: string) => void;
}

export function ContentCard({ content, onStatusChange, onEdit, onDelete, onEnhance }: ContentCardProps) {
  const nextStatus: Record<string, string | null> = {
    draft: 'pending',
    pending: null, // Users can't approve - only admin can
    approved: null,
    scheduled: null,
    published: null,
  };

  const actionLabels: Record<string, string> = {
    draft: 'Submit for Review',
    pending: '',
    approved: '',
    scheduled: '',
    published: '',
  };

  const displayMedia = content.enhanced_media_url || content.media_url;
  const hasMedia = !!content.media_url;
  const isEnhanced = !!content.enhanced_media_url;

  const handleNextAction = () => {
    if (nextStatus[content.status]) {
      onStatusChange(content.id, nextStatus[content.status]!);
    }
  };

  return (
    <Card className="group relative overflow-hidden card-shadow hover:card-shadow-hover transition-all duration-300 bg-card border-border/50">
      {/* Media Preview */}
      <div className="relative aspect-video bg-secondary overflow-hidden">
        {displayMedia ? (
          <>
            <img
              src={displayMedia}
              alt={content.title}
              className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
            />
            {isEnhanced && (
              <div className="absolute bottom-2 left-2 bg-accent/90 text-accent-foreground px-2 py-0.5 rounded text-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI Enhanced
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Status overlay */}
        <div className="absolute top-3 left-3">
          <StatusBadge status={content.status} />
        </div>

        {/* Actions menu */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="h-8 w-8 bg-card/80 backdrop-blur-sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onEdit(content)}>
                Edit Content
              </DropdownMenuItem>
              {hasMedia && !isEnhanced && onEnhance && (
                <DropdownMenuItem onClick={() => onEnhance(content.id, content.media_url!)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Enhance with AI
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(content.id)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold text-foreground line-clamp-1 mb-1">
          {content.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {content.description}
        </p>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {content.scheduled_date ? (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {format(new Date(content.scheduled_date), 'MMM d')}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {format(new Date(content.created_at), 'MMM d')}
            </span>
          )}
        </div>

        {nextStatus[content.status] && (
          <Button
            size="sm"
            variant="default"
            className="text-xs h-7 glow"
            onClick={handleNextAction}
          >
            {actionLabels[content.status]}
          </Button>
        )}
        {content.status === 'pending' && (
          <span className="text-xs text-muted-foreground">Awaiting admin review</span>
        )}
      </CardFooter>
    </Card>
  );
}
