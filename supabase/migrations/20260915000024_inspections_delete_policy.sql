-- Allow hard-delete of inspections (CASCADE children).
-- create: needed for orphan cleanup if checklist insert fails after insert.
-- edit: staff UI delete from list/detail.

DROP POLICY IF EXISTS inspections_delete ON public.inspections;
CREATE POLICY inspections_delete ON public.inspections
  FOR DELETE TO authenticated
  USING (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'inspections.edit')
      OR public.has_permission(auth.uid(), 'inspections.create')
    )
  );
