-- 집.zip 데이터베이스 스키마
-- Supabase SQL Editor에서 실행하세요

-- =====================
-- HOUSES (집)
-- =====================
CREATE TABLE IF NOT EXISTS houses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  address TEXT UNIQUE NOT NULL,         -- 예: N-0512, R-1023
  col INTEGER NOT NULL,
  row INTEGER NOT NULL,
  width INTEGER NOT NULL DEFAULT 1,     -- 칸 수 (가로)
  height INTEGER NOT NULL DEFAULT 1,    -- 칸 수 (세로)
  zone TEXT NOT NULL CHECK (zone IN ('neon', 'riverside', 'oldtown', 'artdistrict')),

  -- 입주자 정보
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nickname TEXT CHECK (char_length(nickname) <= 7),
  name TEXT CHECK (char_length(name) <= 20),
  description TEXT CHECK (char_length(description) <= 80),
  link_url TEXT,

  -- 이미지
  exterior_image_url TEXT,
  interior_image_url TEXT,

  -- 이펙트
  border_effect TEXT NOT NULL DEFAULT 'none',  -- 'none' 또는 'neon:#RRGGBB:굵기' (CHECK 제약 제거함)

  -- 상태
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'pending', 'occupied')),

  -- 집계 (빠른 조회용 캐시)
  like_count INTEGER NOT NULL DEFAULT 0,
  visit_count INTEGER NOT NULL DEFAULT 0,

  -- 기간
  occupied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_permanent BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================
-- ORDERS (결제)
-- =====================
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  house_id UUID REFERENCES houses(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,             -- 원화
  days INTEGER,                        -- null이면 영구
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  payment_key TEXT,                    -- 토스페이먼츠 키
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- =====================
-- LIKES (하트)
-- =====================
CREATE TABLE IF NOT EXISTS likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  house_id UUID NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, house_id)
);

-- =====================
-- VISITS (방문)
-- =====================
CREATE TABLE IF NOT EXISTS visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id UUID NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  visitor_ip TEXT,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================
-- 100x100 그리드 초기 데이터 생성
-- 구역 배치: neon(좌상), riverside(우상), oldtown(좌하), artdistrict(우하)
-- =====================
INSERT INTO houses (address, col, row, zone)
SELECT
  CASE
    WHEN col < 50 AND row < 50 THEN 'N'
    WHEN col >= 50 AND row < 50 THEN 'R'
    WHEN col < 50 AND row >= 50 THEN 'O'
    ELSE 'A'
  END || '-' || LPAD((row * 100 + col)::TEXT, 4, '0') AS address,
  col,
  row,
  CASE
    WHEN col < 50 AND row < 50 THEN 'neon'
    WHEN col >= 50 AND row < 50 THEN 'riverside'
    WHEN col < 50 AND row >= 50 THEN 'oldtown'
    ELSE 'artdistrict'
  END AS zone
FROM
  generate_series(0, 99) AS col,
  generate_series(0, 99) AS row
ON CONFLICT (address) DO NOTHING;

-- =====================
-- 함수: likes 카운트 자동 업데이트
-- =====================
CREATE OR REPLACE FUNCTION update_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE houses SET like_count = like_count + 1 WHERE id = NEW.house_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE houses SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.house_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_like_count
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION update_like_count();

-- =====================
-- 함수: visits 카운트 자동 업데이트
-- =====================
CREATE OR REPLACE FUNCTION update_visit_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE houses SET visit_count = visit_count + 1 WHERE id = NEW.house_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_visit_count
AFTER INSERT ON visits
FOR EACH ROW EXECUTE FUNCTION update_visit_count();

-- =====================
-- 함수: updated_at 자동 갱신
-- =====================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_updated_at
BEFORE UPDATE ON houses
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================
-- RLS 정책
-- =====================
ALTER TABLE houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- houses: 누구나 읽기 가능, 본인 집만 수정 가능
CREATE POLICY "houses_read" ON houses FOR SELECT USING (true);
CREATE POLICY "houses_update_own" ON houses FOR UPDATE USING (auth.uid() = user_id);

-- orders: 본인 주문만 읽기/생성
CREATE POLICY "orders_read_own" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "orders_insert_own" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- likes: 누구나 읽기, 로그인한 사용자만 생성/삭제
CREATE POLICY "likes_read" ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_own" ON likes FOR DELETE USING (auth.uid() = user_id);

-- visits: 누구나 생성, 읽기는 본인 집만
CREATE POLICY "visits_insert" ON visits FOR INSERT WITH CHECK (true);
CREATE POLICY "visits_read" ON visits FOR SELECT USING (true);

-- =====================
-- 인덱스
-- =====================
CREATE INDEX IF NOT EXISTS idx_houses_status ON houses(status);
CREATE INDEX IF NOT EXISTS idx_houses_zone ON houses(zone);
CREATE INDEX IF NOT EXISTS idx_houses_visit_count ON houses(visit_count DESC);
CREATE INDEX IF NOT EXISTS idx_houses_user_id ON houses(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_house_id ON likes(house_id);
CREATE INDEX IF NOT EXISTS idx_visits_house_id ON visits(house_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
