import { useMemo, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAppConfig } from "@/lib/app-config";
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
    label: "Pengguna",
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

  const { data: config } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => getAppConfig(),
  });
  const appName = config?.appName || "Log Book";
  const logoUrl = config?.logoUrl || null;

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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60 bg-gradient-to-b from-sidebar via-sidebar to-background shadow-soft">
      <SidebarHeader className={isCollapsed ? "p-2 flex justify-center items-center h-16" : "p-5 pb-3"}>
        <Link
          to="/dasbor"
          className={isCollapsed ? "flex items-center justify-center w-full" : "flex items-center gap-3 w-full pl-1.5"}
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.25)] shrink-0 overflow-hidden transition-transform duration-300 hover:rotate-6 relative">
            {logoUrl ? (
              <img src={logoUrl} alt={appName} className="w-full h-full object-cover" />
            ) : (
              <FileText className="w-5 h-5 text-primary-foreground" />
            )}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col justify-center min-w-0">
              <div className="font-bold tracking-tight text-foreground text-base leading-tight truncate max-w-[120px]" title={appName}>
                {appName}
              </div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 leading-none mt-0.5">
                Workspace
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className={isCollapsed ? "px-1.5" : "px-3"}>
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-[10px] font-bold tracking-widest text-muted-foreground/50 uppercase px-3 py-2 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-primary/40" />
              Utama
            </SidebarGroupLabel>
          )}
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
            {!isCollapsed && (
              <SidebarGroupLabel className="text-[10px] font-bold tracking-widest text-muted-foreground/50 uppercase px-3 py-2 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-primary/40" />
                Administrasi
              </SidebarGroupLabel>
            )}
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
          {!isCollapsed && (
            <SidebarGroupLabel className="text-[10px] font-bold tracking-widest text-muted-foreground/50 uppercase px-3 py-2 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-primary/40" />
              Pengaturan
            </SidebarGroupLabel>
          )}
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

      <SidebarFooter className={isCollapsed ? "p-2 flex flex-col items-center gap-3" : "p-4"}>
        {!isCollapsed ? (
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r from-muted/50 via-muted/30 to-transparent border border-border/40 backdrop-blur-sm shadow-soft-sm overflow-hidden w-full transition-all duration-300 hover:border-primary/20">
            <div className="w-[30px] h-[40px] border border-primary/20 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden relative shadow-sm ring-1 ring-primary/5 hover:ring-primary/20 transition-all">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary text-[11px] font-bold">{initials}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground truncate">
                {user?.name ?? "…"}
              </div>
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                {roles.map((r) => (
                  <Badge
                    key={r}
                    variant="secondary"
                    className="text-[9px] px-1.5 py-0 h-4 bg-primary/8 text-primary border-none font-medium hover:bg-primary/8"
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
              className="shrink-0 h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5 w-full">
            <div className="w-[30px] h-[40px] border border-primary/20 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden relative shadow-sm ring-2 ring-primary/5 hover:ring-primary/20 transition-all" title={user?.name}>
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary text-[11px] font-bold">{initials}</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              title="Keluar"
              className="w-8 h-8 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-all hover:scale-105 active:scale-95"
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
        <div className={`absolute bg-gradient-to-b from-primary to-primary-hover rounded-full transition-all duration-200 shadow-[0_0_6px_rgba(37,99,235,0.4)] ${
          isCollapsed ? "left-1.5 w-1 top-2 bottom-2" : "left-0 w-[3px] top-1.5 bottom-1.5 rounded-r"
        }`} />
      )}
      <SidebarMenuButton
        asChild
        isActive={active}
        className={`rounded-lg transition-all duration-200 ${
          isCollapsed
            ? "justify-center px-0 mx-auto"
            : "pl-3.5"
        } ${
          active
            ? isCollapsed
              ? "bg-gradient-to-tr from-primary/15 to-primary/5 text-primary font-bold shadow-[0_2px_8px_-2px_rgba(37,99,235,0.15)] scale-105"
              : "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent text-primary font-bold shadow-[inset_1.5px_0_0_0_rgba(37,99,235,0.3)]"
            : isCollapsed
              ? "text-foreground/75 font-bold hover:bg-primary/8 hover:text-primary hover:scale-105"
              : "text-foreground/75 font-bold hover:bg-primary/5 hover:text-primary hover:translate-x-0.5"
        }`}
      >
        <Link to={item.to} className={isCollapsed ? "flex items-center justify-center w-full h-full" : "flex items-center gap-2.5 w-full"}>
          <Icon
            strokeWidth={2.8}
            className={`w-4 h-4 transition-colors duration-200 shrink-0 ${
              active
                ? "text-primary drop-shadow-[0_0_6px_rgba(37,99,235,0.35)]"
                : "text-black dark:text-white hover:text-primary"
            }`}
          />
          {!isCollapsed && <span className="font-bold">{item.label}</span>}
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
    "/manajemen-pengguna": "Pengguna",
    "/pengaturan": "Pengaturan",
    "/panel-developer": "Panel Developer",
  };
  const key = Object.keys(map).find(
    (k) => path === k || path.startsWith(k + "/"),
  );
  return key ? map[key] : "Log Book";
}
