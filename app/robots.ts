import type { MetadataRoute } from 'next';
import { SITE_URL } from './lib/site';

/**
 * /robots.txt — 크롤러에게 어디를 훑어도 되는지 알려준다.
 *
 * 로그인·인증 착지 경로는 색인할 내용이 없고(로그인한 사용자는 프록시가 `/`로 돌려보낸다),
 * `/api/*`는 야후 시세 JSON만 내보내므로 모두 제외한다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/login', '/auth/', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
