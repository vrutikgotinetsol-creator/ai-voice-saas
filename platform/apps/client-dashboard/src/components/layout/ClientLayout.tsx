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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/leads', label: 'Leads', icon: UserPlus },
  { to: '/calls', label: 'Calls', icon: Phone },
  { to: '/analytics', label: 'AI Analytics', icon: BarChart3 },
  { to: '/billing', label: 'Billing', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function ClientLayout() {
  const { user, business, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 flex-col border-r border-border/50 bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Phone className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{business?.name}</p>
            <p className="text-xs text-muted-foreground">Business Dashboard</p>
          </div>
        </div>
        <Separator />
        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border/50 p-4">
          {business?.status === 'trial' && (
            <Badge variant="secondary" className="mb-2 w-full justify-center">
              Trial
            </Badge>
          )}
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start gap-2" onClick={async () => { await signOut(); navigate('/login'); }}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
