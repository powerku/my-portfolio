'use client';

import { useEffect } from 'react';
import ErrorScreen from '@/app/components/ErrorScreen';

/** 배당 화면의 오류 경계. 문구만 다르고 하는 일은 app/error.tsx와 같다. */
export default function DividendError({
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
    <ErrorScreen
      title="배당 화면을 불러오지 못했어요"
      description="잠깐 문제가 생겼어요. 다시 시도하거나 포트폴리오 화면으로 돌아가 주세요."
      digest={error.digest}
      onRetry={retry}
    />
  );
}
