
-- Perketat INSERT policy system_logs
DROP POLICY IF EXISTS "Any auth inserts log" ON public.system_logs;
CREATE POLICY "Auth inserts own log" ON public.system_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Cabut hak eksekusi fungsi internal
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
