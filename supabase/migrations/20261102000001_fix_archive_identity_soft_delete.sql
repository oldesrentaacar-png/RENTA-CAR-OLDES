-- archive_identity_on_soft_delete was shared by tables with `code` and tables
-- with `slug`. Touching NEW.slug on payment_receipts raised:
--   record "new" has no field "slug"
-- and anular recibo showed the generic "Ocurrió un error al procesar la solicitud."

CREATE OR REPLACE FUNCTION public.archive_identity_on_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_suffix text;
  v_row jsonb;
  v_code text;
  v_slug text;
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    v_suffix := substr(replace(NEW.id::text, '-', ''), 1, 8);
    v_row := to_jsonb(NEW);

    IF TG_ARGV[0] = 'code' THEN
      v_code := v_row->>'code';
      IF v_code IS NOT NULL AND position('__del__' in v_code) = 0 THEN
        NEW.code := v_code || '__del__' || v_suffix;
      END IF;
    ELSIF TG_ARGV[0] = 'slug' THEN
      v_slug := v_row->>'slug';
      IF v_slug IS NOT NULL AND position('-del-' in v_slug) = 0 THEN
        NEW.slug := left(v_slug, 80) || '-del-' || v_suffix;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Soft-delete of linked income is an UPDATE; allow finance.delete too.
DROP POLICY IF EXISTS income_update ON public.income_transactions;
CREATE POLICY income_update ON public.income_transactions
  FOR UPDATE TO authenticated
  USING (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'finance.edit')
      OR public.has_permission(auth.uid(), 'finance.delete')
    )
  )
  WITH CHECK (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'finance.edit')
      OR public.has_permission(auth.uid(), 'finance.delete')
    )
  );
