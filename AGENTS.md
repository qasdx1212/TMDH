<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 집.zip (zipzipworld.com) — 프로젝트 컨텍스트

> **다른 PC에서 이어받는 경우 이 문서를 먼저 끝까지 읽으세요.**
> 진행 상황·결정사항·함정이 전부 여기 있습니다. 최종 갱신: 2026-07-10

## 개요
200×100 → **400×200 격자(80,000칸)** 픽셀 지도 위에 "집"(디지털 공간)을 분양하는 서비스.
밀리언달러홈페이지 계열. **1칸 = 10×10 실제픽셀 = 1,000원.**

- 스택: Next.js 16 (App Router) · React 19 · TypeScript · Supabase · **포트원(PortOne) v2 결제**
- 배포: Vercel (`master` 푸시 → 자동 배포). 원격: `github.com/qasdx1212/TMDH`
- 운영: 스트릿애드(StreetAd) / 대표 이승원 / 사업자 593-17-02833

## 현재 상태 (2026-07-10)
- ✅ 결제(포트원 v2) — **테스트 모드로 실제 동작 검증 완료**
- ✅ 보안 — 서버 금액 독립검증, JWT 소유자 확인, houses RLS(`auth.uid() = user_id`), admin 서버 라우트
- ✅ UI — 라이트 모던 미니멀로 전면 리디자인 완료
- ⏳ **오픈 전 남은 것**: 아래 "미해결" 참조

---

## 🔴 절대 잊으면 안 되는 함정

### 1. 결제 금액은 3곳이 반드시 일치해야 함
서버(`/api/payment-complete`)가 금액을 **독립 계산해서 대조**합니다(위변조 방어). 가격 로직을 바꾸면 **클라·서버 양쪽 다** 고쳐야 합니다. 안 그러면 "금액 불일치"로 **결제가 전부 거부**됩니다.

- 가격 상수: `src/lib/constants.ts` — `ZONE_PRICES`, `EFFECT_PRICES`, `DURATIONS`
- 클라: `ApplyFlow.tsx`의 `const price = calcTotalPrice(days) + effectPrice`
- 서버: `api/payment-complete/route.ts`의 `expectedAmount = calcPrice(...) + EFFECT_PRICES[...]`
- **이펙트 금액 바꿀 땐 `EFFECT_PRICES`만 고치면 전체 반영됨** (설계상 그렇게 해둠)

### 2. 격자 상수를 바꾸면 연쇄 수정 필요
`GRID_COLS=400`, `GRID_ROWS=200` (constants.ts). 바꾸면:
- 주소 체계 `row * GRID_COLS + col` (하드코딩된 `* 400` 있는지 grep 필수)
- `MapGrid.tsx`의 `CELL=5`, `RS=2` (1칸 = 5 CSS px × 2 = 10 실제픽셀)
- 미니맵 축척 2곳: `StatsPanel`(SX/SY), `ApplyFlow` Step1
- 총 칸수 표기: page/StatsPanel/admin/faq/terms/OG
- **`page.tsx`의 `.range(0, 79999)`** — Supabase 기본 1,000행 제한 회피용. 칸수 늘리면 같이 올려야 함
- **DB 재시딩 필수** (houses 테이블에 모든 칸이 행으로 존재)

### 3. StatsPanel 높이 = `page.tsx`의 `STATS_H`와 반드시 일치
안 맞으면 지도랑 겹치거나 빈 공간 생김. 현재 스탯 160 + 푸터 28 = **`STATS_H = 188`**

### 4. 사업자정보 푸터 삭제 금지 (위법)
전자상거래법 제10조 필수 표기. PG 심사도 이 정보를 **크롤링**해서 통과했음. 접기(toggle)는 OK지만 **DOM에서 사라지면 안 됨**.

### 5. globals.css가 `html, body { overflow: hidden }`
지도앱이라 body 스크롤을 막아둠. 따라서 **내용 페이지는 반드시 자체 스크롤**(`height:100vh; overflowY:auto`)이어야 함. `minHeight:100vh`로 만들면 **스크롤이 안 됨**.

---

## 아키텍처 요점

- **`houses` 테이블에 80,000행이 미리 시딩**돼 있음 (빈 칸도 `status='available'` 행으로 존재)
- 결제 흐름: `ApplyFlow` → `orders` 테이블 insert(pending) → 포트원 결제창 → `/payment-redirect` → `/api/payment-complete`(서버검증) → houses UPDATE(입주)
  - **sessionStorage 안 씀** (모바일 유실 방지 위해 `orders` 테이블 경유)
  - 동시구매 방어: `.eq('status','available')` 조건부 UPDATE
