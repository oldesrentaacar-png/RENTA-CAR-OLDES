-- Fix: permission loader + inspection create RLS + reception fleet/inspection ops
-- Matches existing overrides schema: effect = 'GRANT' | 'DENY'

CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.user_status;
  v_role_id uuid;
  v_keys text[];
BEGIN
  IF p_user_id IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  SELECT p.status, p.role_id
  INTO v_status, v_role_id
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF NOT FOUND OR v_status <> 'ACTIVE' OR v_role_id IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x.key ORDER BY x.key), ARRAY[]::text[])
  INTO v_keys
  FROM (
    SELECT perm.key
    FROM public.role_permissions rp
    JOIN public.permissions perm ON perm.id = rp.permission_id
    WHERE rp.role_id = v_role_id

    UNION

    SELECT perm.key
    FROM public.user_permission_overrides uo
    JOIN public.permissions perm ON perm.id = uo.permission_id
    WHERE uo.user_id = p_user_id AND uo.effect = 'GRANT'
  ) x
  WHERE x.key NOT IN (
    SELECT perm.key
    FROM public.user_permission_overrides uo
    JOIN public.permissions perm ON perm.id = uo.permission_id
    WHERE uo.user_id = p_user_id AND uo.effect = 'DENY'
  );

  RETURN COALESCE(v_keys, ARRAY[]::text[]);
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_permissions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO service_role;

-- NOTE: has_permission keeps SQL arg name p_key; the app calls it as p_key.

DROP POLICY IF EXISTS inspection_checklist_items_staff ON public.inspection_checklist_items;
CREATE POLICY inspection_checklist_items_staff ON public.inspection_checklist_items
  FOR ALL
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.view'))
  WITH CHECK (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'inspections.edit')
      OR public.has_permission(auth.uid(), 'inspections.create')
    )
  );

DROP POLICY IF EXISTS inspection_damage_marks_staff ON public.inspection_damage_marks;
CREATE POLICY inspection_damage_marks_staff ON public.inspection_damage_marks
  FOR ALL
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.view'))
  WITH CHECK (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'inspections.edit')
      OR public.has_permission(auth.uid(), 'inspections.create')
    )
  );

DROP POLICY IF EXISTS inspection_photos_staff ON public.inspection_photos;
CREATE POLICY inspection_photos_staff ON public.inspection_photos
  FOR ALL
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.view'))
  WITH CHECK (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'inspections.edit')
      OR public.has_permission(auth.uid(), 'inspections.create')
    )
  );

-- Soft-delete/archive is an UPDATE; allow vehicles.archive as well as edit
DROP POLICY IF EXISTS vehicles_update ON public.vehicles;
CREATE POLICY vehicles_update ON public.vehicles
  FOR UPDATE TO authenticated
  USING (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'vehicles.edit')
      OR public.has_permission(auth.uid(), 'vehicles.archive')
    )
  )
  WITH CHECK (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'vehicles.edit')
      OR public.has_permission(auth.uid(), 'vehicles.archive')
    )
  );

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'recepcion'
  AND p.key IN ('vehicles.edit', 'vehicles.archive', 'inspections.edit')
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
