-- Anular contrato: only Administrador. Vendors must ask the admin.
-- Closing a rental posts it to costs; annulling does not.

DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND p.key = 'contracts.cancel'
  AND r.slug <> 'administrador';
