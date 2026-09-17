-- calendar.view + Visitante (solo calendario) + sync matriz de roles sistema

INSERT INTO public.permissions (key, module, description) VALUES
  ('calendar.view', 'calendar', 'Ver calendario de reservas')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.roles (name, slug, description, is_system) VALUES
  ('Visitante', 'visitante', 'Solo acceso al calendario de reservas', true)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS: lectura de datos del calendario con calendar.view
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS reservations_select ON public.reservations;
CREATE POLICY reservations_select ON public.reservations
  FOR SELECT TO authenticated
  USING (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'reservations.view')
      OR public.has_permission(auth.uid(), 'calendar.view')
    )
  );

DROP POLICY IF EXISTS vehicles_select ON public.vehicles;
CREATE POLICY vehicles_select ON public.vehicles
  FOR SELECT TO authenticated
  USING (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'vehicles.view')
      OR public.has_permission(auth.uid(), 'calendar.view')
    )
  );

DROP POLICY IF EXISTS customers_select ON public.customers;
CREATE POLICY customers_select ON public.customers
  FOR SELECT TO authenticated
  USING (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'customers.view')
      OR public.has_permission(auth.uid(), 'calendar.view')
    )
  );

-- ---------------------------------------------------------------------------
-- Sync exacto de role_permissions (roles sistema)
-- ---------------------------------------------------------------------------

DELETE FROM public.role_permissions rp
USING public.roles r
WHERE rp.role_id = r.id
  AND r.slug IN (
    'administrador',
    'gerente',
    'recepcion',
    'empleado',
    'contabilidad',
    'mantenimiento',
    'visitante'
  );

-- Administrador: todos los permisos
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'administrador';

-- Gerente: todos excepto administración de usuarios/roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key NOT IN (
  'users.create', 'users.edit', 'users.disable', 'roles.manage'
)
WHERE r.slug = 'gerente';

-- Recepción: operación diaria (24 + calendar.view vía reservations.view en app;
-- se mantiene sin calendar.view explícito para no alterar la matriz operativa)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'dashboard.view',
  'requests.view', 'requests.create', 'requests.edit',
  'customers.view', 'customers.create', 'customers.edit',
  'quotes.view', 'quotes.create', 'quotes.edit', 'quotes.send', 'quotes.accept',
  'reservations.view', 'reservations.create', 'reservations.edit',
  'vehicles.view', 'vehicles.edit', 'vehicles.archive',
  'contracts.view', 'contracts.create',
  'inspections.view', 'inspections.create', 'inspections.edit',
  'settings.view'
)
WHERE r.slug = 'recepcion';

-- Empleado: matriz personalizada del cliente (14)
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
  'contracts.view', 'contracts.create', 'contracts.sign', 'contracts.cancel',
  'inspections.view', 'inspections.create',
  'maintenance.view', 'maintenance.create'
)
WHERE r.slug = 'empleado';

-- Contabilidad: finanzas + lectura (13)
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
WHERE r.slug = 'contabilidad';

-- Mantenimiento: flota (10)
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
WHERE r.slug = 'mantenimiento';

-- Visitante: únicamente calendario
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key = 'calendar.view'
WHERE r.slug = 'visitante';
