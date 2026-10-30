-- Staff who can register an inspection must also be able to finish it
-- (km, fuel, notes). inspections.create was enough to insert, but UPDATE
-- only allowed inspections.edit / contracts.edit.

DROP POLICY IF EXISTS inspections_update ON public.inspections;
CREATE POLICY inspections_update ON public.inspections
  FOR UPDATE TO authenticated
  USING (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'inspections.edit')
      OR public.has_permission(auth.uid(), 'inspections.create')
      OR public.has_permission(auth.uid(), 'contracts.edit')
    )
  )
  WITH CHECK (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'inspections.edit')
      OR public.has_permission(auth.uid(), 'inspections.create')
      OR public.has_permission(auth.uid(), 'contracts.edit')
    )
  );
