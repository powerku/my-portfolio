-- 곳간 스키마
-- Supabase 대시보드 > SQL Editor 에 그대로 붙여넣고 실행하세요.

-- ---------------------------------------------------------------------------
-- 보유 자산
-- ---------------------------------------------------------------------------
create table if not exists public.assets (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ticker            text not null check (length(ticker) between 1 and 32),
  category          text not null check (
                      category in ('해외주식', '해외채권', '국내주식', '국내채권', '대체투자', '암호화폐', '기타')
                    ),
  quantity          double precision not null check (quantity > 0),
  purchase_price    double precision not null check (purchase_price > 0),
  purchase_currency text not null check (purchase_currency in ('KRW', 'USD')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists assets_user_id_created_at_idx
  on public.assets (user_id, created_at);

-- ---------------------------------------------------------------------------
-- 카테고리별 목표 비중
-- ---------------------------------------------------------------------------
create table if not exists public.allocations (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category   text not null check (
               category in ('해외주식', '해외채권', '국내주식', '국내채권', '대체투자', '암호화폐', '기타')
             ),
  target_pct double precision not null default 0 check (target_pct >= 0 and target_pct <= 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

-- ---------------------------------------------------------------------------
-- updated_at 자동 갱신
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();

drop trigger if exists allocations_set_updated_at on public.allocations;
create trigger allocations_set_updated_at
  before update on public.allocations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: 본인 데이터만 읽고 쓸 수 있다
-- ---------------------------------------------------------------------------
alter table public.assets      enable row level security;
alter table public.allocations enable row level security;

drop policy if exists "assets are owner only" on public.assets;
create policy "assets are owner only"
  on public.assets
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "allocations are owner only" on public.allocations;
create policy "allocations are owner only"
  on public.allocations
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
