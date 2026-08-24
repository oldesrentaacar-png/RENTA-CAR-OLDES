-- Rent A Car Pro — Row Level Security policies
-- Migration: 20260327000008

-- ===========================================================================
-- Enable RLS on all application tables
-- ===========================================================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_request_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_damage_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- Helper macro pattern (documented):
--   public.is_active_staff() AND public.has_permission(auth.uid(), '<key>')
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Roles & permissions (roles.manage)
-- ---------------------------------------------------------------------------

CREATE POLICY roles_select ON public.roles
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage'));

CREATE POLICY roles_insert ON public.roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage'));

CREATE POLICY roles_update ON public.roles
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage'));

CREATE POLICY roles_delete ON public.roles
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage') AND is_system = false);

CREATE POLICY permissions_select ON public.permissions
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND (
    public.has_permission(auth.uid(), 'roles.manage')
    OR public.has_permission(auth.uid(), 'users.view')
  ));

CREATE POLICY role_permissions_all ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage'));

CREATE POLICY user_overrides_all ON public.user_permission_overrides
  FOR ALL TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage'));

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_select_staff ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'users.view'));

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'users.create'));

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_staff ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'users.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'users.edit'));

-- ---------------------------------------------------------------------------
-- Business settings
-- ---------------------------------------------------------------------------

CREATE POLICY business_settings_select ON public.business_settings
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'settings.view'));

CREATE POLICY business_settings_update ON public.business_settings
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'settings.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'settings.edit'));

CREATE POLICY business_settings_insert ON public.business_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'settings.edit'));

-- Document sequences: no direct client access (use next_document_code)
CREATE POLICY document_sequences_deny ON public.document_sequences
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

CREATE POLICY customers_select ON public.customers
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'customers.view'));

CREATE POLICY customers_insert ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'customers.create'));

CREATE POLICY customers_update ON public.customers
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'customers.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'customers.edit'));

CREATE POLICY customers_delete ON public.customers
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'customers.delete'));

-- ---------------------------------------------------------------------------
-- Vehicles & images
-- ---------------------------------------------------------------------------

CREATE POLICY vehicles_select ON public.vehicles
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'vehicles.view'));

CREATE POLICY vehicles_insert ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'vehicles.create'));

CREATE POLICY vehicles_update ON public.vehicles
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'vehicles.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'vehicles.edit'));

CREATE POLICY vehicles_delete ON public.vehicles
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'vehicles.archive'));

-- Anonymous read for published catalog (used by public_vehicles view / Landing)
CREATE POLICY vehicles_public_read ON public.vehicles
  FOR SELECT TO anon
  USING (
    published_on_web = true
    AND is_active = true
    AND deleted_at IS NULL
    AND archived_at IS NULL
    AND status NOT IN ('ARCHIVED', 'UNAVAILABLE')
  );

CREATE POLICY vehicle_images_all ON public.vehicle_images
  FOR ALL TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'vehicles.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'vehicles.edit'));

CREATE POLICY vehicle_images_select ON public.vehicle_images
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'vehicles.view'));

-- ---------------------------------------------------------------------------
-- Web requests
-- POST /api/public/requests uses SUPABASE_SERVICE_ROLE_KEY — not anon INSERT.
-- ---------------------------------------------------------------------------

CREATE POLICY web_requests_select ON public.web_requests
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'requests.view'));

CREATE POLICY web_requests_insert ON public.web_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'requests.create'));

CREATE POLICY web_requests_update ON public.web_requests
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'requests.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'requests.edit'));

CREATE POLICY web_requests_delete ON public.web_requests
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'requests.delete'));

-- Deny anonymous direct insert (Landing uses server API with service role)
CREATE POLICY web_requests_deny_anon ON public.web_requests
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY web_request_history_select ON public.web_request_status_history
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'requests.view'));

-- History rows are inserted by SECURITY DEFINER trigger

-- ---------------------------------------------------------------------------
-- Quotes & items
-- ---------------------------------------------------------------------------

CREATE POLICY quotes_select ON public.quotes
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'quotes.view'));

CREATE POLICY quotes_insert ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'quotes.create'));

CREATE POLICY quotes_update ON public.quotes
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'quotes.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'quotes.edit'));

