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
