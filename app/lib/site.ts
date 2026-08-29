/**
 * 사이트의 공개 주소. 검색엔진에 넘기는 절대 URL(사이트맵·canonical·og)의 기준이다.
 *
 * 배포 도메인은 코드가 알 수 없으므로 환경 변수에서 읽는다.
 * - `NEXT_PUBLIC_SITE_URL`: 직접 연결한 도메인이 있으면 여기에 적는다. (예: https://gotgan.app)
 * - `VERCEL_PROJECT_PRODUCTION_URL`: Vercel이 프로덕션 도메인을 알아서 넣어준다. (스킴은 빠져 있다)
 *
 * 둘 다 없으면 개발용 localhost로 떨어진다. 이 상태로 배포하면 사이트맵에 localhost가
 * 실려 색인이 안 되므로, 배포처에는 위 둘 중 하나가 반드시 있어야 한다.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}

export const SITE_URL = resolveSiteUrl();

/**
 * 로그인 링크(매직 링크)가 돌아올 주소의 기준.
 *
 * - 배포: `NEXT_PUBLIC_SITE_URL`에 적어둔 도메인으로 고정한다.
 *   (프리뷰 배포에서 눌러도 항상 연결한 도메인으로 착지한다)
 * - 로컬: 그 값이 없으므로 지금 열어둔 주소(http://localhost:3000)를 그대로 쓴다.
 *
 * `SITE_URL`과 나눠 둔 이유는 클라이언트 때문이다. `VERCEL_PROJECT_PRODUCTION_URL`은
 * NEXT_PUBLIC_ 접두사가 없어 브라우저 번들에 들어가지 않으므로, 브라우저에서는
 * 그 값에 기대지 않고 현재 주소로 떨어져야 한다.
 */
export function authOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  if (typeof window !== 'undefined') return window.location.origin;

  return SITE_URL;
}
