-- 분류 이름 변경: 미국주식 → 해외주식, 미국채권 → 해외채권, 금 → 대체투자
--
-- schema.sql은 `create table if not exists`라 이미 만들어진 테이블의 제약조건을
-- 바꾸지 못한다. 이미 배포된 프로젝트는 이 파일을 Supabase 대시보드 > SQL Editor에
-- 그대로 붙여넣고 한 번 실행하세요. (여러 번 실행해도 결과는 같다)
--
-- 새 이름을 넣으려면 제약조건을 먼저 풀고, 옮긴 뒤에 새 목록으로 다시 건다.

alter table public.assets      drop constraint if exists assets_category_check;
alter table public.allocations drop constraint if exists allocations_category_check;

-- ---------------------------------------------------------------------------
-- 보유 자산: 이름만 바꾸면 된다
-- ---------------------------------------------------------------------------
update public.assets
   set category = case category
                    when '미국주식' then '해외주식'
                    when '미국채권' then '해외채권'
                    when '금'       then '대체투자'
                  end
 where category in ('미국주식', '미국채권', '금');

-- ---------------------------------------------------------------------------
-- 목표 비중: (user_id, category)가 기본 키라 새 이름 행이 이미 있을 수 있다.
--
-- 새 코드가 목표 비중을 저장하면 분류 전체를 upsert하므로, 이 마이그레이션 전에
-- 한 번이라도 저장한 사용자는 새 이름 행(0%)과 예전 이름 행을 함께 갖는다.
-- 그래서 덮어쓰기가 아니라, 아직 값이 없는 새 이름 행에만 예전 값을 옮긴다.
-- ---------------------------------------------------------------------------
insert into public.allocations (user_id, category, target_pct)
select a.user_id,
       case a.category
         when '미국주식' then '해외주식'
         when '미국채권' then '해외채권'
         when '금'       then '대체투자'
       end,
       a.target_pct
  from public.allocations a
 where a.category in ('미국주식', '미국채권', '금')
    on conflict (user_id, category) do update
   set target_pct = excluded.target_pct
 where public.allocations.target_pct = 0;

delete from public.allocations where category in ('미국주식', '미국채권', '금');

-- ---------------------------------------------------------------------------
-- 새 분류 목록으로 다시 건다 (schema.sql과 같은 목록)
-- ---------------------------------------------------------------------------
alter table public.assets
  add constraint assets_category_check check (
    category in ('해외주식', '해외채권', '국내주식', '국내채권', '대체투자', '암호화폐', '기타')
  );

alter table public.allocations
  add constraint allocations_category_check check (
    category in ('해외주식', '해외채권', '국내주식', '국내채권', '대체투자', '암호화폐', '기타')
  );
