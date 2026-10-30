-- Sending a quote (email/WhatsApp) marks status SENT. Staff with quotes.send
-- were blocked by quotes.edit-only UPDATE RLS (0-row success).

DROP POLICY IF EXISTS quotes_update ON public.quotes;
CREATE POLICY quotes_update ON public.quotes
  FOR UPDATE TO authenticated
  USING (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'quotes.edit')
      OR public.has_permission(auth.uid(), 'quotes.send')
    )
  )
  WITH CHECK (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'quotes.edit')
      OR public.has_permission(auth.uid(), 'quotes.send')
    )
  );
