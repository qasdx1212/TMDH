-- ────────────────────────────────────────────────────────────────
-- border_effect 저장 실패(400) 수정
--
-- 원인: houses.border_effect 에 CHECK (border_effect IN ('none','neon')) 제약이 있어,
--       네온 색·굵기를 담은 'neon:#RRGGBB:굵기' 형식이 거부됨 → 저장 실패(400).
-- 해결: 해당 CHECK 제약 제거 (컬럼은 그대로 TEXT).
--
-- 사용법: Supabase → SQL Editor 에 붙여넣고 [Run]. 한 번만.
-- ────────────────────────────────────────────────────────────────

ALTER TABLE houses DROP CONSTRAINT IF EXISTS houses_border_effect_check;
