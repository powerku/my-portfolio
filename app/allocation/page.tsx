import AllocationManager from '@/app/components/AllocationManager';
import { createClient } from '@/app/lib/supabase/server';

export const metadata = {
  title: '자산 구성 · 곳간',
  description: '분류별 자산 구성과 목표 비중을 한눈에',
};

/** 로그인 없이도 열린다. 비로그인이면 user가 null이고 데이터는 브라우저에서 읽는다. */
export default async function AllocationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <AllocationManager user={user ? { id: user.id, email: user.email ?? '' } : null} />;
}
