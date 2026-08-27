import type { MetadataRoute } from 'next';
import { SITE_URL } from './lib/site';

/**
 * /sitemap.xml — 색인해 달라고 내놓을 화면 목록.
 *
 * 로그인 없이 열리고 내용이 있는 화면만 싣는다. (`/login`, `/auth/callback`은 제외)
 * 화면이 늘면 여기에 경로를 추가한다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { path: '', priority: 1 },
    { path: '/allocation', priority: 0.8 },
    { path: '/dividend', priority: 0.8 },
    { path: '/about', priority: 0.6 },
  ].map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: 'weekly' as const,
    priority,
  }));
}
