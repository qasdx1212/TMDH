# 다른 PC에서 이어서 작업하기

> 새 PC에서 이 프로젝트를 이어받을 때 순서대로 따라하세요.

## 1. 코드 받기

```bash
git clone https://github.com/qasdx1212/TMDH.git
cd TMDH
npm install
```

## 2. 환경변수 설정 (⚠️ 이게 핵심)

`.env.local`은 **비밀키라 git에 올라가지 않습니다.** 새 PC에서 직접 만들어야 합니다.

**가장 쉬운 방법 — Vercel에서 그대로 내려받기:**
```bash
npx vercel login
npx vercel link          # 기존 프로젝트(cellar)에 연결
npx vercel env pull .env.local
```
→ Vercel에 등록된 환경변수가 `.env.local`로 그대로 복사됩니다.

**수동으로 만들 경우** — 프로젝트 루트에 `.env.local` 생성:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...          # 서버 전용, 절대 노출 금지
NEXT_PUBLIC_PORTONE_STORE_ID=...
NEXT_PUBLIC_PORTONE_CHANNEL_KEY=...
PORTONE_V2_API_SECRET=...              # 서버 전용
```
값은 **Vercel → Settings → Environment Variables**에서 확인.

## 3. 실행

```bash
npm run dev          # http://localhost:3000
npx tsc --noEmit     # 타입체크 (커밋 전 필수)
npm run build        # 프로덕션 빌드 (배포 전 확인)
```

## 4. 계정/콘솔 접근

| 서비스 | 용도 | 주소 |
|---|---|---|
| GitHub | 코드 | github.com/qasdx1212/TMDH |
| Vercel | 배포·환경변수 | vercel.com |
| Supabase | DB·인증·스토리지 | supabase.com |
| 포트원 | 결제 | admin.portone.io |

전부 `qasdx1212@gmail.com` 계정.

## 5. Claude로 이어서 작업하기

새 PC에서 이 폴더를 열고 Claude Code를 실행하면 **`AGENTS.md`를 자동으로 읽습니다.**
거기에 프로젝트 구조·결정사항·함정·미해결 항목이 전부 정리돼 있습니다.

**대화 시작할 때 이렇게 말하면 됩니다:**
> "AGENTS.md 읽고 현재 상황 파악해줘. 그다음 [하고 싶은 작업]"

### 대화 내역 백업
Claude Code의 대화 기록은 로컬에만 저장됩니다 (`~/.claude/projects/`).
PC 간 이어서 하려면:
- **권장:** `AGENTS.md`의 "미해결" 섹션을 최신으로 유지 → 새 PC에서 그것만 읽으면 맥락 복구됨
- 필요시 Claude Code의 `/resume`으로 같은 PC 내 이전 세션 이어가기 가능

## 6. 배포

`master`에 푸시하면 Vercel이 자동 배포합니다.

```bash
git add -A
git commit -m "설명"
git push origin master
```

⚠️ **환경변수를 바꿨다면** — `NEXT_PUBLIC_*`은 빌드 타임에 코드에 박히므로,
Vercel에서 **"Use existing Build Cache" 체크 해제 후 재배포**해야 반영됩니다.
