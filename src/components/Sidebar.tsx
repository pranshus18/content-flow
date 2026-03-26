import { 
  LayoutDashboard, 
  Plus, 
  Calendar, 
  BarChart3, 
  Settings,
  Zap,
  Shield,
  LogOut,
  History,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NavLink } from '@/components/NavLink';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';

interface SidebarProps {
  onCreateClick: () => void;
  isAdmin?: boolean;
}

const userNavItems = [
  { icon: LayoutDashboard, label: 'My Content', path: '/' },
  { icon: History, label: 'History', path: '/history' },
];

const adminNavItems = [
  { icon: Shield, label: 'Admin Dashboard', path: '/admin' },
  { icon: Users, label: 'Users', path: '/users' },
  { icon: Calendar, label: 'Calendar', path: '/calendar' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function Sidebar({ onCreateClick, isAdmin: isAdminProp }: SidebarProps) {
  const { isAdmin: isAdminRole } = useUserRole();
  const { signOut } = useAuth();
  // If isAdmin prop is explicitly passed, use it. Otherwise check role from hook
  const showAdminNav = isAdminProp !== undefined ? isAdminProp : isAdminRole;
  const navItems = showAdminNav ? adminNavItems : userNavItems;
  
  // Debug logging (development only)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Sidebar Debug:', {
      isAdminProp,
      isAdminRole,
      showAdminNav,
      navItemsCount: navItems.length,
      navItems: navItems.map(n => n.label)
    });
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-10">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow">
          <Zap className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <span className="font-bold text-lg text-foreground">ContentFlow</span>
          {showAdminNav && (
            <p className="text-xs text-primary">Admin</p>
          )}
        </div>
      </div>

      {/* Create Button */}
      {!showAdminNav && (
        <div className="px-4 mb-6">
          <Button 
            onClick={onCreateClick}
            className="w-full glow"
            size="lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Content
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.label}>
              <NavLink
                to={item.path}
                end={item.path === '/' || item.path === '/admin'}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        
        {/* Debug indicator (development only) */}
        {process.env.NODE_ENV === 'development' && showAdminNav && (
          <div className="mt-4 p-2 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-500">
            ✓ Admin Mode Active ({navItems.length} items)
          </div>
        )}
      </nav>

      {/* Sign Out Button */}
      <div className="p-4">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
