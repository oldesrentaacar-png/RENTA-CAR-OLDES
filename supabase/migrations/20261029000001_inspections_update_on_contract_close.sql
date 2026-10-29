-- Closing a rental writes km/fuel on CHECK_IN. Staff with contracts.edit
-- (e.g. Empleado with that override) were blocked by inspections.edit RLS:
-- PostgREST returned success with 0 rows, then close failed as if they
-- never entered fuel/mileage.

DROP POLICY IF EXISTS inspections_update ON public.inspections;
CREATE POLICY inspections_update ON public.inspections
  FOR UPDATE TO authenticated
  USING (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'inspections.edit')
      OR public.has_permission(auth.uid(), 'contracts.edit')
    )
  )
  WITH CHECK (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'inspections.edit')
      OR public.has_permission(auth.uid(), 'contracts.edit')
    )
  );
