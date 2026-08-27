'use client';

import { useEffect } from 'react';
import { THEME_INIT_SCRIPT } from '@/app/lib/theme';

/**
 * 마지막 안전망. 루트 레이아웃(app/layout.tsx) 자체가 그려지지 못했을 때만 쓰인다.
 *
 * 이 파일은 레이아웃을 대신하므로 html·body를 직접 그려야 하고, globals.css도 폰트도
 * 딸려오지 않는다. 그래서 색과 여백을 여기 안에 다시 적는다. 값은 globals.css의 팔레트와
 * 같고, 테마는 layout.tsx와 같은 스크립트로 첫 페인트 전에 정한다.
 *
 * 클라이언트 컴포넌트라서 metadata를 쓸 수 없다. 제목은 <title>로 직접 넣는다.
 */
const STYLES = `
  :root {
    --canvas: #f2f4f6;
    --surface: #ffffff;
    --text: #191f28;
    --muted: #6b7684;
    --brand: #3182f6;
    --up: #f04452;
    --up-soft: #fff0f2;
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.04);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --canvas: #12161c;
      --surface: #1b2029;
      --text: #f2f5f8;
      --muted: #a7b0bb;
      --brand: #4d9bff;
      --up: #ff5c6a;
      --up-soft: #33191f;
      --shadow: inset 0 0 0 1px rgb(255 255 255 / 0.05), 0 4px 16px rgb(0 0 0 / 0.4);
    }
  }
  :root[data-theme="dark"] {
    --canvas: #12161c;
    --surface: #1b2029;
    --text: #f2f5f8;
    --muted: #a7b0bb;
    --brand: #4d9bff;
    --up: #ff5c6a;
    --up-soft: #33191f;
    --shadow: inset 0 0 0 1px rgb(255 255 255 / 0.05), 0 4px 16px rgb(0 0 0 / 0.4);
  }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--canvas);
    color: var(--text);
    font-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont,
      "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    width: 100%;
    max-width: 420px;
    box-sizing: border-box;
    padding: 32px 24px;
    border-radius: 20px;
    background: var(--surface);
    box-shadow: var(--shadow);
    text-align: center;
  }
  .mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    margin: 0 auto;
    border-radius: 16px;
    background: var(--up-soft);
    color: var(--up);
    font-size: 22px;
    font-weight: 700;
  }
  h1 { margin: 20px 0 0; font-size: 20px; font-weight: 700; }
  p { margin: 8px 0 0; font-size: 15px; line-height: 1.6; color: var(--muted); }
  button {
    width: 100%;
    height: 48px;
    margin-top: 28px;
    border: 0;
    border-radius: 14px;
    background: var(--brand);
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
  }
  .digest { margin-top: 20px; font-size: 12px; color: var(--muted); opacity: 0.8; }
`;

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <title>오류 · 곳간</title>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      </head>
      <body>
        <div className="card">
          <span className="mark" aria-hidden="true">
            !
          </span>
          <h1>화면을 여는 중 문제가 생겼어요</h1>
          <p>잠시 후 다시 시도해 주세요. 저장된 자산은 그대로 있어요.</p>
          <button type="button" onClick={() => retry()}>
            다시 시도
          </button>
          {error.digest && <p className="digest">오류 코드: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
