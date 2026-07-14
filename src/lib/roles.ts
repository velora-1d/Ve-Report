export type AppRole = "developer" | "admin" | "staff";

export const ROLE_LABEL: Record<AppRole, string> = {
  developer: "Developer",
  admin: "Admin",
  staff: "Staff",
};

export function isAdminOrDev(roles: AppRole[]): boolean {
  return roles.includes("admin") || roles.includes("developer");
}

export function isDeveloper(roles: AppRole[]): boolean {
  return roles.includes("developer");
}
