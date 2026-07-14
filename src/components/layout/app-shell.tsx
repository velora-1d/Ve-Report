import { useMemo, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ListChecks,
  Timer,
  FileText,
  Users,
  Settings,
  Terminal,
  LogOut,
  Menu,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ROLE_LABEL, isAdminOrDev, isDeveloper } from "@/lib/roles";
import { toast } from "sonner";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAdmin?: boolean;
  requiresDev?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { to: "/dasbor", label: "Dasbor", icon: LayoutDashboard },
  { to: "/tugas", label: "Tugas & Jadwal", icon: ListChecks },
  { to: "/pelacak", label: "Pelacak", icon: Timer },
  { to: "/laporan", label: "Laporan", icon: FileText },
];

const ADMIN_NAV: NavItem[] = [
  {
    to: "/manajemen-pengguna",
    label: "Manajemen Pengguna",
    icon: Users,
    requiresAdmin: true,
  },
];

const SETTINGS_NAV: NavItem[] = [
  { to: "/pengaturan", label: "Pengaturan", icon: Settings },
];

const DEV_NAV: NavItem[] = [
  {
    to: "/panel-developer",
    label: "Panel Developer",
    icon: Terminal,
    requiresDev: true,
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-surface-sunken">
        <TopBar />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AppSidebar() {
  const { data: user } = useCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const roles = user?.roles ?? [];
  const canAdmin = isAdminOrDev(roles);
  const canDev = isDeveloper(roles);

  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(to + "/");

  const initials = useMemo(() => {
    const n = user?.name ?? "";
    return (
      n
        .split(" ")
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? "")
        .join("") || "?"
    );
  }, [user?.name]);

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Berhasil keluar");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link to="/dasbor" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shadow-soft-sm">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">VeReport</div>
            <div className="text-xs text-muted-foreground">Manajemen Tim</div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel>Utama</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN_NAV.map((item) => (
                <NavLink key={item.to} item={item} active={isActive(item.to)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {canAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administrasi</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ADMIN_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    item={item}
                    active={isActive(item.to)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Pengaturan</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SETTINGS_NAV.map((item) => (
                <NavLink key={item.to} item={item} active={isActive(item.to)} />
              ))}
              {canDev &&
                DEV_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    item={item}
                    active={isActive(item.to)}
                  />
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="flex items-center gap-3 p-2 rounded-xl surface-panel">
          <Avatar className="w-9 h-9">
            {user?.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt={user.name} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">
              {user?.name ?? "…"}
            </div>
            <div className="flex items-center gap-1.5">
              {roles.map((r) => (
                <Badge
                  key={r}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4"
                >
                  {ROLE_LABEL[r]}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            title="Keluar"
            className="shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} className="rounded-lg">
        <Link to={item.to}>
          <Icon className="w-4 h-4" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function TopBar() {
  const location = useLocation();
  const title = useMemo(
    () => titleFromPath(location.pathname),
    [location.pathname],
  );
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 backdrop-blur px-4 md:px-6 sticky top-0 z-10">
      <SidebarTrigger className="md:hidden">
        <Menu className="w-4 h-4" />
      </SidebarTrigger>
      <h1 className="text-base font-semibold tracking-tight">{title}</h1>
    </header>
  );
}

function titleFromPath(path: string): string {
  const map: Record<string, string> = {
    "/dasbor": "Dasbor",
    "/tugas": "Tugas & Jadwal",
    "/pelacak": "Pelacak",
    "/laporan": "Laporan",
    "/manajemen-pengguna": "Manajemen Pengguna",
    "/pengaturan": "Pengaturan",
    "/panel-developer": "Panel Developer",
  };
  const key = Object.keys(map).find(
    (k) => path === k || path.startsWith(k + "/"),
  );
  return key ? map[key] : "VeReport";
}
