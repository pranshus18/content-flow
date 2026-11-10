import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminRouteLayout from "./layouts/AdminRouteLayout";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { UserRoleProvider } from "@/hooks/useUserRole";
import { BrandingSettingsProvider } from "@/hooks/useBrandingSettings";
import { PublishingSettingsProvider } from "@/hooks/usePublishingSettings";
import { ContentProvider } from "@/hooks/useContent";
import Index from "./pages/Index";
import HistoryPage from "./pages/HistoryPage";
import AdminDashboard from "./pages/AdminDashboard";
import UsersPage from "./pages/UsersPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";
import AssetsPage from "./pages/AssetsPage";
import VideoEditorPage from "./pages/VideoEditorPage";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <UserRoleProvider>
        <BrandingSettingsProvider>
          <PublishingSettingsProvider>
            <ContentProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
        <Routes>
          <Route
            path="/auth"
            element={
              <PublicRoute>
                <AuthPage />
              </PublicRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <HistoryPage />
              </ProtectedRoute>
            }
          />
          <Route element={<AdminRouteLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/video-editor" element={<VideoEditorPage />} />
          </Route>
          <Route
            path="/calendar"
            element={<Navigate to="/admin" replace />}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </ContentProvider>
          </PublishingSettingsProvider>
        </BrandingSettingsProvider>
      </UserRoleProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
