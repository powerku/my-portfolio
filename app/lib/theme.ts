/**
 * 화면 테마(시스템/라이트/다크).
 *
 * 저장하는 값은 사용자의 '선택'(system 포함)이고, `<html data-theme>` 에 넣는 값은
 * 그 선택을 지금 화면에 적용한 '결과'(light 또는 dark)다. 둘을 섞으면 OS 설정을
 * 바꿨을 때 따라가야 하는지를 알 수 없게 된다.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'portfolio:theme';

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/** 모바일 브라우저 주소창 색. globals.css의 --color-canvas와 같은 값이어야 한다. */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#f2f4f6',
  dark: '#12161c',
};

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** 저장된 선택. 없거나 망가진 값이면 시스템 설정을 따른다. */
export function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    // 사파리 프라이빗 모드 등에서 localStorage 접근 자체가 던진다.
    return 'system';
  }
}

/** 서버 렌더 시점에는 선택을 알 수 없다. 하이드레이션 후 실제 값으로 한 번 다시 그려진다. */
export function serverPreference(): ThemePreference {
  return 'system';
}

/**
 * 선택값은 리액트 밖(localStorage)에 있어 외부 저장소로 구독한다.
 * `storage` 이벤트는 다른 탭의 변경만 알려주므로, 이 탭의 변경은 직접 알린다.
 */
const listeners = new Set<() => void>();

export function subscribeToPreference(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function setStoredPreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // 저장을 못 해도 이번 세션 동안은 정상 동작한다.
  }
  listeners.forEach((listener) => listener());
}

export function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

/** 실제로 화면에 반영한다. CSS는 data-theme 하나만 본다. */
export function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved;

  // viewport.themeColor가 media별로 두 개를 심어두므로 둘 다 지금 색으로 맞춘다.
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => {
      meta.content = THEME_COLORS[resolved];
    });
}

/**
 * 첫 페인트 전에 head에서 동기로 실행되는 스크립트. 이게 없으면 다크를 고른 사용자에게
 * 흰 화면이 한 번 번쩍인다. 리액트가 붙기 전이라 이 파일의 함수를 쓸 수 없어 최소한으로 다시 쓴다.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(p!=="light"&&p!=="dark"){p=window.matchMedia(${JSON.stringify(
  DARK_MEDIA_QUERY,
)}).matches?"dark":"light"}document.documentElement.dataset.theme=p}catch(e){}})()`;
