-- Allow re-signing contracts (upsert updates existing signature rows).
CREATE POLICY contract_signatures_update ON public.contract_signatures
  FOR UPDATE TO authenticated
  USING (
    public.is_active_staff()
    AND public.has_permission(auth.uid(), 'contracts.sign')
  )
  WITH CHECK (
    public.is_active_staff()
    AND public.has_permission(auth.uid(), 'contracts.sign')
  );
