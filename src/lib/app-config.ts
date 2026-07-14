// ponytail: Mengganti query Supabase client-side untuk app_config dengan Server Functions Drizzle ORM
import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { appConfig as configTable } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

export const getAppConfig = createServerFn({ method: "GET" }).handler(async () => {
  const configs = await db.query.appConfig.findMany({
    orderBy: [desc(configTable.updatedAt)],
    limit: 1,
  });
  return configs[0] || null;
});

export const saveAppConfig = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().optional(),
      logoUrl: z.string().nullable().optional(),
      appName: z.string().optional(),
      permissions: z.record(z.any()).nullable().optional(),
      pdfPaperSize: z.string().optional(),
      pdfOrientation: z.string().optional(),
      pdfHeaderText: z.string().nullable().optional(),
      pdfFooterText: z.string().nullable().optional(),
    })
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    const role = session.user.role || "staff";
    if (role !== "developer") {
      const currentConfig = await db.query.appConfig.findFirst();
      const perms = currentConfig?.permissions as any;
      const rolePerms = perms?.[role];
      const hasUpdate = rolePerms?.actions?.["pengaturan"]?.includes("update") ?? (role === "admin");
      if (!hasUpdate) throw new Error("Forbidden");
    }

    const payload = {
      logoUrl: data.logoUrl || null,
      appName: data.appName || "Log Book",
      permissions: data.permissions || null,
      pdfPaperSize: data.pdfPaperSize || "A4",
      pdfOrientation: data.pdfOrientation || "portrait",
      pdfHeaderText: data.pdfHeaderText || null,
      pdfFooterText: data.pdfFooterText || null,
      updatedAt: new Date(),
    };

    if (data.id) {
      await db.update(configTable).set(payload).where(eq(configTable.id, data.id));
    } else {
      await db.insert(configTable).values(payload);
    }
  });
