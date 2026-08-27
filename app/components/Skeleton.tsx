import { CATEGORIES } from '@/app/lib/portfolio';

/**
 * 로딩 스켈레톤.
 *
 * 데이터가 오기 전에 "무엇이 올지"를 같은 자리·같은 크기로 미리 그린다. 실제 화면과
 * 블록 위치가 어긋나면 내용이 도착하는 순간 화면이 튀므로, 각 블록의 크기는 대응하는
 * 실제 요소(글자 크기, 카드 패딩, 표 행 높이)에서 그대로 가져왔다.
 *
 * 회색 블록은 전부 `.skeleton` 한 클래스만 쓴다. 광택과 다크 대응은 globals.css에 있다.
 */

/** 회색 블록 하나. 크기·모양은 쓰는 쪽에서 클래스로 정한다. */
export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  /** 막대그래프처럼 클래스로 적을 수 없는 가변 치수에만 쓴다. */
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} />;
}

/** 스크린리더에만 읽히는 안내. 화면에는 회색 블록만 보이므로 상태를 말로 한 번 알린다. */
function LoadingAnnouncement({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="sr-only">
      {children}
    </p>
  );
}

/** SectionTitle과 같은 자리(mb-3, px-1, 17px 제목)의 회색 제목 */
function TitleSkeleton({ width, action }: { width: string; action?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <Skeleton className={`h-[17px] ${width}`} />
      {action && <Skeleton className={`h-[22px] ${action} rounded-full`} />}
    </div>
  );
}

/**
 * 상단 바 스켈레톤.
 *
 * AppHeader는 로그인 정보를 받아야 그릴 수 있어서, 아직 그 정보조차 없는
 * 라우트 전환 중(loading.tsx)에만 쓴다. 컴포넌트가 이미 떠 있는 동안의 로딩에는
 * 진짜 AppHeader를 그대로 두고 본문만 스켈레톤으로 바꾼다.
 */
export function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-3.5">
        <Skeleton className="h-7 w-7 shrink-0 rounded-[9px]" />
        <Skeleton className="hidden h-[17px] w-[88px] sm:block" />
        <Skeleton className="h-[30px] w-[224px] shrink-0 rounded-[10px]" />
        <div className="ml-auto flex items-center gap-3">
          <Skeleton className="h-7 w-[84px] shrink-0 rounded-[10px]" />
          <Skeleton className="hidden h-[22px] w-[96px] rounded-full sm:block" />
          <Skeleton className="h-[30px] w-[62px] shrink-0 rounded-[10px]" />
        </div>
      </div>
    </header>
  );
}

