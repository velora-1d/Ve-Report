
-- ===== ENUMS =====
CREATE TYPE public.app_role AS ENUM ('developer', 'admin', 'staff');
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'review', 'done');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.log_level AS ENUM ('info', 'warning', 'error', 'critical');

-- ===== UPDATED_AT HELPER =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  avatar_url TEXT,
  phone VARCHAR(20),
  position VARCHAR(100),
  bio TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== USER ROLES =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ===== has_role() security-definer =====
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_dev(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'developer')
  );
$$;

-- ===== Profiles policies =====
-- Developer disembunyikan dari admin: admin melihat semua profile KECUALI yang role-nya developer
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Admin views non-dev profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND NOT public.has_role(id, 'developer')
  );
CREATE POLICY "Developer views all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'developer'));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admin updates non-dev profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND NOT public.has_role(id, 'developer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND NOT public.has_role(id, 'developer'));
CREATE POLICY "Developer updates all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_role(auth.uid(), 'developer'));

-- ===== User_roles policies =====
CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin sees non-dev roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND role <> 'developer');
CREATE POLICY "Developer sees all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_role(auth.uid(), 'developer'));
CREATE POLICY "Admin manages non-dev roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND role <> 'developer')
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND role <> 'developer');

-- ===== TASKS =====
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  due_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);

CREATE POLICY "Staff sees own tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "Admin/Dev see all tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (public.is_admin_or_dev(auth.uid()));
CREATE POLICY "Admin/Dev insert tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_dev(auth.uid()));
CREATE POLICY "Staff updates own task status" ON public.tasks
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());
CREATE POLICY "Admin/Dev update all tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_dev(auth.uid()))
  WITH CHECK (public.is_admin_or_dev(auth.uid()));
CREATE POLICY "Admin/Dev delete tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (public.is_admin_or_dev(auth.uid()));

-- ===== TASK STATUS HISTORY =====
CREATE TABLE public.task_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  from_status public.task_status,
  to_status public.task_status NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.task_status_history TO authenticated;
GRANT ALL ON public.task_status_history TO service_role;
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_status_history_task ON public.task_status_history(task_id);

CREATE POLICY "View history of visible tasks" ON public.task_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id
      AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid()
           OR public.is_admin_or_dev(auth.uid())))
  );
CREATE POLICY "Insert history for own action" ON public.task_status_history
  FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid());

-- ===== SCHEDULES =====
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reminder_minutes_before INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_schedules_updated_at BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_schedules_user ON public.schedules(user_id);
CREATE INDEX idx_schedules_start ON public.schedules(start_time);

CREATE POLICY "Users manage own schedules" ON public.schedules
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin/Dev see all schedules" ON public.schedules
  FOR SELECT TO authenticated USING (public.is_admin_or_dev(auth.uid()));
CREATE POLICY "Admin/Dev manage all schedules" ON public.schedules
  FOR ALL TO authenticated
  USING (public.is_admin_or_dev(auth.uid()))
  WITH CHECK (public.is_admin_or_dev(auth.uid()));

-- ===== TRACKER LOGS =====
CREATE TABLE public.tracker_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT,
  duration_minutes INTEGER,
  logged_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracker_logs TO authenticated;
GRANT ALL ON public.tracker_logs TO service_role;
ALTER TABLE public.tracker_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tracker_task ON public.tracker_logs(task_id);
CREATE INDEX idx_tracker_user ON public.tracker_logs(user_id);

CREATE POLICY "Users manage own logs" ON public.tracker_logs
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin/Dev see all logs" ON public.tracker_logs
  FOR SELECT TO authenticated USING (public.is_admin_or_dev(auth.uid()));

-- ===== REPORTS =====
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  generated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  filter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  filters JSONB,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_reports_generated_by ON public.reports(generated_by);

CREATE POLICY "Users see own reports" ON public.reports
  FOR SELECT TO authenticated
  USING (generated_by = auth.uid() OR filter_user_id = auth.uid());
CREATE POLICY "Users create own reports" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (generated_by = auth.uid());
CREATE POLICY "Admin/Dev see all reports" ON public.reports
  FOR SELECT TO authenticated USING (public.is_admin_or_dev(auth.uid()));
CREATE POLICY "Admin/Dev manage all reports" ON public.reports
  FOR ALL TO authenticated
  USING (public.is_admin_or_dev(auth.uid()))
  WITH CHECK (public.is_admin_or_dev(auth.uid()));

-- ===== APP CONFIG (singleton) =====
CREATE TABLE public.app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url TEXT,
  app_name VARCHAR(100) DEFAULT 'VeReport',
  pdf_paper_size VARCHAR(20) DEFAULT 'A4',
  pdf_orientation VARCHAR(20) DEFAULT 'portrait',
  pdf_header_text TEXT,
  pdf_footer_text TEXT,
  pdf_margin VARCHAR(20) DEFAULT 'default',
  telegram_bot_token TEXT,
  telegram_chat_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_app_config_updated_at BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "All authenticated read config" ON public.app_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Dev update config" ON public.app_config
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_dev(auth.uid()))
  WITH CHECK (public.is_admin_or_dev(auth.uid()));
CREATE POLICY "Admin/Dev insert config" ON public.app_config
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_dev(auth.uid()));

INSERT INTO public.app_config (app_name) VALUES ('VeReport');

-- ===== SYSTEM LOGS =====
CREATE TABLE public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level public.log_level NOT NULL DEFAULT 'info',
  category VARCHAR(50),
  message TEXT NOT NULL,
  metadata JSONB,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.system_logs TO authenticated;
GRANT ALL ON public.system_logs TO service_role;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_syslogs_level ON public.system_logs(level);
CREATE INDEX idx_syslogs_created ON public.system_logs(created_at DESC);

CREATE POLICY "Developer reads all logs" ON public.system_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'developer'));
CREATE POLICY "Any auth inserts log" ON public.system_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- ===== AUTO-CREATE PROFILE + STAFF ROLE ON SIGNUP =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'staff')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
