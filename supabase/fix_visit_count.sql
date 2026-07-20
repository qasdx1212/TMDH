-- =====================================================
-- 방문수(visit_count) 버그 수정
-- 증상: '많이 찾는 집 TOP 5' 등에서 방문 횟수가 전부 0
-- 원인: 팝업 열 때 houses.visit_count 를 클라이언트가 직접 UPDATE 하는데,
--       houses_update_own RLS( auth.uid() = user_id )에 막혀 남의 집(=대부분)은
--       조용히 0행만 갱신됨 → 방문수가 오르지 않음. (좋아요 버그와 동일 계열)
-- 해결: SECURITY DEFINER 함수로 RLS 를 우회해 +1 시킨다.
--       (increment_visit 는 카운트만 올릴 뿐 다른 컬럼은 못 건드림)
-- Supabase SQL Editor 에서 1회 실행하세요.
-- =====================================================

CREATE OR REPLACE FUNCTION increment_visit(p_house_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE houses SET visit_count = visit_count + 1 WHERE id = p_house_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_visit(uuid) TO anon, authenticated;
