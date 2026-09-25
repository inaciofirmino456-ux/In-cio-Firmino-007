-- PRODUÇÃO: autenticação + RLS.
create table if not exists public.posts(
 id uuid primary key default gen_random_uuid(),
 title text not null,
 description text not null,
 image_url text,
 created_at timestamptz not null default now(),
 owner_id uuid not null references auth.users(id)
);
alter table public.posts enable row level security;
create policy "public_read_posts" on public.posts for select using(true);
create policy "owner_insert_posts" on public.posts for insert with check(auth.uid()=owner_id);
create policy "owner_update_posts" on public.posts for update using(auth.uid()=owner_id) with check(auth.uid()=owner_id);
create policy "owner_delete_posts" on public.posts for delete using(auth.uid()=owner_id);
-- Criar somente a conta do proprietário no Supabase Auth.
