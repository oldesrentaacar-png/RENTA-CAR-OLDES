-- Anyone who can close a contract must also be able to save the return inspection
-- (km, fuel). Prevents silent 0-row updates when the role is Empleado with a
-- contracts.edit override.

INSERT INTO public.user_permission_overrides (user_id, permission_id, effect)
SELECT p.id, perm.id, 'GRANT'
FROM public.profiles p
JOIN public.permissions perm ON perm.key = 'inspections.edit'
WHERE p.status = 'ACTIVE'
  AND public.has_permission(p.id, 'contracts.edit')
  AND NOT public.has_permission(p.id, 'inspections.edit')
ON CONFLICT (user_id, permission_id) DO NOTHING;
