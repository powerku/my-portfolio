import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CATEGORY_COLORS, defaultAllocations, type AssetCategory } from '@/app/lib/portfolio';

/**
 * 공유 카드 이미지(1200×630). `/opengraph-image`와 `/twitter-image`가 같은 그림을 쓴다.
 *
 * Satori(next/og)는 flexbox와 CSS 일부만 안다. grid·float은 무시되고, 자식이 둘 이상인
 * 요소는 display를 직접 적어줘야 한다. 번들(JSX+폰트) 상한은 500KB다.
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = '곳간 — 내 자산과 배당을 한눈에';

/*
 * 카드에 박히는 문구. 폰트는 "이 파일에 있는 글자만" 담아 서브셋했으므로(assets/README.md),
 * 한글을 새로 추가하면 그 글자는 빈 네모로 나온다. 문구를 바꿨다면 폰트를 다시 구워야 한다.
 */
const TEXT = {
  wordmark: '곳간',
  headline: '내 자산과 배당을',
  headlineAccent: '한눈에',
  chips: ['포트폴리오', '자산 구성', '배당'],
  panelLabel: '자산 구성',
} as const;

const BRAND = '#3182f6';
const CANVAS = '#12161c';
const MUTED = '#8b95a1';

/**
 * 오른쪽 패널에 그릴 비중. 앱이 처음 보여주는 목표 비중을 그대로 쓴다.
 * 카드용으로 숫자를 따로 지어내면 실제 화면과 어긋나므로 출처를 하나로 둔다.
 */
const SLICES = Object.entries(defaultAllocations())
  .filter(([, pct]) => pct > 0)
  .sort(([, a], [, b]) => b - a) as [AssetCategory, number][];

/** 막대 전체 길이(px). 패널 안쪽 너비와 같아야 조각 합이 딱 맞는다. */
const BAR_WIDTH = 328;
const SLICE_TOTAL = SLICES.reduce((sum, [, pct]) => sum + pct, 0);

const fonts = await Promise.all(
  [
    ['Pretendard', 700, 'Pretendard-Bold.subset.otf'],
    ['Pretendard', 400, 'Pretendard-Regular.subset.otf'],
  ].map(async ([name, weight, file]) => ({
    name: name as string,
    weight: weight as 400 | 700,
    style: 'normal' as const,
    data: await readFile(join(process.cwd(), 'assets', file as string)),
  })),
);

/** app/icon.svg와 같은 도형. Satori는 외부 SVG를 못 읽어 div로 다시 그린다. */
function Logo() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        width: 88,
        height: 88,
        borderRadius: 28,
        backgroundColor: BRAND,
        paddingBottom: 27,
      }}
    >
      {[17, 33, 11].map((height, i) => (
        <div
          key={i}
          style={{
            width: 8,
            height,
            marginLeft: i === 0 ? 0 : 8,
            borderRadius: 999,
            backgroundColor: '#ffffff',
          }}
        />
      ))}
    </div>
  );
}

/** 분류별 비중을 한 줄 막대와 범례로. `/allocation` 화면을 줄여 놓은 모양이다. */
function AllocationPanel() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: 400,
        padding: 36,
        borderRadius: 32,
        border: '2px solid rgba(255,255,255,0.10)',
        backgroundColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 400, color: MUTED }}>{TEXT.panelLabel}</div>

      <div
        style={{
          display: 'flex',
          width: BAR_WIDTH,
          height: 18,
          marginTop: 22,
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        {SLICES.map(([category, pct]) => (
          <div
            key={category}
            style={{
              width: (pct / SLICE_TOTAL) * BAR_WIDTH,
              height: '100%',
              backgroundColor: CATEGORY_COLORS[category],
            }}
          />
        ))}
      </div>

      {SLICES.map(([category, pct]) => (
        <div
          key={category}
          style={{ display: 'flex', alignItems: 'center', width: BAR_WIDTH, marginTop: 20 }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              backgroundColor: CATEGORY_COLORS[category],
            }}
          />
          <div style={{ marginLeft: 14, fontSize: 27, fontWeight: 400, color: '#c5ccd4' }}>
            {category}
          </div>
          {/* 남는 자리를 밀어내 퍼센트를 오른쪽 끝에 붙인다. */}
          <div style={{ display: 'flex', flexGrow: 1 }} />
          {/* 숫자와 '%'를 따로 두면 텍스트 노드가 둘이 돼 Satori가 display:flex를 요구한다. */}
          <div style={{ fontSize: 27, fontWeight: 700, color: '#ffffff' }}>
            {`${Math.round(pct)}%`}
          </div>
        </div>
      ))}
    </div>
  );
}

export function card() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          padding: 80,
          backgroundColor: CANVAS,
          // 왼쪽 위에서 번지는 브랜드색 빛. 평평한 단색 배경보다 덜 심심하다.
          backgroundImage:
            // 스톱을 촘촘히 두지 않으면 알파가 0으로 떨어지는 자리에 호 모양 경계선이 드러난다.
            'radial-gradient(1400px 1100px at 2% -30%, rgba(49,130,246,0.30) 0%, rgba(49,130,246,0.20) 22%, rgba(49,130,246,0.11) 42%, rgba(49,130,246,0.05) 62%, rgba(49,130,246,0.015) 80%, rgba(49,130,246,0) 100%)',
          fontFamily: 'Pretendard',
          color: '#ffffff',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexGrow: 1,
            height: '100%',
            paddingRight: 56,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Logo />
            <div style={{ marginLeft: 26, fontSize: 60, fontWeight: 700, letterSpacing: -2 }}>
              {TEXT.wordmark}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -3, lineHeight: 1.2 }}>
              {TEXT.headline}
            </div>
            <div
              style={{
                fontSize: 72,
                fontWeight: 700,
                letterSpacing: -3,
                lineHeight: 1.2,
                color: '#6ba6ff',
              }}
            >
              {TEXT.headlineAccent}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            {TEXT.chips.map((chip, i) => (
              <div
                key={chip}
                style={{
                  display: 'flex',
                  marginLeft: i === 0 ? 0 : 14,
                  padding: '14px 26px',
                  borderRadius: 999,
                  border: '2px solid rgba(255,255,255,0.16)',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  fontSize: 30,
                  fontWeight: 400,
                  color: '#c5ccd4',
                }}
              >
                {chip}
              </div>
            ))}
          </div>
        </div>

        <AllocationPanel />
      </div>
    ),
    { ...size, fonts },
  );
}
