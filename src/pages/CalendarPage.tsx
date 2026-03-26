import { Sidebar } from '@/components/Sidebar';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { CreateContentDialog } from '@/components/CreateContentDialog';
import { ScheduleDialog } from '@/components/ScheduleDialog';
import { useContent, ContentItem } from '@/hooks/useContent';
import { useUserRole } from '@/hooks/useUserRole';
import { format, isSameDay } from 'date-fns';
import { StatusBadge } from '@/components/StatusBadge';
import { Shield, Calendar as CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedContentForSchedule, setSelectedContentForSchedule] = useState<ContentItem | null>(null);
  const { contents, loading, createContent, updateContent, refetch } = useContent();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();

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

  const scheduledContent = contents.filter(c => c.scheduled_date);
  const approvedContent = contents.filter(c => c.status === 'approved' || c.status === 'pending');
  const selectedDateContent = date 
    ? scheduledContent.filter(c => isSameDay(new Date(c.scheduled_date!), date))
    : [];

  const handleSchedule = async (contentId: string, scheduledDate: string) => {
    try {
      await updateContent(contentId, {
        scheduled_date: scheduledDate,
        status: 'scheduled',
      });
      
      toast({
        title: 'Post Scheduled',
        description: `Content will be published on ${new Date(scheduledDate).toLocaleDateString()} at ${new Date(scheduledDate).toLocaleTimeString()}`,
      });
      
      refetch();
      setScheduleDialogOpen(false);
      setSelectedContentForSchedule(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to schedule post',
        variant: 'destructive',
      });
    }
  };

  const handleScheduleForDate = (content: ContentItem) => {
    if (!date) return;
    
    setSelectedContentForSchedule(content);
    setScheduleDialogOpen(true);
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
                Content Calendar
              </Badge>
            </div>
          </div>
        )}
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
              Content Calendar
              {isAdmin && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  Admin
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground text-sm">
              View and manage your scheduled content
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Schedule Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  className="rounded-md pointer-events-auto"
                />
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">
                  {date ? format(date, 'MMMM d, yyyy') : 'Select a date'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">Loading...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Scheduled Content for Selected Date */}
                    {selectedDateContent.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 text-foreground">Scheduled Posts</h4>
                        <div className="space-y-2">
                          {selectedDateContent.map(content => (
                            <div key={content.id} className="p-3 rounded-lg bg-secondary/50 border border-border">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm truncate">{content.title}</h4>
                                  <p className="text-xs text-muted-foreground mt-0.5">{content.platform}</p>
                                  {content.scheduled_date && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {format(new Date(content.scheduled_date), 'h:mm a')}
                                    </p>
                                  )}
                                </div>
                                <StatusBadge status={content.status} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Available Content to Schedule */}
                    {isAdmin && approvedContent.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 text-foreground">Schedule Approved Content</h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {approvedContent.slice(0, 5).map(content => (
                            <div key={content.id} className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm truncate">{content.title}</h4>
                                  <p className="text-xs text-muted-foreground mt-0.5">{content.platform}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleScheduleForDate(content)}
                                  className="flex-shrink-0"
                                >
                                  <CalendarIcon className="w-3 h-3 mr-1" />
                                  Schedule
                                </Button>
                              </div>
                            </div>
                          ))}
                          {approvedContent.length > 5 && (
                            <p className="text-xs text-muted-foreground text-center">
                              +{approvedContent.length - 5} more approved posts
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedDateContent.length === 0 && (!isAdmin || approvedContent.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">No content scheduled for this date</p>
                        {isAdmin && approvedContent.length === 0 && (
                          <p className="text-xs mt-1">Approve content first to schedule it</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <CreateContentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        initialScheduledDate={date}
        enableScheduling={true}
      />

      <ScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={(open) => {
          setScheduleDialogOpen(open);
          if (!open) setSelectedContentForSchedule(null);
        }}
        content={selectedContentForSchedule}
        onSchedule={handleSchedule}
        initialDate={date}
      />
    </div>
  );
}
