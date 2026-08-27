import type { MetadataRoute } from 'next';
import { THEME_COLORS } from './lib/theme';

/**
 * 홈 화면에 설치했을 때 쓰이는 앱 정보. (/manifest.webmanifest 로 나간다)
 *
 * 아이콘 PNG는 app/icon.svg 와 같은 도형을 크기별로 구운 것이다. 로고를 바꾸면
 * public/icon-*.png 와 app/apple-icon.png 도 함께 다시 만들어야 한다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: '곳간',
    // 홈 화면 아이콘 밑에 붙는 이름. 길면 잘리므로 12자 안쪽으로 둔다.
    short_name: '곳간',
    description: '내 자산과 배당을 한눈에 관리하는 포트폴리오',
    lang: 'ko',
    start_url: '/',
    scope: '/',
    // 주소창 없이 앱처럼 연다. 가로 표(lg 레이아웃)가 있으므로 방향은 고정하지 않는다.
    display: 'standalone',
    /*
     * 시작 화면 색. 매니페스트는 라이트/다크를 나눠 적을 수 없어 라이트 바닥색으로 둔다.
     * 화면이 뜬 뒤의 상태 표시줄 색은 layout.tsx의 theme-color가 테마에 맞춰 덮어쓴다.
     */
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    categories: ['finance', 'productivity'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        /*
         * 안드로이드 런처는 아이콘을 원·사각형 등 제 모양대로 잘라낸다.
         * 잘려도 되도록 여백을 둔 판을 따로 준다. (모서리를 깎지 않은 꽉 찬 사각형)
         */
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    // 홈 화면 아이콘을 길게 눌렀을 때 나오는 바로가기
    shortcuts: [
      {
        name: '배당',
        short_name: '배당',
        description: '받을 배당금과 배당락일 보기',
        url: '/dividend',
      },
    ],
  };
}
