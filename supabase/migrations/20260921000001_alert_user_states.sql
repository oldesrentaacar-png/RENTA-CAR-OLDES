-- Per-user alert read/dismiss state.
-- System alerts stay active while the business condition applies;
-- each staff profile can dismiss or mark-read independently.

CREATE TABLE IF NOT EXISTS public.alert_user_states (
  alert_id uuid NOT NULL REFERENCES public.alerts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alert_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_alert_user_states_user_dismissed
  ON public.alert_user_states (user_id, dismissed_at);

CREATE INDEX IF NOT EXISTS idx_alert_user_states_user_read
  ON public.alert_user_states (user_id, read_at);

ALTER TABLE public.alert_user_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alert_user_states_select ON public.alert_user_states;
CREATE POLICY alert_user_states_select ON public.alert_user_states
  FOR SELECT TO authenticated
  USING (
    public.is_active_staff()
    AND public.has_permission(auth.uid(), 'dashboard.view')
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS alert_user_states_insert ON public.alert_user_states;
CREATE POLICY alert_user_states_insert ON public.alert_user_states
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_staff()
    AND public.has_permission(auth.uid(), 'dashboard.view')
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS alert_user_states_update ON public.alert_user_states;
CREATE POLICY alert_user_states_update ON public.alert_user_states
  FOR UPDATE TO authenticated
  USING (
    public.is_active_staff()
    AND public.has_permission(auth.uid(), 'dashboard.view')
    AND user_id = auth.uid()
  )
  WITH CHECK (
    public.is_active_staff()
    AND public.has_permission(auth.uid(), 'dashboard.view')
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS alert_user_states_delete ON public.alert_user_states;
CREATE POLICY alert_user_states_delete ON public.alert_user_states
  FOR DELETE TO authenticated
  USING (
    public.is_active_staff()
    AND public.has_permission(auth.uid(), 'dashboard.view')
    AND user_id = auth.uid()
  );
