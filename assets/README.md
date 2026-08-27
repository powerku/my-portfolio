# assets

공유 카드 이미지(`app/og/card.tsx`)를 그릴 때 쓰는 폰트입니다. 앱 화면은 CDN에서
Pretendard를 받아 쓰지만(`app/layout.tsx`), 카드 이미지는 서버에서 PNG로 구워지므로
폰트 파일이 저장소 안에 있어야 합니다.

## 폰트

- **Pretendard** v1.3.9 — [orioncactus/pretendard](https://github.com/orioncactus/pretendard)
- 라이선스: SIL Open Font License 1.1 ([`Pretendard-OFL.txt`](Pretendard-OFL.txt))

원본은 굵기당 1.5MB입니다. `next/og`의 번들 상한이 **500KB**(JSX + 폰트 + 이미지 전부 합쳐서)
이므로, 카드에 실제로 쓰는 글자만 남기고 잘라낸 서브셋을 담아 뒀습니다 (굵기당 약 31KB).

## 서브셋 다시 굽기

**카드 문구에 한글을 새로 추가하면 그 글자는 빈 네모로 나옵니다.** 아래를 다시 실행하세요.
서브셋 대상은 `app/og/card.tsx`와 `app/lib/portfolio.ts`에 등장하는 모든 한글입니다.
(카드 오른쪽 패널이 `portfolio.ts`의 분류 이름을 그대로 그리므로 두 파일을 함께 훑습니다)

```bash
pip install fonttools                     # pyftsubset 제공

for W in Bold Regular; do
  curl -sSL -o "/tmp/Pretendard-$W.otf" \
    "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-$W.otf"
done

# 카드에 등장할 수 있는 한글을 그대로 뽑아 쓴다
python3 -c "
import pathlib
chars = set()
for f in ['app/og/card.tsx', 'app/lib/portfolio.ts']:
    chars |= {c for c in pathlib.Path(f).read_text() if '가' <= c <= '힣'}
pathlib.Path('/tmp/og-chars.txt').write_text(''.join(sorted(chars)))
"

for W in Bold Regular; do
  pyftsubset "/tmp/Pretendard-$W.otf" \
    --text-file=/tmp/og-chars.txt \
    --unicodes="U+0020-007E,U+00B7,U+2013-2014,U+2018-201D,U+2026,U+20A9" \
    --layout-features='' --no-hinting --desubroutinize \
    --output-file="assets/Pretendard-$W.subset.otf"
done
```

바꾼 뒤에는 `npm run build`로 카드가 제대로 구워지는지 확인하세요.
빌드 결과는 `.next/server/app/opengraph-image.png.body`에 PNG로 떨어집니다.
