<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 집.zip — 프로젝트 인수인계 문서

> **새 PC / 새 세션에서 이어받는 경우 이 문서를 끝까지 읽으세요.**
> 대화 기록은 PC 간 동기화되지 않습니다. 이 문서가 대화록을 대신합니다.
>
> 최종 갱신: **2026-07-10** · 커밋 76개 · 배포: Vercel 자동

---

## 1. 개요

**zipzipworld.com** — 픽셀 지도 위의 칸("집")을 분양하는 디지털 부동산 서비스.
밀리언달러홈페이지 계열.

| 항목 | 값 |
|---|---|
| 격자 | **400 × 200 = 80,000칸** |
| 1칸 | **10 × 10 실제 픽셀** (CSS 5px × 레티나 2배) |
| 가격 | **1,000원 / 칸** (+ 이펙트 선택 시 1,000원) |
| 이용기간 | **영구** (만료·갱신 없음) ※ 기간제 아님 |
| 결제 | **포트원(PortOne) v2** — 카드 + 카카오페이 |

**스택:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase · Vercel
**레포:** `github.com/qasdx1212/TMDH` (브랜치 `master` → 푸시 시 자동 배포)
**사업자:** 스트릿애드(StreetAd) / 이승원 / 593-17-02833 / 0502-1946-1697

---

## 2. 현재 상태

### ✅ 완료
- **결제** — 포트원 v2 전면 이관. **테스트 모드로 실제 결제 성공 검증 완료**
- **보안** — 서버 금액 독립검증 / JWT 소유자 확인 / houses RLS(`auth.uid() = user_id`) / 관리자 서버 라우트 / 동시구매 race condition 방어
- **법적** — 결제 전 필수동의 3종, 사업자정보 표기(PG 심사 통과), 약관·개인정보·환불정책
- **UI** — 라이트 모던 미니멀 전면 리디자인
- **UX** — 모바일 반응형, 온보딩, 탭-탭 범위선택, 이미지 크롭, 임시저장

### ⏳ 진행 중 (외부 대기)
- **포트원 실연동 심사** — NHN KCP · 한국결제네트웍스 · 카카오페이 (현재 **테스트 키**)
- **통신판매업신고** — 등록면허세 납부 완료, 정부 승인 대기

---

## 3. 🔴 함정 — 모르면 사고 남

### ① 결제 금액은 클라·서버가 반드시 일치해야 함
서버(`/api/payment-complete`)가 금액을 **독립 계산해서 대조**합니다(위변조 방어).
가격 로직을 한쪽만 고치면 **"금액 불일치"로 결제가 전부 거부**됩니다.

- 상수: `src/lib/constants.ts` → `ZONE_PRICES`, `EFFECT_PRICES`
- 클라: `ApplyFlow.tsx` → `const price = calcTotalPrice(days) + effectPrice`
- 서버: `api/payment-complete/route.ts` → `calcPrice(...) + EFFECT_PRICES[...]`
- ✅ **이펙트 금액은 `EFFECT_PRICES`만 고치면 전체 반영됨** (그렇게 설계함)

### ② 격자 상수를 바꾸면 연쇄 수정 필요
`GRID_COLS=400`, `GRID_ROWS=200`. 바꾸면 아래를 전부:
- 주소 체계 `row * GRID_COLS + col` (하드코딩된 `* 400` grep 필수)
- `MapGrid.tsx`의 `CELL=5`, `RS=2`
- 미니맵 축척 2곳: `StatsPanel`(SX/SY), `ApplyFlow` Step1
- 총 칸수 표기: page / StatsPanel / admin / faq / terms / OG
- **`page.tsx`의 `.range(0, 79999)`** — Supabase 기본 1,000행 제한 회피용
- **DB 재시딩 필수** (houses에 모든 칸이 행으로 존재)

### ③ StatsPanel 높이 = `page.tsx`의 `STATS_H`
안 맞으면 지도와 겹침. 현재 **스탯 160 + 푸터 28 = `STATS_H = 188`**

### ④ 사업자정보 푸터 삭제 금지 (위법)
전자상거래법 제10조 필수 표기. **PG 심사가 이 정보를 크롤링해서 통과**했음.
접기(toggle)는 OK지만 **DOM에서 사라지면 안 됨** (`display:none` 금지, `visibility`로만 숨김).

### ⑤ globals.css가 `html, body { overflow: hidden }`
지도앱이라 body 스크롤을 막아둠. **내용 페이지는 반드시 자체 스크롤**
(`height:100vh; overflowY:auto`). `minHeight:100vh`로 만들면 **스크롤 불가**.

### ⑥ 지도 격자선은 디바이스 픽셀 정렬 필수
`ctx.scale()` 쓰지 말고 **1px 선 + 0.5 오프셋**으로 그릴 것.
안 그러면 안티에일리어싱으로 **화면 전체가 뿌옇게** 보임 (실제로 겪은 버그).

