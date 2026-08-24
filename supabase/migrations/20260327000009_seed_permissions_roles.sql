-- Rent A Car Pro — Seed permissions, roles, business settings
-- Migration: 20260327000009_seed_permissions_roles.sql

-- ---------------------------------------------------------------------------
-- Permissions catalog
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (key, module, description) VALUES
  ('dashboard.view', 'dashboard', 'Ver panel principal'),

  ('requests.view', 'requests', 'Ver solicitudes de la Landing'),
  ('requests.create', 'requests', 'Crear solicitudes manualmente'),
  ('requests.edit', 'requests', 'Editar solicitudes'),
  ('requests.delete', 'requests', 'Eliminar solicitudes'),

  ('customers.view', 'customers', 'Ver clientes'),
  ('customers.create', 'customers', 'Crear clientes'),
  ('customers.edit', 'customers', 'Editar clientes'),
  ('customers.delete', 'customers', 'Eliminar clientes'),

  ('quotes.view', 'quotes', 'Ver cotizaciones'),
  ('quotes.create', 'quotes', 'Crear cotizaciones'),
  ('quotes.edit', 'quotes', 'Editar cotizaciones'),
  ('quotes.delete', 'quotes', 'Eliminar cotizaciones'),
  ('quotes.send', 'quotes', 'Enviar cotizaciones'),
  ('quotes.accept', 'quotes', 'Aceptar/rechazar cotizaciones'),

  ('reservations.view', 'reservations', 'Ver reservas'),
  ('reservations.create', 'reservations', 'Crear reservas'),
  ('reservations.edit', 'reservations', 'Editar reservas'),
  ('reservations.cancel', 'reservations', 'Cancelar reservas'),

  ('vehicles.view', 'vehicles', 'Ver vehículos'),
  ('vehicles.create', 'vehicles', 'Crear vehículos'),
  ('vehicles.edit', 'vehicles', 'Editar vehículos'),
  ('vehicles.archive', 'vehicles', 'Archivar vehículos'),
  ('vehicles.publish', 'vehicles', 'Publicar vehículos en Landing'),

  ('contracts.view', 'contracts', 'Ver contratos'),
  ('contracts.create', 'contracts', 'Crear contratos'),
  ('contracts.edit', 'contracts', 'Editar contratos'),
  ('contracts.sign', 'contracts', 'Firmar contratos'),
  ('contracts.cancel', 'contracts', 'Cancelar contratos'),

  ('inspections.view', 'inspections', 'Ver inspecciones'),
  ('inspections.create', 'inspections', 'Crear inspecciones'),
  ('inspections.edit', 'inspections', 'Editar inspecciones'),

  ('finance.view', 'finance', 'Ver finanzas'),
  ('finance.create', 'finance', 'Registrar ingresos/gastos'),
  ('finance.edit', 'finance', 'Editar transacciones financieras'),
  ('finance.delete', 'finance', 'Eliminar transacciones financieras'),

  ('maintenance.view', 'maintenance', 'Ver mantenimiento'),
  ('maintenance.create', 'maintenance', 'Registrar mantenimiento'),
  ('maintenance.edit', 'maintenance', 'Editar mantenimiento'),

  ('reports.view', 'reports', 'Ver reportes'),
  ('reports.export', 'reports', 'Exportar reportes'),

  ('users.view', 'users', 'Ver usuarios'),
  ('users.create', 'users', 'Crear usuarios'),
  ('users.edit', 'users', 'Editar usuarios'),
  ('users.disable', 'users', 'Desactivar usuarios'),

  ('roles.manage', 'roles', 'Administrar roles y permisos'),

  ('settings.view', 'settings', 'Ver configuración del negocio'),
  ('settings.edit', 'settings', 'Editar configuración del negocio'),

  ('audit.view', 'audit', 'Ver auditoría')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- System roles
-- ---------------------------------------------------------------------------

