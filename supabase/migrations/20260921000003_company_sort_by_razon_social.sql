-- Empresas: last_name = razón social para que el listado A–Z coincida con el nombre mostrado.
UPDATE public.customers
SET last_name = company_name
WHERE customer_type = 'COMPANY'
  AND company_name IS NOT NULL
  AND btrim(company_name) <> ''
  AND deleted_at IS NULL
  AND (
    last_name IS NULL
    OR btrim(last_name) = ''
    OR last_name = '-'
    OR last_name IS DISTINCT FROM company_name
  );
