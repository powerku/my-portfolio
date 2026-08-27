import DividendManager from '@/app/components/DividendManager';
import { createClient } from '@/app/lib/supabase/server';

export const metadata = {
  title: '배당 · 내 포트폴리오',
  description: '보유 종목에서 받을 배당금과 배당락일을 한눈에',
};

/** 로그인 없이도 열린다. 비로그인이면 user가 null이고 데이터는 브라우저에서 읽는다. */
export default async function DividendPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <DividendManager user={user ? { id: user.id, email: user.email ?? '' } : null} />;
}
