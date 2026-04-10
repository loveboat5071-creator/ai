'use client';

import { FormEvent, Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageShell />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => {
    const target = searchParams?.get('next') || '/';
    return target.startsWith('/') ? target : '/';
  }, [searchParams]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        setError(data?.error || '로그인에 실패했습니다.');
        return;
      }

      router.replace(next);
      router.refresh();
    } catch (submitError) {
      setError(`로그인 처리에 실패했습니다: ${submitError}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LoginPageShell>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700" htmlFor="username">
            아이디
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-blue-500 focus:bg-white"
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700" htmlFor="password">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-blue-500 focus:bg-white"
            autoComplete="current-password"
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </LoginPageShell>
  );
}

function LoginPageShell({ children }: { children?: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-8">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
              WS MEDIA
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950">
              로그인
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              등록된 계정으로 로그인 후 대시보드에 진입합니다.
            </p>
          </div>

          {children}
        </section>
      </div>
    </main>
  );
}
