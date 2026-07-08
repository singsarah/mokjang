-- 실제 교회 학적부 엑셀에 맞춘 학생 확장 필드 (전부 nullable, 단순 ADD COLUMN).
-- 보호자 1 이름(기존 guardian_relation/phone_guardian 짝), 보호자 2 관계/이름/연락처,
-- 세례/입교(자유텍스트), 카카오톡 ID, 주소, 가족 메모, 비고 성격의 기타 정보,
-- 학부모 단톡방 초대 여부, 등록지원서 제출 여부.
ALTER TABLE students ADD COLUMN guardian_name text;
ALTER TABLE students ADD COLUMN guardian2_relation text;
ALTER TABLE students ADD COLUMN guardian2_name text;
ALTER TABLE students ADD COLUMN guardian2_phone text;
ALTER TABLE students ADD COLUMN baptism text;
ALTER TABLE students ADD COLUMN kakao_id text;
ALTER TABLE students ADD COLUMN address text;
ALTER TABLE students ADD COLUMN family_note text;
ALTER TABLE students ADD COLUMN parent_chat_invited boolean NOT NULL DEFAULT false;
ALTER TABLE students ADD COLUMN registration_submitted boolean NOT NULL DEFAULT false;
