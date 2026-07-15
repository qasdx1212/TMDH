-- ────────────────────────────────────────────────────────────────
-- 비공개(is_visible=false) 집의 내용을 소유자 외에는 가리는 마스킹 뷰
--
-- 목적: 지도/최근입주자 조회가 이 뷰를 읽으므로, 비공개 집의
--       이름·소개글·이미지가 소유자가 아닌 사람에겐 null 로 내려간다.
--       → F12 네트워크 탭에도 비공개 내용이 보이지 않음.
--
-- 사용법: Supabase 대시보드 → SQL Editor 에 붙여넣고 [Run].
--         한 번만 실행하면 됨. 지도가 정상적으로 뜨는지 확인.
-- ────────────────────────────────────────────────────────────────

create or replace view public_houses as
select
  id, address, col, row, width, height, zone, status,
  case when is_visible or user_id = auth.uid() then name               else null end as name,
  case when is_visible or user_id = auth.uid() then nickname           else null end as nickname,
  case when is_visible or user_id = auth.uid() then description        else null end as description,
  case when is_visible or user_id = auth.uid() then link_url           else null end as link_url,
  case when is_visible or user_id = auth.uid() then exterior_image_url else null end as exterior_image_url,
  case when is_visible or user_id = auth.uid() then interior_image_url else null end as interior_image_url,
  border_effect, like_count, visit_count, occupied_at, expires_at,
  is_permanent, parent_address, is_visible, has_password
from houses;

-- 익명/로그인 사용자 모두 이 뷰를 읽을 수 있게
grant select on public_houses to anon, authenticated;
