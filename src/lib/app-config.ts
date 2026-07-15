// ponytail: Mengganti query Supabase client-side untuk app_config dengan Server Functions Drizzle ORM
import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { appConfig as configTable } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

export const getAppConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const configs = await db.query.appConfig.findMany({
      orderBy: [desc(configTable.updatedAt)],
      limit: 1,
    });
    const cfg = configs[0];
    if (!cfg) return null;
    return {
      ...cfg,
      permissions: cfg.permissions as Record<
        string,
        { menus?: string[]; actions?: Record<string, string[]> }
      >,
    };
  },
);

export const saveAppConfig = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().optional(),
      logoUrl: z.string().nullable().optional(),
      appName: z.string().optional(),
      permissions: z.record(z.string(), z.unknown()).nullable().optional(),
      pdfPaperSize: z.string().optional(),
      pdfOrientation: z.string().optional(),
      pdfHeaderText: z.string().nullable().optional(),
      pdfFooterText: z.string().nullable().optional(),
      logLimit: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    const role = session.user.role || "staff";
    if (role !== "developer") {
      const currentConfig = await db.query.appConfig.findFirst();
      const perms = currentConfig?.permissions as Record<
        string,
        { actions?: Record<string, string[]> }
      >;
      const rolePerms = perms?.[role];

      const isSavingBranding =
        data.logoUrl !== undefined ||
        data.appName !== undefined ||
        data.permissions !== undefined;
      const isSavingPdf =
        data.pdfPaperSize !== undefined ||
        data.pdfOrientation !== undefined ||
        data.pdfHeaderText !== undefined ||
        data.pdfFooterText !== undefined ||
        data.logLimit !== undefined;

      if (isSavingBranding) {
        const hasUpdate =
          rolePerms?.actions?.["branding"]?.includes("update") ??
          role === "admin";
        if (!hasUpdate) throw new Error("Forbidden");
      }
      if (isSavingPdf) {
        const hasUpdate =
          rolePerms?.actions?.["pdf"]?.includes("update") ?? role === "admin";
        if (!hasUpdate) throw new Error("Forbidden");
      }
    }

    const payload = {
      logoUrl: data.logoUrl || null,
      appName: data.appName || "Log Book",
      permissions: data.permissions || null,
      pdfPaperSize: data.pdfPaperSize || "A4",
      pdfOrientation: data.pdfOrientation || "portrait",
      pdfHeaderText: data.pdfHeaderText || null,
      pdfFooterText: data.pdfFooterText || null,
      logLimit: data.logLimit !== undefined ? data.logLimit : 200,
      updatedAt: new Date(),
    };

    if (data.id) {
      await db
        .update(configTable)
        .set(payload)
        .where(eq(configTable.id, data.id));
    } else {
      await db.insert(configTable).values(payload);
    }
  });
