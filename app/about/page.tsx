import Link from 'next/link';
import AppHeader from '@/app/components/AppHeader';
import SectionTitle from '@/app/components/SectionTitle';
import { createClient } from '@/app/lib/supabase/server';
import { CATEGORIES } from '@/app/lib/portfolio';

export const metadata = {
  title: '소개 · 곳간',
  description: '어떤 앱인지, 데이터는 어디에 저장되는지, 시세는 어디서 오는지',
};

/** 화면별로 뭘 하는 곳인지. 카드 순서는 상단 탭 순서와 같게 둔다. */
const FEATURES = [
  {
    href: '/',
    icon: '📊',
    title: '포트폴리오',
    body: '보유 종목과 매입가를 적어두면 현재가·평가금액·수익률을 계산해요. 달러 종목은 환율로 원화로 환산해서 함께 더해요.',
  },
  {
    href: '/allocation',
    icon: '🥧',
    title: '자산 구성',
    body: '분류별 비중을 도넛으로 보여줘요. 목표 비중을 정해두면 지금 비중과 얼마나 벌어졌는지 바로 알 수 있어요.',
  },
  {
    href: '/dividend',
    icon: '💰',
    title: '배당',
    body: '보유 종목에서 받을 배당금과 배당락일을 모아 보여줘요. 지급일은 종목이 알려주지 않으면 시장 관례로 추정한 날짜예요.',
  },
] as const;

/**
 * 앱 소개 화면.
 *
 * 다른 화면과 달리 시세를 조회하지 않으므로 환율 칩은 숨긴다(0을 넘긴다).
 * 로그인 여부만 헤더에 넘겨 로그인/로그아웃 버튼이 맞게 나오도록 한다.
 */
export default async function AboutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <AppHeader user={user ? { id: user.id, email: user.email ?? '' } : null} exchangeRate={0} active="/about" />

      <main className="mx-auto w-full max-w-5xl space-y-7 px-5 py-6 pb-16">
        <section className="card px-6 py-9 sm:px-8 sm:py-11">
          <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-brand shadow-[0_8px_20px_rgba(49,130,246,0.28)]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
              <path d="M4 17V10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M10 17V6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M16 17v-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
            </svg>
          </span>

          <h1 className="mt-6 text-[26px] font-bold leading-[1.4] text-gray-900 sm:text-[30px]">
            흩어진 내 자산을
            <br />
            한 화면에서 관리해요
          </h1>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-gray-600">
            증권사 앱을 여러 개 오가지 않아도 되도록, 국내·해외 주식과 채권·금·암호화폐까지 한곳에 적어두고
            평가금액과 배당을 함께 보는 개인용 포트폴리오예요.
          </p>

          <div className="mt-7 flex flex-wrap gap-2">
            <Link href="/" className="btn btn-primary rounded-[12px] px-4 py-2.5 text-[14px]">
              내 곳간 보기
            </Link>
            {!user && (
              <Link href="/login?next=%2Fabout" className="btn btn-secondary rounded-[12px] px-4 py-2.5 text-[14px]">
                로그인하고 기기 간 동기화
              </Link>
            )}
          </div>
        </section>

        <section>
          <SectionTitle>이런 걸 할 수 있어요</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <Link
                key={feature.href}
                href={feature.href}
                className="card flex flex-col px-5 py-6 transition-transform hover:-translate-y-0.5"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gray-100 text-[20px]">
                  {feature.icon}
                </span>
                <h3 className="mt-4 text-[16px] font-bold text-gray-900">{feature.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-gray-600">{feature.body}</p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle>내 데이터는 어디에 있나요</SectionTitle>
          <div className="card divide-y divide-gray-200 px-6 py-2">
            <div className="py-5">
              <p className="text-[15px] font-bold text-gray-900">로그인하지 않았다면</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-gray-600">
                이 브라우저에만 저장돼요. 서버로 올라가지 않는 대신, 다른 기기나 시크릿 창에서는 보이지 않고
                브라우저 데이터를 지우면 함께 사라져요.
              </p>
            </div>
            <div className="py-5">
              <p className="text-[15px] font-bold text-gray-900">로그인했다면</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-gray-600">
                계정에 저장돼 어느 기기에서 열어도 같은 포트폴리오가 보여요. 처음 로그인할 때 이 기기에 담아둔
                자산은 계정으로 한 번 옮겨지고, 기기에서는 지워져요.
              </p>
            </div>
            <div className="py-5">
              <p className="text-[15px] font-bold text-gray-900">로그인은 이메일 하나로</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-gray-600">
                비밀번호를 만들지 않고, 메일로 받은 링크로 들어와요. 증권 계좌를 연결하지 않으므로
                거래 내역이나 계좌 정보는 받지 않아요.
              </p>
            </div>
          </div>
        </section>

        <section>
          <SectionTitle>시세와 배당은 어디서 오나요</SectionTitle>
          <div className="card divide-y divide-gray-200 px-6 py-2">
            <div className="flex items-baseline justify-between gap-4 py-4">
              <span className="text-[14px] font-semibold text-gray-700">시세·환율</span>
              <span className="text-right text-[13px] text-gray-500">Yahoo Finance · 약 1분마다 갱신</span>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-4">
              <span className="text-[14px] font-semibold text-gray-700">배당 정보</span>
              <span className="text-right text-[13px] text-gray-500">Yahoo Finance · 약 6시간마다 갱신</span>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-4">
              <span className="text-[14px] font-semibold text-gray-700">자산 분류</span>
              <span className="text-right text-[13px] text-gray-500">{CATEGORIES.join(' · ')}</span>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-4">
              <span className="text-[14px] font-semibold text-gray-700">등락 색</span>
              <span className="text-right text-[13px] text-gray-500">
                국내 증시 관례대로 <span className="font-semibold text-up">상승 빨강</span> ·{' '}
                <span className="font-semibold text-down">하락 파랑</span>
              </span>
            </div>
          </div>
        </section>

        {/* 투자 판단에 쓰는 숫자를 보여주는 화면이므로, 어디까지 믿어도 되는지 분명히 적어둔다. */}
        <section>
          <div className="card border-l-[3px] border-warn px-6 py-5">
            <p className="text-[14px] font-bold text-gray-900">투자 판단에 쓰기 전에 알아두세요</p>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
              여기 숫자는 참고용이에요. 시세는 실시간이 아니라 몇 분 늦을 수 있고, 배당 지급일은 확정 공시가
              아니라 추정한 날짜예요. 실제 잔고와 수익률은 증권사 앱에서 다시 확인해 주세요.
            </p>
          </div>
        </section>

        <p className="px-1 text-center text-[12px] text-gray-400">
          홈 화면에 추가하면 앱처럼 열려요. 화면 오른쪽 위에서 라이트·다크 테마를 바꿀 수 있어요.
        </p>
      </main>
    </>
  );
}
