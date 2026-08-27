import type { Metadata, Viewport } from "next";
import { THEME_COLORS, THEME_INIT_SCRIPT } from "./lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "곳간",
  description: "내 자산을 한눈에 관리하는 포트폴리오",
  applicationName: "곳간",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
