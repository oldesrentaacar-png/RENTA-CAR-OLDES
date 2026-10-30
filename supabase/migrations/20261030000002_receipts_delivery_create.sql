-- Delivery staff (empleado) has finance.create but not finance.view.
-- PostgREST INSERT ... RETURNING also checks USING, so they could not
-- register the abono that is part of handing over the car.

DROP POLICY IF EXISTS payment_receipts_staff ON public.payment_receipts;
CREATE POLICY payment_receipts_staff ON public.payment_receipts
  FOR ALL TO authenticated
  USING (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'finance.view')
      OR public.has_permission(auth.uid(), 'finance.create')
    )
  )
  WITH CHECK (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'finance.create')
      OR public.has_permission(auth.uid(), 'finance.edit')
      OR public.has_permission(auth.uid(), 'finance.delete')
    )
  );