---

## 4. 아키텍처

### 결제 흐름
```
ApplyFlow → orders 테이블 insert(pending) → 포트원 결제창
  → /payment-redirect → /api/payment-complete (서버 검증)
  → houses UPDATE (입주 확정)
```
- **sessionStorage 안 씀** — 모바일 유실 방지 위해 `orders` 테이블 경유
- 동시구매 방어: `.eq('status','available')` 조건부 UPDATE

### 데이터
- **`houses` 테이블에 80,000행이 미리 시딩**돼 있음 (빈 칸도 `status='available'` 행)
- 이미지: 크롭 조정값을 **실제 이미지에 구워서** 업로드 → 미리보기 = 지도 = 저장본 일치

### 권한
- 관리자 = **`qasdx1212@gmail.com` 하드코딩**
- UI뿐 아니라 **서버(`/api/admin/vacate`)에서도 이메일 검증** → 개발자도구로 못 뚫음

---

## 5. 디자인 시스템 (라이트 모던 미니멀)

```
배경 #f4f3f1 · 카드/모달 #ffffff · 테두리 1px #e9e7e4 (강조 #e0ddd9)
텍스트 주 #1a1a1a · 보조 #6f6d6a · 흐림 #97948f · 본문 #575654
primary CTA #1c1c1e + 흰 텍스트 · secondary 흰 배경 + #e0ddd9 테두리
위험 #dc2626 · 성공 #16a34a
radius 카드 14 / 버튼·행 10 · 그림자 0 1px 3px rgba(0,0,0,0.05)
폰트 Pretendard (globals.css 전역)
선택 표시 = 채워진 라디오 원
금지: 그라데이션 · 3D그림자 · 이모지 UI아이콘 · 각진 모서리
```
지도 캔버스: 지형 `#eceae6` · 그리드 `#e0ddd9` (10칸마다 `#dcd8d2`) · 집 `#a1834a`

---

## 6. 🚧 남은 작업

### 🔴 치명적 — 오픈 전 반드시
**1. AI 콘텐츠 검사가 가짜**
`ApplyFlow.tsx:526`의 `await new Promise(r => setTimeout(r, 2500))` — **2.5초 기다렸다 무조건 통과.**
→ **음란물·불법광고가 무필터로 지도에 올라감.**

- 필요: `ANTHROPIC_API_KEY` → `/api/check-content` 라우트 → Claude Vision 검사
- **수정(`handleEditSave`) 시에도 재검사 필요** — 안 그러면 깨끗한 이미지로 통과 후 유해물로 교체 가능 (실제 뚫리는 구멍)
- 사후 대응(신고 → `/admin` 신고탭 → 강제퇴거)은 **이미 구현됨** → 법적 최소 요건은 충족

### 🟡 오픈 직전
2. **포트원 실키 전환** — Vercel env 3개 교체
   (`NEXT_PUBLIC_PORTONE_STORE_ID`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`, `PORTONE_V2_API_SECRET`)
   - ⚠️ **테스트 키인 동안 홍보 금지** (공짜 입주 가능)
   - ⚠️ `NEXT_PUBLIC_*`은 **빌드 타임에 박힘** → env 변경 시 **캐시 끄고 재배포** 필수
3. **통신판매업신고번호** — 승인되면 `terms`/`privacy`/StatsPanel 푸터의 "신고 중" 교체
4. **테스트모드 문구 제거** — `faq/page.tsx`, `my/payments/page.tsx`

### 🟢 오픈 후 (성능)
5. Realtime 이벤트마다 **전체 refetch + 전체 캔버스 재드로우** → 델타 업데이트로
6. 지도 이미지가 **원본 크기 그대로 로드** → Supabase transform 썸네일
7. StatsPanel이 `houses` 변경마다 **중복 DB 쿼리**
8. 이미지 캐시에 **LRU 없음** (메모리 무한 증가)

### 🔵 정책 결정 필요
9. **유해물 검열 범위 / 수정 허용 범위** (법 검토 필요)
10. 최소 구매 단위 (1칸이 작아 클릭 어려울 수 있음)
11. `constants.ts`의 **`DURATIONS`는 죽은 코드** — 기간제 도입 계획 없으면 삭제

---

## 7. 개발

```bash
npm run dev          # 로컬 (localhost:3000)
npx tsc --noEmit     # 타입체크 — 커밋 전 필수
npm run build        # 프로덕션 빌드 — 배포 전 필수
git push origin master   # → Vercel 자동 배포
```

**작업 규칙**
- 커밋 전 **`npx tsc --noEmit` + `npm run build`** 통과 확인
- 결제·격자·금액 수정 시 **§3 함정 재확인**
- 큰 작업 후 **이 문서의 §6(남은 작업) 갱신** ← 다음 사람을 위해

**새 PC 셋업:** `SETUP.md` 참고
