-- 기존 update 정책 삭제 후 재생성
DROP POLICY IF EXISTS "houses_update_own" ON houses;

-- 빈 칸 입주 신청 (available 상태의 집은 누구나 클레임 가능)
CREATE POLICY "houses_claim_available" ON houses FOR UPDATE
USING (status = 'available' AND user_id IS NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 본인 집 수정 (이미 입주한 집은 본인만 수정)
CREATE POLICY "houses_update_own" ON houses FOR UPDATE
USING (auth.uid() = user_id);