INSERT INTO public.roles (name, slug, description, is_system) VALUES
  ('Administrador', 'administrador', 'Acceso total al sistema', true),
  ('Gerente', 'gerente', 'Gestión operativa y reportes', true),
  ('Recepción', 'recepcion', 'Atención al cliente y operación diaria', true),
  ('Empleado', 'empleado', 'Acceso básico de consulta', true),
  ('Contabilidad', 'contabilidad', 'Finanzas y reportes', true),
  ('Mantenimiento', 'mantenimiento', 'Flota y mantenimiento', true)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Role ↔ permission mappings
-- ---------------------------------------------------------------------------

-- Administrador: all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'administrador'
ON CONFLICT DO NOTHING;

-- Gerente: all except users/roles admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key NOT IN (
  'users.create', 'users.edit', 'users.disable', 'roles.manage'
)
WHERE r.slug = 'gerente'
ON CONFLICT DO NOTHING;

-- Recepción: operation modules
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'dashboard.view',
  'requests.view', 'requests.create', 'requests.edit',
  'customers.view', 'customers.create', 'customers.edit',
  'quotes.view', 'quotes.create', 'quotes.edit', 'quotes.send', 'quotes.accept',
  'reservations.view', 'reservations.create', 'reservations.edit',
  'vehicles.view',
  'contracts.view', 'contracts.create',
  'inspections.view', 'inspections.create',
  'settings.view'
)
WHERE r.slug = 'recepcion'
ON CONFLICT DO NOTHING;

-- Empleado: read-only basics
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'dashboard.view',
  'requests.view',
  'customers.view',
  'quotes.view',
  'reservations.view',
  'vehicles.view',
  'contracts.view',
  'inspections.view',
  'settings.view'
)
WHERE r.slug = 'empleado'
ON CONFLICT DO NOTHING;

-- Contabilidad: finance + reports + read operation
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'dashboard.view',
  'customers.view',
  'quotes.view',
  'reservations.view',
  'vehicles.view',
  'contracts.view',
  'finance.view', 'finance.create', 'finance.edit', 'finance.delete',
  'reports.view', 'reports.export',
  'settings.view'
)
WHERE r.slug = 'contabilidad'
ON CONFLICT DO NOTHING;

-- Mantenimiento: fleet maintenance
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'dashboard.view',
  'vehicles.view', 'vehicles.edit',
  'maintenance.view', 'maintenance.create', 'maintenance.edit',
  'inspections.view', 'inspections.create', 'inspections.edit',
  'settings.view'
)
WHERE r.slug = 'mantenimiento'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Business settings — OLDES Rent-a-Car defaults
-- ---------------------------------------------------------------------------

INSERT INTO public.business_settings (
  business_name,
  legal_name,
  logo_url,
  address,
  phone,
  whatsapp,
  email,
  currency,
  timezone,
  quote_terms,
  contract_terms,
  default_deposit,
  default_insurance,
  default_delivery_fee,
  policies
)
SELECT
  'OLDES Rent-a-Car',
  'OLDES Rent-a-Car',
  '/brand/oldes-logo.png',
  'San Antonio, San Miguel, El Salvador',
  '+503 0000-0000',
  '+503 0000-0000',
  'info@oldesrentacar.com',
  'USD',
  'America/El_Salvador',
  'Las tarifas incluyen kilometraje básico según políticas vigentes. El depósito es reembolsable al devolver el vehículo en las mismas condiciones.',
  'El arrendatario declara conocer y aceptar las condiciones del contrato de alquiler de vehículo. Documentación válida requerida.',
  200.00,
  15.00,
  25.00,
  jsonb_build_object(
    'min_rental_age', 21,
    'license_required', true,
    'fuel_policy', 'return_same_level',
    'cancellation_hours', 24
  )
WHERE NOT EXISTS (SELECT 1 FROM public.business_settings LIMIT 1);
