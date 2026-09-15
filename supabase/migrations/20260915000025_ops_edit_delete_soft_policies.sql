-- Soft-delete for maintenance + allow receipt meta updates / void under RLS.

ALTER TABLE public.maintenance_records
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_maintenance_records_not_deleted
  ON public.maintenance_records (maintenance_date DESC)
  WHERE deleted_at IS NULL;

-- Receipts: soft-delete/update needs WITH CHECK beyond finance.create only.
DROP POLICY IF EXISTS payment_receipts_staff ON public.payment_receipts;
CREATE POLICY payment_receipts_staff ON public.payment_receipts
  FOR ALL TO authenticated
  USING (
    public.is_active_staff()
    AND public.has_permission(auth.uid(), 'finance.view')
  )
  WITH CHECK (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'finance.create')
      OR public.has_permission(auth.uid(), 'finance.edit')
      OR public.has_permission(auth.uid(), 'finance.delete')
    )
  );
