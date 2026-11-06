CREATE OR REPLACE FUNCTION public.get_topbid_paypal_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('order_id', id, 'charge_cents', charge_cents, 'status', status::text)
  FROM public.orders
  WHERE id = p_order_id AND status = 'pending';
$$;

REVOKE ALL ON FUNCTION public.get_topbid_paypal_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_topbid_paypal_order(uuid) TO anon, authenticated;
