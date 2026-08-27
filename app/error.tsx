'use client';

import { useEffect } from 'react';
import ErrorScreen from '@/app/components/ErrorScreen';

/**
 * 포트폴리오 화면(과 아래에 자기 error 파일이 없는 화면들)의 오류 경계.
 *
 * page.tsx는 서버에서 로그인 정보를 확인한다. Supabase에 닿지 못하거나 응답이 깨지면
 * 이 파일이 대신 그려진다. 자산은 서버(또는 브라우저)에 그대로 남아 있으므로,
 * 다시 시도하면 대개 그대로 이어진다.
 *
 * 오류 경계는 클라이언트 컴포넌트여야 하고, 같은 단계의 layout.tsx는 감싸지 않는다.
 * (레이아웃까지 무너진 경우는 global-error.tsx가 받는다)
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // 서버 오류는 브라우저에 메시지가 오지 않는다. 이 로그의 digest로 서버 로그와 맞춘다.
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen
      title="포트폴리오를 불러오지 못했어요"
      description="잠깐 문제가 생겼어요. 저장된 자산은 그대로 있으니 다시 시도해 주세요."
      digest={error.digest}
      onRetry={retry}
    />
  );
}
