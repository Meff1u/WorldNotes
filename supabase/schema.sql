-- WorldNotes cloud sync: one row per user holding the same JSON the app keeps in localStorage.

create table if not exists public.stores (
    user_id uuid primary key references auth.users (id) on delete cascade,
    data jsonb not null,
    updated_at timestamptz not null default now(),
    constraint stores_data_size check (pg_column_size(data) < 5000000)
);

-- Row Level Security: without a matching policy nobody can touch a row, even with the public key
alter table public.stores enable row level security;

create policy "Users can read their own store"
    on public.stores for select
    to authenticated
    using ((select auth.uid()) = user_id);

create policy "Users can create their own store"
    on public.stores for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

create policy "Users can update their own store"
    on public.stores for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "Users can delete their own store"
    on public.stores for delete
    to authenticated
    using ((select auth.uid()) = user_id);

-- Keeps updated_at current on every write, whatever the app sends
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger stores_touch_updated_at
    before update on public.stores
    for each row execute function public.touch_updated_at();

-- Lets other devices of the same user hear about changes right away
alter publication supabase_realtime add table public.stores;