- 이미지: 업로드 시 **크롭 조정값을 실제 이미지에 구워서** 저장 (미리보기 = 지도 = 저장본 일치)
- 관리자: `qasdx1212@gmail.com` 하드코딩. **UI뿐 아니라 서버(`/api/admin/vacate`)에서도 이메일 검증**

## 디자인 시스템 (라이트 모던 미니멀)
```
배경 #f4f3f1 · 카드/모달 #ffffff · 테두리 1px #e9e7e4 (강조 #e0ddd9)
텍스트 주 #1a1a1a · 보조 #6f6d6a · 흐림 #97948f · 본문 #575654
primary CTA #1c1c1e + 흰 텍스트 · secondary 흰 배경 + #e0ddd9 테두리
위험 #dc2626 · 성공 #16a34a
radius 카드 14 / 버튼·행 10 · 그림자 0 1px 3px rgba(0,0,0,0.05)
폰트 Pretendard (globals.css 전역)
선택 표시 = 채워진 라디오 원 (체크/X 아님)
금지: 그라데이션 · 3D그림자 · 이모지 UI아이콘 · 각진 모서리
```
지도 캔버스: 지형 `#eceae6`, 그리드 `#e0ddd9`(10칸마다 대격자 `#dcd8d2`), 집 `#a1834a`
※ 격자선은 **디바이스 픽셀 정렬**(1px + 0.5 오프셋) 필수 — 안 그러면 화면이 뿌옇게 보임

---

## 🚧 미해결 (오픈 전 처리)

### 치명적
1. **AI 콘텐츠 검사가 가짜** — `ApplyFlow.tsx`의 `setTimeout(2500)` 시뮬레이션. **음란물·불법광고가 무필터로 통과함.**
   - 필요: `ANTHROPIC_API_KEY` → `/api/check-content` 라우트 → Claude Vision 검사
   - **수정(handleEditSave) 시에도 재검사 필요** — 안 그러면 깨끗한 이미지로 통과 후 유해물로 교체 가능
   - 사후 대응(신고 → `/admin` 신고탭 → 강제퇴거)은 **이미 구현됨** (법적 최소 요건은 충족)

### 오픈 직전
2. **포트원 실연동 전환** — 현재 **테스트 키**. 실키로 바꿔야 실제 결제됨.
   - Vercel env 3개: `NEXT_PUBLIC_PORTONE_STORE_ID`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`, `PORTONE_V2_API_SECRET`
   - ⚠️ **테스트 키인 동안 홍보 금지** (공짜 입주 가능)
   - 실연동 PG 심사 진행 중: NHN KCP · 한국결제네트웍스 · 카카오페이
   - `NEXT_PUBLIC_*`은 **빌드 타임에 박힘** → env 바꾸면 **캐시 없이 재배포** 필수
3. **통신판매업신고번호** — 정부 승인 대기 중. 나오면 `terms`/`privacy`/StatsPanel 푸터의 "신고 중" 교체
4. **테스트모드 문구 제거** — `faq/page.tsx`, `my/payments/page.tsx`에 "테스트 모드" 안내 있음

### 성능 (오픈 후 가능)
5. Realtime 이벤트마다 **전체 refetch + 전체 캔버스 재드로우** → 델타 업데이트로
6. 지도 이미지가 **원본 크기 그대로 로드** → Supabase transform으로 썸네일화
7. StatsPanel이 `houses` 바뀔 때마다 **중복 DB 쿼리**
8. 이미지 캐시에 **LRU 없음** (메모리 무한 증가)

### 정책 결정 필요
9. 유해물 검열 범위 / 수정 허용 범위 (법 검토 필요)
10. 최소 구매 단위 (1칸이 작아서 클릭 어려울 수 있음)

---

## 개발 명령
```bash
npm run dev          # 로컬 개발
npx tsc --noEmit     # 타입체크 (커밋 전 필수)
npm run build        # 프로덕션 빌드 (배포 전 확인)
```

## 작업 규칙
- 커밋 전 **반드시 `npx tsc --noEmit` + `npm run build`** 통과 확인
- `master`에 푸시하면 Vercel 자동 배포
- 결제·격자·금액 관련 수정 시 **위 "함정" 섹션 재확인**
