-- =====================================================
-- 하트(좋아요) 카운트 버그 수정 (#13)
-- 증상: 남의 집에 하트를 눌러도 like_count 숫자가 안 올라감
-- 원인: like INSERT/DELETE 트리거가 houses.like_count 를 UPDATE 하는데,
--       트리거 함수가 SECURITY DEFINER 가 아니라 호출자(로그인 사용자)
--       권한으로 실행됨 → houses_update_own RLS( auth.uid() = user_id )에
--       막혀 "본인 집이 아니면" 0행만 갱신되고 조용히 실패함.
-- 해결: 트리거 함수를 SECURITY DEFINER 로 만들어 RLS 를 우회하게 함.
--       (likes 테이블 자체 RLS 는 그대로라 아무 집이나 무한정 조작 불가)
-- Supabase SQL Editor 에서 1회 실행하세요.
-- =====================================================

CREATE OR REPLACE FUNCTION update_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE houses SET like_count = like_count + 1 WHERE id = NEW.house_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE houses SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.house_id;
  END IF;
  RETURN NULL;
END;
$$;

-- 그동안 어긋난 캐시 값을 실제 likes 개수로 한 번 맞춰줌 (드리프트 보정)
UPDATE houses h
SET like_count = COALESCE(l.cnt, 0)
FROM (
  SELECT house_id, COUNT(*) AS cnt FROM likes GROUP BY house_id
) l
WHERE h.id = l.house_id
  AND h.like_count <> l.cnt;

-- likes 가 하나도 없는데 like_count 가 남아있는 집도 0으로
UPDATE houses h
SET like_count = 0
WHERE h.like_count <> 0
  AND NOT EXISTS (SELECT 1 FROM likes l WHERE l.house_id = h.id);
