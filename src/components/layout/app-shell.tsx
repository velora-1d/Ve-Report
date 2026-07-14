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
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { authClient } from "@/lib/auth-client";
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
  { to: "/tugas", label: "Log Book Meeting", icon: FileText },
  { to: "/pelacak", label: "Log Book Harian", icon: Timer },
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
    await authClient.signOut();
    toast.success("Berhasil keluar");
    navigate({ to: "/auth", replace: true });
  };

  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className={isCollapsed ? "p-2 flex justify-center items-center h-16" : "p-4"}>
        <Link to="/dasbor" className="flex items-center justify-center shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shadow-soft-sm shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          {!isCollapsed && (
            <div className="ml-2.5">
              <div className="font-semibold tracking-tight">Log Book</div>
              <div className="text-xs text-muted-foreground">Manajemen Tim</div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className={isCollapsed ? "px-1" : "px-2"}>
        <SidebarGroup>
          {!isCollapsed && <SidebarGroupLabel>Utama</SidebarGroupLabel>}
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
            {!isCollapsed && <SidebarGroupLabel>Administrasi</SidebarGroupLabel>}
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
          {!isCollapsed && <SidebarGroupLabel>Pengaturan</SidebarGroupLabel>}
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

      <SidebarFooter className={isCollapsed ? "p-2 flex flex-col items-center gap-2" : "p-3"}>
        {!isCollapsed ? (
          <div className="flex items-center gap-3 p-2 rounded-xl surface-panel overflow-hidden w-full">
            <div className="w-[27px] h-[36px] border border-primary/20 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden relative">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary text-[10px] font-bold">{initials}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">
                {user?.name ?? "…"}
              </div>
              <div className="flex flex-wrap items-center gap-1">
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
        ) : (
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="w-[27px] h-[36px] border border-primary/20 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden relative" title={user?.name}>
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary text-[10px] font-bold">{initials}</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              title="Keluar"
              className="w-8 h-8 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

// ponytail: Modifikasi NavLink sidebar agar lebih estetik sesuai dengan design token (terracotta left bar & primary tint background)
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  return (
    <SidebarMenuItem className="relative">
      {active && (
        <div className={`absolute bg-primary rounded-full transition-all duration-200 ${
          isCollapsed ? "left-1.5 w-1 top-2 bottom-2" : "left-0 w-[3px] top-1.5 bottom-1.5 rounded-r"
        }`} />
      )}
      <SidebarMenuButton
        asChild
        isActive={active}
        className={`rounded-lg transition-all duration-200 ${
          isCollapsed ? "justify-center px-0 mx-auto" : "pl-3.5"
        } ${
          active
            ? "bg-primary/8 text-primary hover:bg-primary/12 hover:text-primary font-medium"
            : "text-foreground/80 hover:bg-muted hover:text-foreground"
        }`}
      >
        <Link to={item.to} className={isCollapsed ? "flex items-center justify-center w-full h-full" : "flex items-center gap-2.5 w-full"}>
          <Icon
            className={`w-4 h-4 transition-colors duration-200 shrink-0 ${
              active ? "text-primary" : "text-foreground/60"
            }`}
          />
          {!isCollapsed && <span>{item.label}</span>}
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
      <SidebarTrigger>
        <Menu className="w-4 h-4" />
      </SidebarTrigger>
      <h1 className="text-base font-semibold tracking-tight">{title}</h1>
    </header>
  );
}

function titleFromPath(path: string): string {
  const map: Record<string, string> = {
    "/dasbor": "Dasbor",
    "/tugas": "Log Book Meeting",
    "/pelacak": "Log Book Harian",
    "/laporan": "Laporan",
    "/manajemen-pengguna": "Manajemen Pengguna",
    "/pengaturan": "Pengaturan",
    "/panel-developer": "Panel Developer",
  };
  const key = Object.keys(map).find(
    (k) => path === k || path.startsWith(k + "/"),
  );
  return key ? map[key] : "Log Book";
}
