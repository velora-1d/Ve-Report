import { useMemo, useState, type ReactNode } from "react";
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
  ShieldAlert,
  CheckSquare,
  ClipboardList,
  FileBarChart,
  BadgeCheck,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  { to: "/tugas", label: "Log Book Meeting", icon: ClipboardList },
  { to: "/pelacak", label: "Log Book Harian", icon: Timer },
  { to: "/laporan", label: "Laporan", icon: FileBarChart },
];

const ADMIN_NAV: NavItem[] = [
  {
    to: "/validasi",
    label: "Validasi Log",
    icon: BadgeCheck,
    requiresAdmin: true,
  },
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

  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const handleConfirmSwitch = () => {
    if (!selectedRole) return;
    if (selectedRole === "developer") {
      localStorage.removeItem("dev_impersonated_role");
    } else {
      localStorage.setItem("dev_impersonated_role", selectedRole);
    }
    toast.success(`Berhasil switch ke peran ${selectedRole}`);
    setShowConfirm(false);
    window.location.reload();
  };

  const { data: config } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => getAppConfig(),
  });
  const appName = config?.appName || "Log Book";
  const logoUrl = config?.logoUrl || null;
  const permissions = config?.permissions as any || null;

  const isMenuAllowed = (to: string) => {
    if (user?.role === "developer") return true;
    const userRole = user?.role || "staff";

    if (!permissions || !permissions[userRole]) {
      if (to === "/manajemen-pengguna" || to === "/validasi") return userRole === "admin";
      if (to === "/panel-developer") return false;
      return true;
    }

    const allowedMenus = permissions[userRole]?.menus || [];
    const menuKey = to.replace(/^\//, "");
    return allowedMenus.includes(menuKey);
  };

  const allowedMain = MAIN_NAV.map((item) => {
    if (item.to === "/tugas") {
      return { ...item, label: `${appName} Meeting` };
    }
    if (item.to === "/pelacak") {
      return { ...item, label: `${appName} Harian` };
    }
    return item;
  }).filter((item) => isMenuAllowed(item.to));
  const allowedAdmin = ADMIN_NAV.filter((item) => isMenuAllowed(item.to));
  const allowedSettings = SETTINGS_NAV.filter((item) => isMenuAllowed(item.to));

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
    <Sidebar collapsible="icon" className="border-r border-slate-100 dark:border-slate-800 bg-gradient-to-b from-[#FAFCFF] via-white to-[#F0F4FA] dark:from-slate-900 dark:to-slate-950 shadow-[1px_0_24px_rgba(0,119,182,0.025)] transition-all duration-300">
      <SidebarHeader className={isCollapsed ? "p-2 flex justify-center items-center h-16" : "p-5 pb-4"}>
        <Link
          to="/dasbor"
          className={isCollapsed ? "flex items-center justify-center w-full" : "flex items-center gap-3.5 w-full pl-1.5"}
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0077B6] to-[#48CAE4] flex items-center justify-center shadow-[0_8px_16px_rgba(0,119,182,0.22)] shrink-0 overflow-hidden transition-all duration-500 hover:scale-105 hover:rotate-6 ring-4 ring-[#90E0EF]/15 relative">
            {logoUrl ? (
              <img src={logoUrl} alt={appName} className="w-full h-full object-cover" />
            ) : (
              <FileText className="w-5 h-5 text-white" strokeWidth={2.5} />
            )}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col justify-center min-w-0">
              <div className="font-extrabold tracking-tight text-slate-850 dark:text-white text-base leading-tight truncate max-w-[130px]" title={appName}>
                {appName}
              </div>
              <div className="text-[9px] uppercase font-bold tracking-widest text-[#0077B6] dark:text-[#48CAE4] leading-none mt-1">
                Workspace
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className={isCollapsed ? "px-1.5 py-2" : "px-3 py-2"}>
        {allowedMain.length > 0 && (
          <SidebarGroup>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-[10px] font-bold tracking-widest text-[#0077B6]/50 dark:text-slate-400 uppercase px-3.5 py-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0077B6]/40" />
                Utama
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {allowedMain.map((item) => (
                  <NavLink key={item.to} item={item} active={isActive(item.to)} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {allowedAdmin.length > 0 && (
          <SidebarGroup>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-[10px] font-bold tracking-widest text-[#0077B6]/50 dark:text-slate-400 uppercase px-3.5 py-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0077B6]/40" />
                Administrasi
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {allowedAdmin.map((item) => (
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

        {(allowedSettings.length > 0 || (canDev && DEV_NAV.length > 0)) && (
          <SidebarGroup>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-[10px] font-bold tracking-widest text-[#0077B6]/50 dark:text-slate-400 uppercase px-3.5 py-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0077B6]/40" />
                Pengaturan
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {allowedSettings.map((item) => (
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
        )}
      </SidebarContent>

      <SidebarFooter className={isCollapsed ? "p-2 flex flex-col items-center gap-3" : "p-4 gap-4"}>
        {user?.originalRole === "developer" && !isCollapsed && (
          <div className="px-1 py-1 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            <div className="text-[9px] uppercase font-extrabold tracking-widest text-[#0077B6] dark:text-slate-400 pl-1">
              Dev Mode Switcher
            </div>
            <div className="flex gap-1 bg-slate-100/60 dark:bg-slate-900/60 p-0.5 rounded-xl border border-slate-200/50">
              {(["developer", "admin", "staff"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    if (user.role === r) return;
                    setSelectedRole(r);
                    setShowConfirm(true);
                  }}
                  className={`flex-1 text-[10px] font-extrabold py-1.5 rounded-lg transition-all duration-300 ${
                    user.role === r
                      ? "bg-white dark:bg-slate-800 text-[#0077B6] shadow-sm scale-105"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-slate-800/40"
                  }`}
                >
                  {r === "developer" ? "Dev" : r === "admin" ? "Admin" : "Staff"}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isCollapsed ? (
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-white via-[#FAFCFF] to-transparent dark:from-slate-900 dark:via-slate-900/50 dark:to-transparent border border-slate-100 dark:border-slate-800 shadow-[0_4px_12px_rgba(0,119,182,0.01)] backdrop-blur-md overflow-hidden w-full transition-all duration-300 hover:border-[#0077B6]/25 hover:shadow-[0_8px_24px_rgba(0,119,182,0.06)] hover:-translate-y-0.5">
            <div className="w-[32px] h-[40px] border border-[#0077B6]/20 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden relative shadow-[0_2px_8px_rgba(0,119,182,0.06)] ring-2 ring-[#0077B6]/5 transition-all">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[#0077B6] dark:text-[#48CAE4] text-[11px] font-bold">{initials}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-800 dark:text-white truncate">
                {user?.name ?? "…"}
              </div>
              <div className="flex flex-wrap items-center gap-1 mt-1">
                {roles.map((r) => (
                  <Badge
                    key={r}
                    variant="secondary"
                    className="text-[9px] px-1.5 py-0 h-4 bg-[#0077B6]/8 text-[#0077B6] dark:bg-[#48CAE4]/10 dark:text-[#48CAE4] border-none font-semibold hover:bg-[#0077B6]/8 uppercase tracking-wider rounded-md"
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
              className="shrink-0 h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-650 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors duration-200 flex items-center justify-center border border-transparent hover:border-red-100/50"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5 w-full">
            <div className="w-[32px] h-[40px] border border-[#0077B6]/20 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden relative shadow-[0_2px_8px_rgba(0,119,182,0.06)] ring-2 ring-[#0077B6]/5 transition-all" title={user?.name}>
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[#0077B6] dark:text-[#48CAE4] text-[11px] font-bold">{initials}</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              title="Keluar"
              className="w-8 h-8 rounded-lg hover:bg-red-50 hover:text-red-650 dark:hover:bg-red-950/30 dark:hover:text-red-400 flex items-center justify-center transition-all hover:scale-105 active:scale-95 border border-transparent hover:border-red-100/50"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="surface-card border-none rounded-2xl p-6 shadow-soft max-w-sm mx-auto">
          <AlertDialogHeader className="space-y-3 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#0077B6]/10 flex items-center justify-center text-[#0077B6] scale-110">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <AlertDialogTitle className="text-lg font-bold text-slate-800 dark:text-white">
              Konfirmasi Switch Peran
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Apakah Anda yakin ingin meninjau workspace ini sebagai peran <strong className="text-slate-800 dark:text-slate-200 uppercase">{selectedRole === "staff" ? "staff / user biasa" : selectedRole}</strong>?
              Tampilan menu, tombol aksi, dan izin CRUD akan otomatis menyesuaikan peran tersebut.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-2">
            <AlertDialogCancel className="flex-1 rounded-xl border border-slate-100 dark:border-slate-800 font-semibold text-xs py-2">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleConfirmSwitch()}
              className="flex-1 rounded-xl bg-gradient-to-r from-[#0077B6] to-[#0077B6]/90 text-white font-semibold text-xs py-2 shadow-md hover:shadow-lg transition-all"
            >
              Ya, Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  return (
    <SidebarMenuItem className="relative">
      <SidebarMenuButton
        asChild
        isActive={active}
        className={`rounded-xl transition-all duration-300 ${
          isCollapsed
            ? "justify-center px-0 mx-auto w-10 h-10"
            : "pl-3.5 py-5.5"
        } ${
          active
            ? isCollapsed
              ? "bg-[#0077B6]/12 text-[#0077B6] font-bold shadow-[0_4px_12px_-2px_rgba(0,119,182,0.15)] scale-105 border border-[#0077B6]/20"
              : "bg-gradient-to-r from-[#0077B6]/8 via-[#0077B6]/3 to-transparent text-[#0077B6] font-bold shadow-[inset_3px_0_0_0_#0077B6] scale-[1.01]"
            : isCollapsed
              ? "text-slate-800 dark:text-slate-200 font-bold hover:bg-[#0077B6]/6 hover:text-[#0077B6] hover:scale-105"
              : "text-slate-700 dark:text-slate-350 font-bold hover:bg-[#0077B6]/5 hover:text-[#0077B6] hover:translate-x-1 pl-4"
        }`}
      >
        <Link to={item.to} className={isCollapsed ? "flex items-center justify-center w-full h-full" : "flex items-center gap-3 w-full"}>
          <Icon
            strokeWidth={3.0}
            className={`w-[18px] h-[18px] transition-all duration-300 shrink-0 ${
              active
                ? "text-[#0077B6] scale-110 drop-shadow-[0_0_8px_rgba(0,119,182,0.35)]"
                : "text-slate-900 dark:text-slate-50 hover:text-[#0077B6]"
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
  const { data: config } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => getAppConfig(),
  });
  const appName = config?.appName || "Log Book";

  const title = useMemo(
    () => titleFromPath(location.pathname, appName),
    [location.pathname, appName],
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

function titleFromPath(path: string, appName: string): string {
  const map: Record<string, string> = {
    "/dasbor": "Dasbor",
    "/tugas": `${appName} Meeting`,
    "/pelacak": `${appName} Harian`,
    "/laporan": "Laporan",
    "/manajemen-pengguna": "Pengguna",
    "/validasi": "Validasi Log",
    "/pengaturan": "Pengaturan",
    "/panel-developer": "Panel Developer",
  };
  const key = Object.keys(map).find(
    (k) => path === k || path.startsWith(k + "/"),
  );
  return key ? map[key] : appName;
}
