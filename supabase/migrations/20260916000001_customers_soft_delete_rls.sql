-- Soft-delete customers uses UPDATE (deleted_at), not DELETE.
-- Allow staff with customers.delete to perform that update as well as customers.edit.

DROP POLICY IF EXISTS customers_update ON public.customers;

CREATE POLICY customers_update ON public.customers
  FOR UPDATE
  USING (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'customers.edit')
      OR public.has_permission(auth.uid(), 'customers.delete')
    )
  )
  WITH CHECK (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'customers.edit')
      OR public.has_permission(auth.uid(), 'customers.delete')
    )
  );
