import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppConfig = Database["public"]["Tables"]["app_config"]["Row"];

export async function fetchAppConfig(): Promise<AppConfig | null> {
  const { data, error } = await supabase
    .from("app_config")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertAppConfig(
  patch: Partial<Database["public"]["Tables"]["app_config"]["Update"]>,
  existingId?: string,
) {
  if (existingId) {
    const { error } = await supabase.from("app_config").update(patch).eq("id", existingId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("app_config").insert(patch as never);
  if (error) throw error;
}
