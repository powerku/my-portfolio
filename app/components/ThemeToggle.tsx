'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  DARK_MEDIA_QUERY,
  type ThemePreference,
  applyTheme,
  readStoredPreference,
  resolveTheme,
  serverPreference,
  setStoredPreference,
  subscribeToPreference,
  systemTheme,
} from '@/app/lib/theme';

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M9 20h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" aria-hidden="true">
      <path
        d="M20 14.2A8.2 8.2 0 019.8 4a8.5 8.5 0 1010.2 10.2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: 'system', label: '시스템 설정', icon: <MonitorIcon /> },
  { value: 'light', label: '라이트 모드', icon: <SunIcon /> },
  { value: 'dark', label: '다크 모드', icon: <MoonIcon /> },
];

/**
 * 시스템 / 라이트 / 다크 3단 토글.
 *
 * 화면 색 자체는 head 인라인 스크립트가 첫 페인트 전에 이미 맞춰둔다. 이 컴포넌트는
 * 어느 칸이 켜져 있는지 보여주고, 눌렀을 때 선택을 바꾸는 역할만 한다.
 */
export default function ThemeToggle() {
  const preference = useSyncExternalStore(
    subscribeToPreference,
    readStoredPreference,
    serverPreference,
  );

  // 선택이 바뀌면 DOM에 반영하고, 시스템을 따르는 동안에는 OS 설정 변경도 따라간다.
  useEffect(() => {
    applyTheme(resolveTheme(preference));
    if (preference !== 'system') return;

    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const sync = () => applyTheme(systemTheme());
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [preference]);

  return (
    <div
      role="group"
      aria-label="화면 테마"
      className="flex shrink-0 gap-0.5 rounded-[10px] bg-gray-100 p-0.5"
    >
      {OPTIONS.map((option) => {
        const isActive = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setStoredPreference(option.value)}
            aria-pressed={isActive}
            title={option.label}
            className={`flex h-6 w-[26px] items-center justify-center rounded-lg transition-colors ${
              isActive
                ? 'bg-raised text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <span className="sr-only">{option.label}</span>
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}
