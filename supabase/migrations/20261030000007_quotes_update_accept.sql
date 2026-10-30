-- Accepting a quote is an UPDATE. quotes.accept was blocked by
-- quotes.edit / quotes.send only RLS.

DROP POLICY IF EXISTS quotes_update ON public.quotes;
CREATE POLICY quotes_update ON public.quotes
  FOR UPDATE TO authenticated
  USING (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'quotes.edit')
      OR public.has_permission(auth.uid(), 'quotes.send')
      OR public.has_permission(auth.uid(), 'quotes.accept')
    )
  )
  WITH CHECK (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'quotes.edit')
      OR public.has_permission(auth.uid(), 'quotes.send')
      OR public.has_permission(auth.uid(), 'quotes.accept')
    )
  );
