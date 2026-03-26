import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Users, Search, Mail, User as UserIcon, Shield, ChevronDown, ChevronUp, Image as ImageIcon, Video, Clock, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ContentViewDialog } from '@/components/ContentViewDialog';

interface UserWithContent {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  content_count: number;
}

interface UserContentItem {
  id: string;
  title: string;
  description: string | null;
  admin_description: string | null;
  admin_notes: string | null;
  status: string;
  platform: string;
  media_url: string | null;
  media_type: string | null;
  enhanced_media_url: string | null;
  original_media_url: string | null;
  scheduled_date: string | null;
  published_at: string | null;
  preprocessing_status: string | null;
  social_post_id: string | null;
  likes_count: number | null;
  comments_count: number | null;
  shares_count: number | null;
  reach_count: number | null;
  created_at: string;
  updated_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithContent[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [userContent, setUserContent] = useState<Record<string, UserContentItem[]>>({});
  const [loadingContent, setLoadingContent] = useState<Set<string>>(new Set());
  const [selectedContent, setSelectedContent] = useState<{ content: UserContentItem; userEmail: string; userFirstName: string; userLastName: string } | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_users_with_content');

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }

      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(user => {
      const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
      const email = user.email?.toLowerCase() || '';
      return fullName.includes(query) || email.includes(query);
    });
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  const fetchUserContent = async (userId: string) => {
    if (userContent[userId]) {
      // Already loaded
      return;
    }

    try {
      setLoadingContent(prev => new Set(prev).add(userId));
      const { data, error } = await supabase
        .from('content')
        .select('id, title, description, admin_description, admin_notes, status, platform, media_url, media_type, enhanced_media_url, original_media_url, scheduled_date, published_at, preprocessing_status, social_post_id, likes_count, comments_count, shares_count, reach_count, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user content:', error);
        throw error;
      }

      setUserContent(prev => ({
        ...prev,
        [userId]: data || []
      }));
    } catch (error: any) {
      console.error('Error fetching user content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load user content',
        variant: 'destructive',
      });
    } finally {
      setLoadingContent(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleContentClick = (content: UserContentItem, userEmail: string, userFirstName: string, userLastName: string) => {
    setSelectedContent({ content, userEmail, userFirstName, userLastName });
    setViewDialogOpen(true);
  };

  const handleToggleUser = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
      fetchUserContent(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'approved':
      case 'scheduled':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'published':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'draft':
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
      default:
        return 'bg-secondary text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending Review';
      case 'approved':
        return 'Approved';
      case 'scheduled':
        return 'Scheduled';
      case 'published':
        return 'Published';
      case 'draft':
        return 'Draft';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading users...</div>
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
                User Management
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              View • Filter • Manage
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                  Content Submitters
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
                  </Badge>
                </h1>
                <p className="text-muted-foreground mt-1">View users who have submitted content for posting</p>
              </div>
            </div>
            <Button variant="outline" onClick={fetchUsers}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Empty State */}
          {users.length === 0 && !loading && (
            <Alert className="mb-6 border-primary/20 bg-primary/5">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary">No Users Found</AlertTitle>
              <AlertDescription>
                No users have submitted content yet. Users will appear here once they submit content for posting.
              </AlertDescription>
            </Alert>
          )}

          {/* Users List */}
          {filteredUsers.length === 0 && users.length > 0 && (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Results</AlertTitle>
              <AlertDescription>
                No users match your search query "{searchQuery}".
              </AlertDescription>
            </Alert>
          )}

          {filteredUsers.length > 0 && (
            <div className="space-y-4">
              {filteredUsers.map((user) => {
                const isExpanded = expandedUsers.has(user.user_id);
                const contents = userContent[user.user_id] || [];
                const isLoading = loadingContent.has(user.user_id);

                return (
                  <Collapsible
                    key={user.user_id}
                    open={isExpanded}
                    onOpenChange={() => handleToggleUser(user.user_id)}
                  >
                    <Card className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-start justify-between cursor-pointer">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <UserIcon className="w-5 h-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <CardTitle className="text-lg">
                                  {user.first_name || user.last_name
                                    ? `${user.first_name} ${user.last_name}`.trim()
                                    : 'Unknown User'}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {user.email || 'No email'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {user.content_count} {user.content_count === 1 ? 'post' : 'posts'}
                              </Badge>
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                      </CardHeader>
                      
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <div className="border-t border-border pt-4">
                            {isLoading ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                                Loading content...
                              </div>
                            ) : contents.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No content submitted yet</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <h4 className="font-semibold text-sm text-foreground mb-3">
                                  Submitted Content ({contents.length})
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {contents.map((content) => {
                                    const isVideo = content.media_type === 'video' || 
                                                   content.media_url?.includes('.mp4') || 
                                                   content.media_url?.includes('.mov') || 
                                                   content.media_url?.includes('.webm');
                                    
                                    return (
                                      <div
                                        key={content.id}
                                        className="p-3 bg-secondary/50 rounded-lg border border-border hover:border-primary/30 transition-colors cursor-pointer"
                                        onClick={() => handleContentClick(content, user.email, user.first_name, user.last_name)}
                                      >
                                        <div className="flex items-start gap-3">
                                          <div className="flex-shrink-0">
                                            {content.media_url ? (
                                              isVideo ? (
                                                <Video className="w-8 h-8 text-blue-500" />
                                              ) : (
                                                <ImageIcon className="w-8 h-8 text-purple-500" />
                                              )
                                            ) : (
                                              <FileText className="w-8 h-8 text-muted-foreground" />
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <h5 className="font-medium text-sm text-foreground line-clamp-1 mb-1">
                                              {content.title}
                                            </h5>
                                            {content.description && (
                                              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                                {content.description}
                                              </p>
                                            )}
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <Badge
                                                variant="outline"
                                                className={`text-xs ${getStatusColor(content.status)}`}
                                              >
                                                {getStatusLabel(content.status)}
                                              </Badge>
                                              <Badge variant="outline" className="text-xs">
                                                {content.platform}
                                              </Badge>
                                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Clock className="w-3 h-3" />
                                                {format(new Date(content.created_at), 'MMM d, yyyy')}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Content View Dialog */}
      <ContentViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        content={selectedContent?.content || null}
        userEmail={selectedContent?.userEmail}
        userFirstName={selectedContent?.userFirstName}
        userLastName={selectedContent?.userLastName}
      />
    </div>
  );
}

