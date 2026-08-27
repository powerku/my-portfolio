import AssetManager from './components/AssetManager';
import { createClient } from './lib/supabase/server';

/** 로그인 없이도 열린다. 비로그인이면 user가 null이고 데이터는 브라우저에 담긴다. */
export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <AssetManager user={user ? { id: user.id, email: user.email ?? '' } : null} />;
}
