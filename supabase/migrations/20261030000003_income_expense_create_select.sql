-- Staff with finance.create ("Registrar ingresos/gastos") must be able to
-- read the rows they just inserted (INSERT ... RETURNING) and see the lists.

DROP POLICY IF EXISTS income_select ON public.income_transactions;
CREATE POLICY income_select ON public.income_transactions
  FOR SELECT TO authenticated
  USING (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'finance.view')
      OR public.has_permission(auth.uid(), 'finance.create')
    )
  );

DROP POLICY IF EXISTS expense_select ON public.expense_transactions;
CREATE POLICY expense_select ON public.expense_transactions
  FOR SELECT TO authenticated
  USING (
    public.is_active_staff()
    AND (
      public.has_permission(auth.uid(), 'finance.view')
      OR public.has_permission(auth.uid(), 'finance.create')
    )
  );
