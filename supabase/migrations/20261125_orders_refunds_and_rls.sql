-- ============================================================================
-- ERXIDI: Columnas de reembolso en orders + Políticas RLS permisivas (demo)
-- Ejecutar en Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Columnas de trazabilidad de reembolsos en public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refund_status character varying(20) DEFAULT 'none' NOT NULL,
  ADD COLUMN IF NOT EXISTS refund_method character varying(30),
  ADD COLUMN IF NOT EXISTS refund_reference character varying(100),
  ADD COLUMN IF NOT EXISTS refunded_at timestamp with time zone;

-- Constraint de estados válidos de reembolso (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_refund_status_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_refund_status_check
      CHECK (refund_status IN ('none', 'pending', 'completed'));
  END IF;
END $$;

-- 2. Simplificación de políticas RLS para evitar bloqueos entre roles
--    (permite cancelación y restitución de stock desde Cliente, Dueña y Repartidor)

-- 2.1 Tabla public.orders
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_update_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_customer" ON public.orders;
DROP POLICY IF EXISTS "Permitir crear ordenes a invitados y usuarios" ON public.orders;
DROP POLICY IF EXISTS "Permitir lectura publica de ordenes" ON public.orders;
DROP POLICY IF EXISTS "orders_all_permissive" ON public.orders;

CREATE POLICY "orders_all_permissive"
  ON public.orders
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 2.2 Tabla public.order_items
DROP POLICY IF EXISTS "order_items_insert_customer" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_policy" ON public.order_items;
DROP POLICY IF EXISTS "Permitir insertar items de orden" ON public.order_items;
DROP POLICY IF EXISTS "Permitir lectura publica de order_items" ON public.order_items;
DROP POLICY IF EXISTS "order_items_all_permissive" ON public.order_items;

CREATE POLICY "order_items_all_permissive"
  ON public.order_items
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 2.3 Tabla public.product_variants (permite restitución de stock al cancelar)
DROP POLICY IF EXISTS "product_variants_all_owner" ON public.product_variants;
DROP POLICY IF EXISTS "product_variants_select_public" ON public.product_variants;
DROP POLICY IF EXISTS "product_variants_all_permissive" ON public.product_variants;

CREATE POLICY "product_variants_all_permissive"
  ON public.product_variants
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
