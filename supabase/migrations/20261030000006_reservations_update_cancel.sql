-- Cancelling a reservation is an UPDATE of status, not a DELETE.
-- reservations.cancel alone was blocked by reservations.edit-only RLS
-- (PostgREST success with 0 rows).

DROP POLICY IF EXISTS reservations_update ON public.reservations;
CREATE POLICY reservations_update ON public.reservations
  FOR UPDATE TO authenticated
  USING (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'reservations.edit')
      OR public.has_permission(auth.uid(), 'reservations.cancel')
    )
  )
  WITH CHECK (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'reservations.edit')
      OR public.has_permission(auth.uid(), 'reservations.cancel')
    )
  );
