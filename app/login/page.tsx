import LoginForm from './LoginForm';

export const metadata = {
  title: '로그인 · 내 포트폴리오',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const error = typeof params.error === 'string' ? params.error : null;
  const next = typeof params.next === 'string' ? params.next : undefined;

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="flex-1 flex flex-col justify-center px-6 py-14">
        <div className="w-full max-w-[400px] mx-auto">
          <div className="w-14 h-14 rounded-[18px] bg-brand flex items-center justify-center shadow-[0_8px_20px_rgba(49,130,246,0.28)]">
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" aria-hidden="true">
              <path d="M4 17V10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M10 17V6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M16 17v-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
              <path d="M20.5 4.5L14 11l-3-3-5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
            </svg>
          </div>

          <h1 className="mt-7 text-[30px] font-bold leading-[1.35] text-gray-900">
            흩어진 내 자산을
            <br />
            한 화면에서 관리해요
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-gray-600">
            이메일만 입력하면 끝. 비밀번호 없이 로그인해요.
          </p>

          {error && (
            <div className="mt-7 flex items-start gap-2 rounded-2xl bg-up-soft px-4 py-3 text-[14px] font-medium text-up">
              <span aria-hidden="true">!</span>
              <span>{error}</span>
            </div>
          )}

          <div className="mt-9">
            <LoginForm next={next} />
          </div>
        </div>
      </div>

      <p className="px-6 pb-10 text-center text-[12px] text-gray-400">
        로그인하면 서비스 이용약관과 개인정보 처리방침에 동의하게 돼요.
      </p>
    </div>
  );
}
