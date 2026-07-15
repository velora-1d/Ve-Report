import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { users as usersTable, divisions, userDivisions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

// ponytail: Fungsi server untuk mengambil daftar nama pengguna sederhana (untuk filter)
export const getSimpleUsers = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    const role = session.user.role || "staff";
    if (role !== "admin" && role !== "developer") throw new Error("Forbidden");

    return db.query.users.findMany({
      columns: {
        id: true,
        name: true,
      },
      orderBy: [desc(usersTable.name)],
    });
  },
);

// ponytail: Fungsi server untuk mengambil daftar divisi kerja milik user saat ini
export const getUserDivisionsListLaporan = createServerFn({
  method: "GET",
}).handler(async () => {
  const session = await getSession();
  if (!session || !session.user) throw new Error("Unauthorized");

  const role = session.user.role || "staff";
  if (role === "admin" || role === "developer") {
    return await db.select().from(divisions).orderBy(divisions.name);
  }

  return await db
    .select({
      id: divisions.id,
      name: divisions.name,
    })
    .from(userDivisions)
    .innerJoin(divisions, eq(userDivisions.divisionId, divisions.id))
    .where(eq(userDivisions.userId, session.user.id))
    .orderBy(divisions.name);
});
