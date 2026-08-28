import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SITE_URL } from "./lib/site";
import { THEME_COLORS, THEME_INIT_SCRIPT } from "./lib/theme";
import "./globals.css";

const DESCRIPTION =
  "보유 종목의 현재가·평가금액·수익률과 목표 비중, 배당을 한눈에 관리하는 무료 포트폴리오 앱. 로그인 없이 바로 쓸 수 있어요.";

export const metadata: Metadata = {
  // 상대 경로로 적은 canonical·og:image를 절대 URL로 펴는 기준. 없으면 색인이 어긋난다.
  metadataBase: new URL(SITE_URL),
  title: "곳간 — 내 자산 포트폴리오",
  description: DESCRIPTION,
  applicationName: "곳간",
  keywords: ["포트폴리오", "자산관리", "배당", "자산 비중", "리밸런싱", "주식 수익률"],
  // 하위 화면은 각자 canonical을 덮어쓴다. (app/*/page.tsx)
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "곳간",
    locale: "ko_KR",
    url: "/",
    title: "곳간 — 내 자산 포트폴리오",
    description: DESCRIPTION,
    // 이미지는 app/opengraph-image.tsx가 넣는다.
  },
  // 카톡·슬랙은 og만 보지만, X는 큰 카드로 띄우려면 이 선언이 필요하다.
  twitter: { card: "summary_large_image" },
  /*
   * Search Console에서 "HTML 태그" 방식으로 소유를 확인할 때 쓴다.
   * 대시보드가 준 content 값을 GOOGLE_SITE_VERIFICATION 환경 변수에 넣으면 meta가 붙는다.
   * (도메인을 직접 소유했다면 DNS 확인이 더 편하고, 그 경우 이 변수는 비워도 된다)
   */
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
  // 매니페스트(app/manifest.ts) 링크는 Next가 알아서 넣는다. 여기는 iOS 몫이다.
  appleWebApp: {
    capable: true,
    // 홈 화면 아이콘 아래 이름. 없으면 페이지 제목이 그대로 들어가 길어진다.
    title: "곳간",
    /*
     * default를 쓰면 iOS가 theme-color를 상태 표시줄 색으로 삼는다.
     * theme-color는 테마 전환 때 함께 바뀌므로(app/lib/theme.ts) 다크에서도 어긋나지 않는다.
     */
    statusBarStyle: "default",
  },
  // 금액·수량이 전화번호로 잡혀 파란 링크가 되는 것을 막는다. (iOS Safari)
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /* data-theme은 아래 스크립트가 넣으므로 서버 HTML과 다를 수 있다. */
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* 첫 페인트 전에 테마를 확정해 흰 화면 번쩍임을 막는다. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Pretendard: 한글 자간/굵기가 토스·뱅크샐러드 UI와 가장 가까운 웹폰트 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        {/* Vercel 대시보드에서 방문·유입 경로를 본다. 배포 환경에서만 스크립트가 붙는다. */}
        <Analytics />
        {/* 실사용자 Core Web Vitals(LCP·INP·CLS)를 수집한다. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
