-- Internal RPCs are only called by trusted Edge Functions.
revoke execute on function public.create_order(text,text,uuid,bigint) from public, anon, authenticated;
grant execute on function public.create_order(text,text,uuid,bigint) to service_role;
