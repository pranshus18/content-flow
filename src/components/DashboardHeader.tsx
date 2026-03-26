import { Search, Bell, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DashboardHeaderProps {
  contentCount: number;
}

export function DashboardHeader({ contentCount }: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Content Pipeline</h1>
        <p className="text-muted-foreground text-sm">
          Manage your content from creation to publication
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search content..."
            className="pl-10 w-64 bg-secondary border-border"
          />
        </div>
        
        <Button variant="outline" size="icon" className="border-border">
          <Filter className="w-4 h-4" />
        </Button>
        
        <Button variant="outline" size="icon" className="border-border relative">
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-[10px] font-medium flex items-center justify-center text-primary-foreground">
            3
          </span>
        </Button>
      </div>
    </header>
  );
}
