import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { AdminContentCard } from '@/components/AdminContentCard';
import { AdminEditDialog } from '@/components/AdminEditDialog';
import { ScheduleDialog } from '@/components/ScheduleDialog';
import { useContent, ContentItem } from '@/hooks/useContent';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Users, FileCheck, TrendingUp, Shield, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

export default function AdminDashboard() {
  const { contents, loading, updateAdminFields, updateStatus, updateContent, deleteContent, publishToSocial, fetchAnalytics, refetch, preprocessMedia } = useContent();
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null);
  const [schedulingContent, setSchedulingContent] = useState<ContentItem | null>(null);
  const [refreshingAnalytics, setRefreshingAnalytics] = useState<string | null | 'all'>(null);
  const [reprocessingContent, setReprocessingContent] = useState<string | null>(null);
  const { toast } = useToast();

  // Filter content by status
  // Include all content that needs admin review (pending status or being processed)
  const pendingContent = contents.filter(c => {
    // Show content that is pending review
    if (c.status === 'pending') return true;
    // Show content that's being processed (has media but still processing)
    if (c.status === 'draft' && c.preprocessing_status === 'pending' && c.media_url) return true;
    // Show content that finished processing but might still be in draft
    if (c.status === 'draft' && c.preprocessing_status === 'completed' && c.media_url) return true;
    return false;
  });
  const approvedContent = contents.filter(c => c.status === 'approved' || c.status === 'scheduled');
  const publishedContent = contents.filter(c => c.status === 'published');
  const draftContent = contents.filter(c => c.status === 'draft' && !c.media_url);
  
  // Debug logging (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔐 Admin Dashboard Debug:', {
        totalContent: contents.length,
        pending: pendingContent.length,
        approved: approvedContent.length,
        published: publishedContent.length,
        drafts: draftContent.length,
      });
    }
  }, [contents.length, pendingContent.length, approvedContent.length, publishedContent.length, draftContent.length]);

  const handleRefreshAnalytics = async (contentId: string) => {
    setRefreshingAnalytics(contentId);
    try {
      const result = await fetchAnalytics(contentId, false); // silent = false (show errors)
      if (result) {
        setAnalyticsAvailable(true); // Mark as available if successful
      }
      await refetch(); // Refresh the content list to get updated analytics
    } catch (error) {
      console.error('Error refreshing analytics:', error);
      // Error is already handled by fetchAnalytics with toast
    } finally {
      setRefreshingAnalytics(null);
    }
  };

  // Auto-fetch analytics for published content that doesn't have analytics yet
  // Only runs once when the page loads and content is ready
  // SILENT MODE: Won't show error toasts if function isn't available
  const [hasAutoFetched, setHasAutoFetched] = useState(false);
  const [analyticsAvailable, setAnalyticsAvailable] = useState<boolean | null>(null);
  
  useEffect(() => {
    if (loading || hasAutoFetched) return;
    
    const publishedWithoutAnalytics = publishedContent.filter(c => {
      // Fetch if no analytics data exists (all zeros or null)
      const hasNoAnalytics = (
        (!c.likes_count || c.likes_count === 0) &&
        (!c.comments_count || c.comments_count === 0) &&
        (!c.shares_count || c.shares_count === 0) &&
        (!c.reach_count || c.reach_count === 0)
      );
      // Only fetch if it has a social_post_id (meaning it's actually published)
      return hasNoAnalytics && c.social_post_id;
    });

    // Auto-fetch analytics for published content without data (limit to 3 at a time to avoid rate limits)
    if (publishedWithoutAnalytics.length > 0) {
      setHasAutoFetched(true); // Mark as fetched to prevent multiple runs
      const toFetch = publishedWithoutAnalytics.slice(0, 3);
      console.log(`🔄 Auto-fetching analytics for ${toFetch.length} published posts...`);
      
      // Fetch with a small delay to avoid overwhelming the API
      // Use silent mode to avoid showing errors for auto-fetch
      const fetchWithDelay = async () => {
        let successCount = 0;
        for (const content of toFetch) {
          try {
            const result = await fetchAnalytics(content.id, true); // silent = true
            if (result) {
              successCount++;
            }
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 1500));
          } catch (error) {
            console.error(`Error auto-fetching analytics for ${content.id}:`, error);
            // Continue with next item even if one fails
          }
        }
        
        // If at least one succeeded, analytics is available
        if (successCount > 0) {
          setAnalyticsAvailable(true);
        } else if (toFetch.length > 0) {
          // If all failed, mark as unavailable (function might not be deployed)
          setAnalyticsAvailable(false);
        }
        
        // Refetch content list after all analytics are fetched
        setTimeout(() => refetch(), 2000);
      };
      
      fetchWithDelay();
    } else if (publishedContent.length > 0) {
      // Mark as fetched even if there's nothing to fetch
      setHasAutoFetched(true);
    }
  }, [loading, publishedContent.length, fetchAnalytics, refetch, hasAutoFetched]);

  const handlePublish = async (content: ContentItem) => {
    await publishToSocial(content.id);
  };

  const handleReprocess = async (content: ContentItem) => {
    if (!content.media_url) return;
    
    setReprocessingContent(content.id);
    try {
      // Use original media URL if available, otherwise use current media URL
      const mediaUrlToProcess = content.original_media_url || content.media_url;
      const mediaType = content.media_type || 'image';
      const platform = content.platform || 'instagram';
      
      await preprocessMedia(content.id, mediaUrlToProcess, mediaType, platform);
    } catch (error) {
      console.error('Error re-processing media:', error);
    } finally {
      setReprocessingContent(null);
    }
  };

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
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to schedule post',
        variant: 'destructive',
      });
    }
  };

  const handleEditSave = async (
    adminDescription: string, 
    adminNotes: string, 
    platform: string,
    watermarkLogoUrl?: string,
    watermarkWebsiteUrl?: string,
    watermarkPosition?: string,
    textOverlays?: any[]
  ) => {
    if (editingContent) {
      const platformChanged = editingContent.platform !== platform;
      
      await updateAdminFields(
        editingContent.id, 
        adminDescription, 
        adminNotes,
        watermarkLogoUrl,
        watermarkWebsiteUrl,
        watermarkPosition,
        textOverlays
      );
      // Update platform separately
      await updateContent(editingContent.id, { platform });
      
      // If platform changed and there's media, re-process for new platform
      if (platformChanged && editingContent.media_url && editingContent.media_type === 'image') {
        // Re-process image for new platform with platform-specific dimensions
        await preprocessMedia(editingContent.id, editingContent.media_url, 'image', platform);
      }
      
      setEditingContent(null);
    }
  };

  // Show loading state - AdminRoute already handles all redirects and role checks
  // We don't need to check role here again as it causes redirect loops
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onCreateClick={() => {}} isAdmin />
      
      <main className="pl-64">
        {/* Admin Banner */}
        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-b border-primary/20 px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-primary">ADMIN PORTAL</span>
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-xs">
                Content Management System
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Review • Edit • Publish
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                  Admin Dashboard
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    Admin
                  </Badge>
                </h1>
                <p className="text-muted-foreground mt-1">Review, edit, and publish user-submitted content</p>
              </div>
            </div>
            <Button variant="outline" onClick={refetch}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Admin Notice */}
          {contents.length === 0 && !loading && (
            <Alert className="mb-6 border-primary/20 bg-primary/5">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary">Admin Portal Active</AlertTitle>
              <AlertDescription>
                You're viewing the admin dashboard. Content uploaded by users will appear here for review and publishing.
              </AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingContent.length}</p>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <FileCheck className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{approvedContent.length}</p>
                  <p className="text-sm text-muted-foreground">Ready to Publish</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{publishedContent.length}</p>
                  <p className="text-sm text-muted-foreground">Published</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{contents.length}</p>
                  <p className="text-sm text-muted-foreground">Total Content</p>
                </div>
              </div>
            </div>
          </div>

          {/* Content Tabs */}
          <Tabs defaultValue="pending" className="space-y-6">
            <TabsList className="bg-secondary">
              <TabsTrigger value="pending" className="flex gap-2">
                Pending Review
                {pendingContent.length > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                    {pendingContent.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="published">Published</TabsTrigger>
              <TabsTrigger value="drafts">Drafts</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {pendingContent.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-2">No content pending review</p>
                  <p className="text-sm text-muted-foreground">
                    Content uploaded by users will appear here automatically
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={refetch} 
                    className="mt-4"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {pendingContent.map(content => (
                    <AdminContentCard
                      key={content.id}
                      content={content}
                      onApprove={() => updateStatus(content.id, 'approved')}
                      onReject={() => updateStatus(content.id, 'draft')}
                      onEdit={() => setEditingContent(content)}
                      onDelete={() => deleteContent(content.id)}
                      onSchedule={() => setSchedulingContent(content)}
                      onReprocess={() => handleReprocess(content)}
                      isReprocessing={reprocessingContent === content.id}
                      showScheduleButton
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="approved" className="space-y-4">
              {approvedContent.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No approved content ready to publish
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {approvedContent.map(content => (
                    <AdminContentCard
                      key={content.id}
                      content={content}
                      onEdit={() => setEditingContent(content)}
                      onDelete={() => deleteContent(content.id)}
                      onSchedule={() => setSchedulingContent(content)}
                      onPublish={() => handlePublish(content)}
                      onReprocess={() => handleReprocess(content)}
                      isReprocessing={reprocessingContent === content.id}
                      showPublishButton
                      showScheduleButton
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="published" className="space-y-4">
              {publishedContent.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No published content yet
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-muted-foreground">
                      {publishedContent.length} published post{publishedContent.length !== 1 ? 's' : ''}
                    </p>
                    {analyticsAvailable !== false && (
                      <Button
                        onClick={async () => {
                          const publishedWithPostId = publishedContent.filter(c => c.social_post_id);
                          if (publishedWithPostId.length === 0) {
                            toast({
                              title: "No published posts",
                              description: "There are no published posts with social media IDs to refresh.",
                              variant: 'default',
                            });
                            return;
                          }
                          
                          setRefreshingAnalytics('all');
                          try {
                            let successCount = 0;
                            const promises = publishedWithPostId.map(content => 
                              fetchAnalytics(content.id, false).then(result => {
                                if (result) successCount++;
                                return result;
                              }).catch(err => {
                                console.error(`Failed to refresh analytics for ${content.id}:`, err);
                                return null;
                              })
                            );
                            await Promise.all(promises);
                            await refetch();
                            if (successCount > 0) {
                              setAnalyticsAvailable(true);
                              toast({
                                title: "Analytics refreshed",
                                description: `Refreshed analytics for ${successCount} of ${publishedWithPostId.length} published post(s).`,
                              });
                            } else {
                              // If all failed, analytics might not be available
                              setAnalyticsAvailable(false);
                            }
                          } catch (error) {
                            console.error('Error refreshing all analytics:', error);
                            setAnalyticsAvailable(false);
                          } finally {
                            setRefreshingAnalytics(null);
                          }
                        }}
                        variant="outline"
                        disabled={refreshingAnalytics === 'all' || !!refreshingAnalytics}
                        size="sm"
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshingAnalytics === 'all' ? 'animate-spin' : ''}`} />
                        Refresh All Analytics
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {publishedContent.map(content => (
                      <AdminContentCard
                        key={content.id}
                        content={content}
                        onEdit={() => setEditingContent(content)}
                        onDelete={() => deleteContent(content.id)}
                        onRefreshAnalytics={analyticsAvailable !== false ? () => handleRefreshAnalytics(content.id) : undefined}
                        onReprocess={() => handleReprocess(content)}
                        isRefreshing={refreshingAnalytics === content.id || refreshingAnalytics === 'all'}
                        isReprocessing={reprocessingContent === content.id}
                        showAnalytics={analyticsAvailable !== false}
                      />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="drafts" className="space-y-4">
              {draftContent.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No drafts
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {draftContent.map(content => (
                    <AdminContentCard
                      key={content.id}
                      content={content}
                      onEdit={() => setEditingContent(content)}
                      onDelete={() => deleteContent(content.id)}
                      onReprocess={() => handleReprocess(content)}
                      isReprocessing={reprocessingContent === content.id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <AdminEditDialog
        open={!!editingContent}
        onOpenChange={(open) => !open && setEditingContent(null)}
        content={editingContent}
        onSave={handleEditSave}
        onReprocess={async (contentId, mediaUrl, mediaType, platform) => {
          await preprocessMedia(contentId, mediaUrl, mediaType as 'image' | 'video', platform);
        }}
      />

      <ScheduleDialog
        open={!!schedulingContent}
        onOpenChange={(open) => !open && setSchedulingContent(null)}
        content={schedulingContent}
        onSchedule={handleSchedule}
      />
    </div>
  );
}
