import { redirect } from 'next/navigation';
import AssetManager from './components/AssetManager';
import { createClient } from './lib/supabase/server';

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return <AssetManager userId={user.id} userEmail={user.email ?? ''} />;
}