CREATE POLICY quotes_delete ON public.quotes
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'quotes.delete'));

CREATE POLICY quote_items_all ON public.quote_items
  FOR ALL TO authenticated
  USING (public.is_active_staff() AND (
    public.has_permission(auth.uid(), 'quotes.edit')
    OR public.has_permission(auth.uid(), 'quotes.view')
  ))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'quotes.edit'));

-- ---------------------------------------------------------------------------
-- Reservations
-- ---------------------------------------------------------------------------

CREATE POLICY reservations_select ON public.reservations
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'reservations.view'));

CREATE POLICY reservations_insert ON public.reservations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'reservations.create'));

CREATE POLICY reservations_update ON public.reservations
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'reservations.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'reservations.edit'));

CREATE POLICY reservations_delete ON public.reservations
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'reservations.cancel'));

-- ---------------------------------------------------------------------------
-- Contracts & signatures
-- ---------------------------------------------------------------------------

CREATE POLICY contracts_select ON public.contracts
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'contracts.view'));

CREATE POLICY contracts_insert ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'contracts.create'));

CREATE POLICY contracts_update ON public.contracts
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'contracts.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'contracts.edit'));

CREATE POLICY contracts_delete ON public.contracts
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'contracts.cancel'));

CREATE POLICY contract_signatures_select ON public.contract_signatures
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'contracts.view'));

CREATE POLICY contract_signatures_insert ON public.contract_signatures
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'contracts.sign'));

-- ---------------------------------------------------------------------------
-- Inspections
-- ---------------------------------------------------------------------------

CREATE POLICY inspections_select ON public.inspections
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.view'));

CREATE POLICY inspections_insert ON public.inspections
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.create'));

CREATE POLICY inspections_update ON public.inspections
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.edit'));

CREATE POLICY inspection_checklist_all ON public.inspection_checklist_items
  FOR ALL TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.view'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.edit'));

CREATE POLICY inspection_photos_all ON public.inspection_photos
  FOR ALL TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.view'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.edit'));

CREATE POLICY inspection_damage_all ON public.inspection_damage_marks
  FOR ALL TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.view'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.edit'));

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------

CREATE POLICY income_select ON public.income_transactions
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.view'));

CREATE POLICY income_insert ON public.income_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.create'));

CREATE POLICY income_update ON public.income_transactions
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.edit'));

CREATE POLICY income_delete ON public.income_transactions
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.delete'));

CREATE POLICY expense_select ON public.expense_transactions
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.view'));

CREATE POLICY expense_insert ON public.expense_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.create'));

CREATE POLICY expense_update ON public.expense_transactions
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.edit'));

CREATE POLICY expense_delete ON public.expense_transactions
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.delete'));

-- ---------------------------------------------------------------------------
-- Maintenance
-- ---------------------------------------------------------------------------

CREATE POLICY maintenance_select ON public.maintenance_records
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'maintenance.view'));

CREATE POLICY maintenance_insert ON public.maintenance_records
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'maintenance.create'));

CREATE POLICY maintenance_update ON public.maintenance_records
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'maintenance.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'maintenance.edit'));

-- ---------------------------------------------------------------------------
-- Alerts (visible to active staff with dashboard access)
-- ---------------------------------------------------------------------------

CREATE POLICY alerts_select ON public.alerts
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'dashboard.view'));

CREATE POLICY alerts_update ON public.alerts
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'dashboard.view'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'dashboard.view'));

CREATE POLICY alerts_insert ON public.alerts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'dashboard.view'));

-- ---------------------------------------------------------------------------
-- Audit logs (read-only for staff; inserts via insert_audit_log SECURITY DEFINER)
-- ---------------------------------------------------------------------------

CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'audit.view'));

CREATE POLICY audit_logs_deny_client_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Public vehicles view — optional anon read (API may use service role instead)
-- ---------------------------------------------------------------------------

GRANT SELECT ON public.public_vehicles TO anon, authenticated;

COMMENT ON POLICY web_requests_deny_anon ON public.web_requests IS
  'Landing POST /api/public/requests must use Next.js server with SUPABASE_SERVICE_ROLE_KEY.';
