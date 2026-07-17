-- ────────────────────────────────────────────────────────────────
-- 고아 셀(유령 입주칸) 청소
--
-- 증상: 어떤 칸이 지도에 집으로 안 그려지고 "입주한 집" 수에도 안 잡히는데,
--       그 위로 범위 선택하면 "이미 입주된 칸"이라고 막힘.
-- 원인: 부모(대표) 칸 없이 자식 칸만 occupied 로 남은 상태
--       (부분 입주 / 퇴거 시 자식칸 미정리 등).
--
-- 사용법: Supabase → SQL Editor.
--   1) 아래 SELECT 로 개수 확인
--   2) 0보다 크면 UPDATE 실행
-- ────────────────────────────────────────────────────────────────

-- 1) 확인
SELECT count(*) AS 유령셀
FROM houses c
WHERE c.status = 'occupied' AND c.parent_address IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM houses p
  WHERE p.address = c.parent_address AND p.status = 'occupied' AND p.parent_address IS NULL
);

-- 2) 청소 (위 개수가 0보다 클 때만)
UPDATE houses AS c SET
  user_id = null, status = 'available', parent_address = null,
  name = null, nickname = null, description = null, link_url = null,
  exterior_image_url = null, interior_image_url = null, border_effect = 'none',
  width = 1, height = 1, occupied_at = null, expires_at = null,
  is_permanent = false, like_count = 0, visit_count = 0, is_visible = true
WHERE c.status = 'occupied' AND c.parent_address IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM houses p
  WHERE p.address = c.parent_address AND p.status = 'occupied' AND p.parent_address IS NULL
);
