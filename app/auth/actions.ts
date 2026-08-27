'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase/server';

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  // 비로그인 상태로도 화면을 쓸 수 있으므로 홈으로 돌려보낸다.
  redirect('/');
}
