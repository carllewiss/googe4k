CREATE TABLE public.backup_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  target text NOT NULL,
  file_name text NOT NULL,
  size_bytes bigint,
  table_count integer,
  row_count bigint,
  status text NOT NULL DEFAULT 'success',
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_history TO authenticated;
GRANT ALL ON public.backup_history TO service_role;
ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage backup history"
  ON public.backup_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Manifest: ordered table list with row estimates and column definitions
CREATE OR REPLACE FUNCTION public.backup_manifest(p_user_id uuid)
RETURNS TABLE(table_name text, restore_order int, row_estimate bigint, columns jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.name, t.ord, GREATEST(c.reltuples::bigint, 0),
    coalesce((
      SELECT jsonb_agg(
        jsonb_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
                           'nullable', NOT a.attnotnull, 'default', pg_get_expr(d.adbin, d.adrelid))
        ORDER BY a.attnum)
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    ), '[]'::jsonb)
  FROM (VALUES
    ('accounts',1),('accounting_periods',2),('profiles',3),('user_roles',4),('suppliers',5),
    ('customers',6),('products',7),('services',8),('blog_posts',9),('service_inquiries',10),
    ('system_settings',11),('fixed_assets',12),('purchase_orders',13),('purchases',14),
    ('purchase_receipts',15),('stock_batches',16),('purchase_items',17),('purchase_order_items',18),
    ('supplier_payments',19),('supplier_payment_allocations',20),('shop_customers',21),('shop_orders',22),
    ('shop_order_items',23),('journal_entries',24),('journal_lines',25),('invoices',26),('invoice_items',27),
    ('credit_notes',28),('credit_note_items',29),('payments',30),('payment_corrections',31),
    ('mpesa_transactions',32),('expenses',33),('customer_notes',34),('wifi_transactions',35),
    ('wifi_vouchers',36),('opening_stock_runs',37),('inventory_adjustments',38),('inventory_adjustment_items',39),
    ('inventory_adjustment_attachments',40),('goods_returns',41),('goods_return_items',42),
    ('goods_return_attachments',43),('asset_depreciation',44),('asset_disposals',45),('asset_maintenance',46),
    ('price_history',47),('backup_history',48)
  ) AS t(name, ord)
  JOIN pg_class c ON c.relname = t.name
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE public.has_role(p_user_id, 'admin');
$$;

-- Disable/enable user triggers on all app tables (restore runs with triggers off so no
-- journals are re-posted and audit locks don't block)
CREATE OR REPLACE FUNCTION public.restore_triggers(p_user_id uuid, p_disable boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text;
  v_count integer := 0;
  v_tables text[] := ARRAY[
    'accounts','accounting_periods','profiles','user_roles','suppliers','customers','products','services',
    'blog_posts','service_inquiries','system_settings','fixed_assets','purchase_orders','purchases',
    'purchase_receipts','stock_batches','purchase_items','purchase_order_items','supplier_payments',
    'supplier_payment_allocations','shop_customers','shop_orders','shop_order_items','journal_entries',
    'journal_lines','invoices','invoice_items','credit_notes','credit_note_items','payments',
    'payment_corrections','mpesa_transactions','expenses','customer_notes','wifi_transactions',
    'wifi_vouchers','opening_stock_runs','inventory_adjustments','inventory_adjustment_items',
    'inventory_adjustment_attachments','goods_returns','goods_return_items','goods_return_attachments',
    'asset_depreciation','asset_disposals','asset_maintenance','price_history','backup_history'
  ];
BEGIN
  IF NOT public.has_role(p_user_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can run restore operations';
  END IF;
  FOREACH t IN ARRAY v_tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I %s TRIGGER USER', t,
        CASE WHEN p_disable THEN 'DISABLE' ELSE 'ENABLE' END);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- table may not exist; skip
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.backup_manifest(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.backup_manifest(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.restore_triggers(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.restore_triggers(uuid, boolean) TO authenticated;

-- Admins can download scheduled backups stored in the private backups bucket
CREATE POLICY "Admins can download backups"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete backups"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.backup_history IS 'Audit log of manual and scheduled database backups and restores';