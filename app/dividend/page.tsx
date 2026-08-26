import { redirect } from 'next/navigation';
import DividendManager from '@/app/components/DividendManager';
import { createClient } from '@/app/lib/supabase/server';

export const metadata = {
  title: '배당 · 내 포트폴리오',
  description: '보유 종목에서 받을 배당금과 배당락일을 한눈에',
};

export default async function DividendPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/dividend');

  return <DividendManager userId={user.id} userEmail={user.email ?? ''} />;
}
