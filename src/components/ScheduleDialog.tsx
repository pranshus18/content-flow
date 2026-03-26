import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ContentItem } from '@/hooks/useContent';

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: ContentItem | null;
  onSchedule: (contentId: string, scheduledDate: string) => void;
  initialDate?: Date; // For pre-selecting date from calendar
}

export function ScheduleDialog({ open, onOpenChange, content, onSchedule, initialDate }: ScheduleDialogProps) {
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState<string>('09:00');

  useEffect(() => {
    if (content?.scheduled_date) {
      const date = new Date(content.scheduled_date);
      setScheduledDate(date);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      setScheduledTime(`${hours}:${minutes}`);
    } else if (initialDate) {
      // Use initial date from calendar if provided
      setScheduledDate(initialDate);
      setScheduledTime('09:00');
    } else {
      // Default to tomorrow at 9 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      setScheduledDate(tomorrow);
      setScheduledTime('09:00');
    }
  }, [content, open, initialDate]);

  const handleSchedule = () => {
    if (!content || !scheduledDate) return;

    const [hours, minutes] = scheduledTime.split(':');
    const scheduledDateTime = new Date(scheduledDate);
    scheduledDateTime.setHours(parseInt(hours, 10));
    scheduledDateTime.setMinutes(parseInt(minutes, 10));
    scheduledDateTime.setSeconds(0);
    scheduledDateTime.setMilliseconds(0);

    // Validate that scheduled time is in the future
    if (scheduledDateTime <= new Date()) {
      alert('Please select a date and time in the future.');
      return;
    }

    onSchedule(content.id, scheduledDateTime.toISOString());
    onOpenChange(false);
  };

  if (!content) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Schedule Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Content Preview */}
          <div className="p-4 bg-secondary/50 rounded-lg border border-border">
            <h3 className="font-semibold text-sm mb-2">{content.title}</h3>
            {content.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{content.description}</p>
            )}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Platform:</span>
              <span className="font-medium">{content.platform}</span>
            </div>
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Select Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-secondary border-border",
                    !scheduledDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={setScheduledDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Picker */}
          <div className="space-y-2">
            <Label>Select Time</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="pl-10 bg-secondary border-border"
                disabled={!scheduledDate}
              />
            </div>
          </div>

          {/* Preview */}
          {scheduledDate && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-sm text-primary font-medium">
                Post will be published on {format(scheduledDate, "PPP")} at {scheduledTime}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={!scheduledDate}
            className="glow"
          >
            Schedule Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