/** 큰 금액을 얹은 요약 카드. 아래 칸 수만 화면마다 다르다. */
function SummaryCardSkeleton({ columns }: { columns: number }) {
  return (
    <section className="card overflow-hidden">
      <div className="p-6">
        <Skeleton className="h-[14px] w-[84px]" />
        <Skeleton className="mt-2.5 h-[34px] w-[220px] rounded-[10px]" />
        <Skeleton className="mt-3 h-[15px] w-[136px]" />
      </div>
      <div
        className={`grid ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'} divide-x divide-gray-100 border-t border-gray-100`}
      >
        {Array.from({ length: columns }, (_, i) => (
          <div key={i} className="px-4 py-4 sm:px-6">
            <Skeleton className="h-[13px] w-[68px]" />
            <Skeleton className="mt-2 h-4 w-[84px]" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** 아바타 + 두 줄 + 오른쪽 금액. 보유 자산·종목별 배당 목록이 같은 모양이다. */
function ListRowSkeleton() {
  return (
    <li className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 last:border-b-0">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-[15px] w-[46%] max-w-[180px]" />
        <Skeleton className="mt-1.5 h-3 w-[30%] max-w-[120px]" />
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <Skeleton className="h-[15px] w-[92px]" />
        <Skeleton className="mt-1.5 h-3 w-[64px]" />
      </div>
    </li>
  );
}

function ListCardSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="card overflow-hidden">
      {Array.from({ length: rows }, (_, i) => (
        <ListRowSkeleton key={i} />
      ))}
    </ul>
  );
}

/**
 * 포트폴리오 화면 본문.
 *
 * 자산이 몇 개인지는 아직 모르므로 목록은 4줄만 깔아 둔다. 더 길게 깔면 내용이
 * 도착할 때 화면이 위로 크게 접히고, 짧게 깔면 스켈레톤이 화면을 못 채운다.
 */
export function PortfolioSkeleton() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-5xl space-y-7 px-5 py-6 pb-16">
      <LoadingAnnouncement>포트폴리오를 불러오고 있어요</LoadingAnnouncement>

      <SummaryCardSkeleton columns={2} />

      {/* 보유 자산 */}
      <section>
        <TitleSkeleton width="w-[68px]" />
        <ListCardSkeleton rows={4} />
      </section>

      {/* 자산 등록 — 입력칸 수가 고정이라 실제 배치를 그대로 깐다. */}
      <section>
        <TitleSkeleton width="w-[68px]" />
        <div className="card space-y-4 p-6">
          {[0, 1].map((row) => (
            <div key={row} className="grid gap-4 sm:grid-cols-2">
              {[0, 1].map((col) => (
                <div key={col}>
                  <Skeleton className="mb-[7px] h-[13px] w-[56px]" />
                  <Skeleton className="h-[47px] w-full rounded-[14px]" />
                </div>
              ))}
            </div>
          ))}
          <Skeleton className="h-[54px] w-full rounded-[14px]" />
        </div>
      </section>
    </main>
  );
}

/**
 * 자산 구성 화면 본문.
 *
 * 도넛과 목표 비중 두 블록뿐이라 실제 화면과 순서·크기를 그대로 맞춰 둔다.
 * 목표 비중은 분류 수가 고정이라 줄 수까지 실제와 같다.
 */
export function AllocationSkeleton() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-5xl space-y-7 px-5 py-6 pb-16">
      <LoadingAnnouncement>자산 구성을 불러오고 있어요</LoadingAnnouncement>

      {/* 자산 구성 */}
      <section>
        <TitleSkeleton width="w-[68px]" />
        <div className="card flex flex-col items-center gap-7 p-6 sm:flex-row sm:gap-8">
          <Skeleton className="h-44 w-44 shrink-0 rounded-full" />
          <div className="flex w-full flex-col gap-3.5">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <div className="mb-1.5 flex items-center gap-2">
                  <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" />
                  <Skeleton className="h-[14px] w-[72px]" />
                  <Skeleton className="ml-auto h-[14px] w-[34px]" />
                  <Skeleton className="h-[13px] w-[88px]" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 목표 비중 */}
      <section>
        <TitleSkeleton width="w-[68px]" action="w-[74px]" />
        <div className="card px-5 py-1">
          {CATEGORIES.map((category) => (
            <div key={category} className="border-b border-gray-100 py-4 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" />
                  <Skeleton className="h-[15px] w-[76px]" />
                </div>
                <Skeleton className="h-[30px] w-[72px] shrink-0 rounded-[10px]" />
              </div>
              <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
              <div className="mt-2 flex items-center justify-between">
                <Skeleton className="h-3 w-[62px]" />
                <Skeleton className="h-3 w-[104px]" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

/** 12개월 막대그래프. 높이는 눈속임이라 고정값을 돌려 쓴다. */
const BAR_HEIGHTS = ['32%', '58%', '24%', '86%', '44%', '70%', '30%', '62%', '40%', '78%', '36%', '54%'];

/** 배당 화면 본문 */
export function DividendSkeleton() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-5xl space-y-7 px-5 py-6 pb-16">
      <LoadingAnnouncement>배당 정보를 불러오고 있어요</LoadingAnnouncement>

      <SummaryCardSkeleton columns={3} />

      {/* 다가오는 배당 */}
      <section>
        <TitleSkeleton width="w-[86px]" />
        <ul className="card overflow-hidden">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="flex items-center gap-3 border-b border-gray-100 px-5 py-3.5 last:border-b-0"
            >
              <Skeleton className="h-[22px] w-[52px] shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-[14px] w-[42%] max-w-[160px]" />
                <Skeleton className="mt-1.5 h-3 w-[56%] max-w-[210px]" />
              </div>
              <Skeleton className="h-[14px] w-[76px] shrink-0" />
            </li>
          ))}
        </ul>
      </section>

      {/* 월별 배당 */}
      <section>
        <TitleSkeleton width="w-[68px]" />
        <div className="card px-4 py-6 sm:px-6">
          <div className="flex items-end gap-1 sm:gap-2">
            {BAR_HEIGHTS.map((height, index) => (
              <div key={index} className="min-w-0 flex-1">
                <div className="hidden h-4 sm:block" />
                <div className="flex h-32 w-full items-end">
                  <Skeleton className="w-full rounded-t-[5px] rounded-b-none" style={{ height }} />
                </div>
                <div className="mt-2 flex justify-center">
                  <Skeleton className="h-[11px] w-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 종목별 배당 */}
      <section>
        <TitleSkeleton width="w-[86px]" />
        <ListCardSkeleton rows={4} />
      </section>
    </main>
  );
}
