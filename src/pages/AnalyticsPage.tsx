import { Sidebar } from '@/components/Sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Eye, Share2, FileText, CheckCircle, Shield, Heart, MessageCircle, RefreshCw, Youtube, Instagram, Facebook } from 'lucide-react';
import { useState, useMemo } from 'react';
import { CreateContentDialog } from '@/components/CreateContentDialog';
import { useContent } from '@/hooks/useContent';
import { useUserRole } from '@/hooks/useUserRole';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
};

export default function AnalyticsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const { contents, loading, createContent, fetchAnalytics, refetch } = useContent();
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

  // Calculate engagement metrics from published content
  const engagementMetrics = useMemo(() => {
    const published = contents.filter(c => c.status === 'published');
    
    const totalLikes = published.reduce((sum, c) => sum + (c.likes_count || 0), 0);
    const totalComments = published.reduce((sum, c) => sum + (c.comments_count || 0), 0);
    const totalShares = published.reduce((sum, c) => sum + (c.shares_count || 0), 0);
    const totalReach = published.reduce((sum, c) => sum + (c.reach_count || 0), 0);
    
    return { totalLikes, totalComments, totalShares, totalReach, publishedCount: published.length };
  }, [contents]);

  // Platform-specific metrics
  const platformMetrics = useMemo(() => {
    const platforms = ['instagram', 'facebook', 'youtube'];
    return platforms.map(platform => {
      const platformContent = contents.filter(c => c.platform === platform);
      const published = platformContent.filter(c => c.status === 'published');
      
      return {
        platform,
        total: platformContent.length,
        published: published.length,
        likes: published.reduce((sum, c) => sum + (c.likes_count || 0), 0),
        comments: published.reduce((sum, c) => sum + (c.comments_count || 0), 0),
        shares: published.reduce((sum, c) => sum + (c.shares_count || 0), 0),
        reach: published.reduce((sum, c) => sum + (c.reach_count || 0), 0),
      };
    });
  }, [contents]);

  const publishedCount = contents.filter(c => c.status === 'published').length;
  const scheduledCount = contents.filter(c => c.status === 'scheduled').length;
  const pendingCount = contents.filter(c => c.status === 'pending').length;

  const handleRefreshAll = async () => {
    const published = contents.filter(c => c.status === 'published' && c.social_post_id);
    if (published.length === 0) {
      toast({
        title: "No published content",
        description: "There are no published posts to refresh analytics for.",
        variant: 'default',
      });
      return;
    }

    setRefreshingIds(new Set(published.map(c => c.id)));
    
    try {
      const promises = published.map(content => 
        fetchAnalytics(content.id).catch(err => {
          console.error(`Failed to refresh analytics for ${content.id}:`, err);
          return null;
        })
      );
      
      await Promise.all(promises);
      
      toast({
        title: "Analytics refreshed",
        description: `Refreshed analytics for ${published.length} published post(s).`,
      });
    } catch (error) {
      console.error('Error refreshing analytics:', error);
    } finally {
      setRefreshingIds(new Set());
      refetch();
    }
  };

  const handleRefreshSingle = async (contentId: string) => {
    setRefreshingIds(prev => new Set(prev).add(contentId));
    try {
      await fetchAnalytics(contentId);
      await refetch();
    } catch (error) {
      console.error('Error refreshing analytics:', error);
    } finally {
      setRefreshingIds(prev => {
        const next = new Set(prev);
        next.delete(contentId);
        return next;
      });
    }
  };

  const publishedContent = contents.filter(c => c.status === 'published').sort((a, b) => {
    const dateA = new Date(a.published_at || a.created_at).getTime();
    const dateB = new Date(b.published_at || b.created_at).getTime();
    return dateB - dateA;
  });

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
                Analytics Dashboard
              </Badge>
            </div>
          </div>
        )}
        <div className="p-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
                Analytics
                {isAdmin && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    Admin
                  </Badge>
                )}
              </h1>
              <p className="text-muted-foreground text-sm">
                Track your content performance and engagement metrics
              </p>
            </div>
            {publishedCount > 0 && (
              <Button 
                onClick={handleRefreshAll} 
                variant="outline"
                disabled={refreshingIds.size > 0}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshingIds.size > 0 ? 'animate-spin' : ''}`} />
                Refresh All Analytics
              </Button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <>
              {/* Engagement Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Card className="bg-card border-border card-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <Heart className="w-5 h-5 text-red-500" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{engagementMetrics.totalLikes.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Total Likes/Reactions</p>
                    <p className="text-xs text-muted-foreground mt-1">{engagementMetrics.publishedCount} published posts</p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border card-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <MessageCircle className="w-5 h-5 text-blue-500" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{engagementMetrics.totalComments.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Total Comments</p>
                    <p className="text-xs text-muted-foreground mt-1">{engagementMetrics.publishedCount} published posts</p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border card-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <Share2 className="w-5 h-5 text-green-500" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{engagementMetrics.totalShares.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Total Shares</p>
                    <p className="text-xs text-muted-foreground mt-1">{engagementMetrics.publishedCount} published posts</p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border card-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Eye className="w-5 h-5 text-purple-500" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{engagementMetrics.totalReach.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Total Reach/Views</p>
                    <p className="text-xs text-muted-foreground mt-1">{engagementMetrics.publishedCount} published posts</p>
                  </CardContent>
                </Card>
              </div>

              {/* Platform Breakdown */}
              <Card className="bg-card border-border mb-8">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Platform Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {platformMetrics.map(({ platform, total, published, likes, comments, shares, reach }) => {
                      const PlatformIcon = platformIcons[platform] || FileText;
                      return (
                        <div key={platform} className="p-4 rounded-lg bg-secondary/50 border border-border">
                          <div className="flex items-center gap-2 mb-3">
                            <PlatformIcon className="w-4 h-4" />
                            <p className="text-sm font-semibold text-foreground capitalize">{platform}</p>
                          </div>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total:</span>
                              <span className="font-medium">{total}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Published:</span>
                              <span className="font-medium">{published}</span>
                            </div>
                            {published > 0 && (
                              <>
                                <div className="flex justify-between text-red-400">
                                  <span>Likes:</span>
                                  <span className="font-medium">{likes.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-blue-400">
                                  <span>Comments:</span>
                                  <span className="font-medium">{comments.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-green-400">
                                  <span>Shares:</span>
                                  <span className="font-medium">{shares.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-purple-400">
                                  <span>{platform === 'youtube' ? 'Views:' : 'Reach:'}</span>
                                  <span className="font-medium">{reach.toLocaleString()}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Published Content Analytics */}
              {publishedContent.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Published Content Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {publishedContent.map((content) => {
                        const PlatformIcon = platformIcons[content.platform || ''] || FileText;
                        const isRefreshing = refreshingIds.has(content.id);
                        const hasAnalytics = (content.likes_count || 0) + (content.comments_count || 0) + (content.shares_count || 0) + (content.reach_count || 0) > 0;
                        
                        return (
                          <div key={content.id} className="p-4 rounded-lg bg-secondary/30 border border-border">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <PlatformIcon className="w-4 h-4" />
                                  <h3 className="font-semibold text-foreground">{content.title}</h3>
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {content.platform}
                                  </Badge>
                                </div>
                                {content.social_post_id && (
                                  <p className="text-xs text-muted-foreground mb-2">
                                    Post ID: {content.social_post_id}
                                  </p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRefreshSingle(content.id)}
                                disabled={isRefreshing}
                              >
                                <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                                Refresh
                              </Button>
                            </div>
                            
                            {hasAnalytics ? (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="text-center p-2 bg-card rounded-lg">
                                  <div className="flex items-center justify-center gap-1 text-red-400 mb-1">
                                    <Heart className="w-4 h-4" />
                                    <span className="text-lg font-bold">{content.likes_count || 0}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">Likes</p>
                                </div>
                                <div className="text-center p-2 bg-card rounded-lg">
                                  <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
                                    <MessageCircle className="w-4 h-4" />
                                    <span className="text-lg font-bold">{content.comments_count || 0}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">Comments</p>
                                </div>
                                <div className="text-center p-2 bg-card rounded-lg">
                                  <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
                                    <Share2 className="w-4 h-4" />
                                    <span className="text-lg font-bold">{content.shares_count || 0}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">Shares</p>
                                </div>
                                <div className="text-center p-2 bg-card rounded-lg">
                                  <div className="flex items-center justify-center gap-1 text-purple-400 mb-1">
                                    <Eye className="w-4 h-4" />
                                    <span className="text-lg font-bold">{content.reach_count || 0}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {content.platform === 'youtube' ? 'Views' : 'Reach'}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-4 text-muted-foreground text-sm">
                                {content.social_post_id 
                                  ? "No analytics data yet. Click Refresh to fetch latest metrics."
                                  : "Content not published to social media yet."
                                }
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Content Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{contents.length}</p>
                    <p className="text-sm text-muted-foreground">Total Content</p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{publishedCount}</p>
                    <p className="text-sm text-muted-foreground">Published</p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-purple-500" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{scheduledCount}</p>
                    <p className="text-sm text-muted-foreground">Scheduled</p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>

      <CreateContentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
