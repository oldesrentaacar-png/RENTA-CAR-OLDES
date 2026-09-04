-- Official OLDES contact block for PDFs and settings.
UPDATE public.business_settings
SET
  address = 'CWXV+297, San Luis Talpa',
  phone = '+503 7435-0381',
  whatsapp = '+503 7435-0381',
  email = 'soporte@oldesrentacar.com',
  business_name = COALESCE(NULLIF(TRIM(business_name), ''), 'OLDES Rent-a-Car'),
  updated_at = now();
