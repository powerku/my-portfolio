import { HeaderSkeleton, PortfolioSkeleton } from '@/app/components/Skeleton';

/**
 * 라우트 전환 중 화면. 페이지가 서버에서 로그인 정보를 확인하는 동안 보인다.
 * 이 시점에는 로그인 여부를 몰라서 상단 바까지 스켈레톤으로 그린다.
 */
export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <PortfolioSkeleton />
    </>
  );
}
