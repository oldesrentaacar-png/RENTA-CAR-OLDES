-- Inspection freehand strokes + photo RLS cleanup

ALTER TABLE public.inspection_damage_marks
  ADD COLUMN IF NOT EXISTS path_points jsonb;

COMMENT ON COLUMN public.inspection_damage_marks.path_points IS
  'Optional freehand stroke as [{x,y}, ...] normalized 0..1. Centroid kept in x/y.';

-- Drop legacy policy that only allowed inspections.edit (blocks create-only roles)
DROP POLICY IF EXISTS inspection_photos_all ON public.inspection_photos;

DROP POLICY IF EXISTS inspection_photos_staff ON public.inspection_photos;
CREATE POLICY inspection_photos_staff ON public.inspection_photos
  FOR ALL
  USING (
    public.is_active_staff()
    AND public.has_permission(auth.uid(), 'inspections.view')
  )
  WITH CHECK (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'inspections.edit')
      OR public.has_permission(auth.uid(), 'inspections.create')
    )
  );
