import { AllocationSkeleton, HeaderSkeleton } from '@/app/components/Skeleton';

/** 자산 구성 화면의 라우트 전환 중 화면. app/loading.tsx와 같은 이유로 상단 바도 함께 그린다. */
export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <AllocationSkeleton />
    </>
  );
}
