-- 교사 명단(인적사항) 테이블. 학적부(students)와 별개로, 그룹 교사들의
-- 연락처·생일 등을 관리. 관리 권한은 대표 교사(master) 전용.
CREATE TABLE teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  birthday_month int,
  birthday_day int,
  birthday_year int,
  phone text,
  kakao_id text,
  duty text,       -- 담당 (예: 찬양팀)
  job_type text,   -- 직장인/학생 (자유텍스트)
  note text,       -- 비고
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teachers_group_name ON teachers(group_id, name);

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- 조회: 활성 멤버 누구나.
CREATE POLICY "members read teachers" ON teachers FOR SELECT
  USING (is_active_member(group_id, auth.uid()));

-- 추가/수정/삭제: 대표 교사(master)만.
CREATE POLICY "master write teachers" ON teachers FOR ALL
  USING (user_role_in_group(group_id, auth.uid()) = 'master')
  WITH CHECK (user_role_in_group(group_id, auth.uid()) = 'master');
