import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Calendar,
  Users,
  UserPlus,
  Phone,
  BarChart3,
  CreditCard,
  Settings,
  LogOut,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/leads', label: 'Leads', icon: UserPlus },
  { to: '/calls', label: 'Call Logs', icon: Phone },
  { to: '/analytics', label: 'AI Analytics', icon: BarChart3 },
  { to: '/billing', label: 'Billing', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function ClientLayout() {
  const { user, business, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen w-full bg-transparent">
      <aside className="hidden w-[280px] flex-col border-r border-white/40 bg-white/40 backdrop-blur-3xl lg:flex z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
        <div className="flex h-20 items-center gap-3 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-black tracking-tight text-foreground">{business?.name || 'Loading...'}</p>
            <p className="text-[11px] font-bold text-primary uppercase tracking-widest opacity-80">AI Dashboard</p>
          </div>
        </div>
        
        <Separator className="bg-white/40" />
        
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5 custom-scrollbar">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-300',
                  isActive
                    ? 'bg-white shadow-sm text-primary ring-1 ring-white/50 transform scale-[1.02]'
                    : 'text-muted-foreground hover:bg-white/50 hover:text-foreground hover:scale-[1.01]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-110", isActive ? "text-primary" : "opacity-70 group-hover:opacity-100")} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="border-t border-white/40 bg-white/30 p-5 backdrop-blur-md">
          {business?.status === 'trial' && (
            <Badge variant="outline" className="mb-4 w-full justify-center py-2 border-primary/20 text-primary bg-primary/5 shadow-sm font-bold text-xs">
              Trial Active
            </Badge>
          )}
          
          <div className="flex flex-col gap-1 mb-4 px-2">
            <p className="truncate text-sm font-bold text-foreground">Account</p>
            <p className="truncate text-xs font-medium text-muted-foreground">{user?.email}</p>
          </div>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-2.5 bg-white/50 hover:bg-white hover:text-destructive hover:shadow-sm transition-all duration-300 rounded-xl font-bold py-5" 
            onClick={async () => { await signOut(); navigate('/login'); }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      
      <div className="flex flex-1 flex-col relative w-full overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 w-full max-w-7xl mx-auto custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
