# 집.zip (zipzipworld.com)

400×200 격자(**80,000칸**) 픽셀 지도 위에 자신만의 디지털 공간("집")을 분양받는 서비스.
밀리언달러홈페이지에서 영감을 받은 한국형 디지털 부동산 플랫폼.

**1칸 = 10×10 픽셀 = 1,000원**

- 스택: Next.js 16 (App Router) · React 19 · TypeScript · Supabase · 포트원(PortOne) v2
- 배포: Vercel (`master` 푸시 시 자동)
- 운영: 스트릿애드(StreetAd)

---

## 📖 문서

| 문서 | 내용 |
|---|---|
| **[AGENTS.md](./AGENTS.md)** | **프로젝트 컨텍스트 · 결정사항 · 함정 · 미해결 항목** ← 작업 전 필독 |
| [SETUP.md](./SETUP.md) | 다른 PC에서 이어받는 방법 (환경변수 포함) |

> ⚠️ **코드 수정 전 반드시 `AGENTS.md`의 "절대 잊으면 안 되는 함정" 섹션을 읽으세요.**
> 특히 **결제 금액**과 **격자 상수**는 여러 곳이 연동돼 있어, 한 곳만 고치면 결제가 전부 실패합니다.

---

## 빠른 시작

```bash
npm install
npx vercel env pull .env.local   # 환경변수 받기 (SETUP.md 참고)
npm run dev                      # http://localhost:3000
```

## 커밋 전 필수 체크

```bash
npx tsc --noEmit     # 타입체크
npm run build        # 프로덕션 빌드
```

## 주요 경로

```
src/
├── app/
│   ├── page.tsx                    지도 메인
│   ├── api/payment-complete/       결제 서버 검증 (금액 위변조 방어)
│   ├── api/admin/vacate/           관리자 강제퇴거 (서버 인증)
│   ├── payment-redirect/           결제 결과 → 입주 처리
│   ├── admin/                      관리자 대시보드
│   └── terms · privacy · faq       법적/안내 페이지
├── components/
│   ├── MapGrid.tsx                 지도 캔버스 (렌더·줌·팬·선택)
│   ├── ApplyFlow.tsx               입주 신청 모달 (5단계 + 결제)
│   ├── StatsPanel.tsx              하단 통계 바 (미니맵·줌·사업자정보)
│   └── FloatingHeader.tsx          상단 헤더
└── lib/
    └── constants.ts                격자·가격 상수 (⚠️ 서버와 공유)
```
