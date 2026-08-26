import LoginForm from './LoginForm';

export const metadata = {
  title: '로그인 · 내 포트폴리오',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const error = typeof params.error === 'string' ? params.error : null;
  const next = typeof params.next === 'string' ? params.next : undefined;

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">내 포트폴리오</h1>
          <p className="text-sm text-gray-500">로그인하고 어디서든 자산을 확인하세요.</p>
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
        <div className="rounded-xl border p-6">
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
