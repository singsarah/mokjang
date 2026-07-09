import { describe, expect, it } from "vitest";
import {
  STUDENT_EXPORT_HEADERS,
  TEACHER_EXPORT_HEADERS,
  formatBirthday,
  studentExportRow,
  teacherExportRow,
  type ExportStudent,
  type ExportTeacher,
} from "@/lib/roster-export";

function baseStudent(overrides: Partial<ExportStudent> = {}): ExportStudent {
  return {
    name: "홍길동",
    grade: 1,
    gender: "male",
    className: "1-1",
    birthdayYear: 2010,
    birthdayMonth: 5,
    birthdayDay: 3,
    phoneSelf: "01012345678",
    kakaoId: "hong_kakao",
    school: "OO고",
    address: "Blk 123",
    guardianRelation: "모",
    guardianRelationOther: null,
    guardianName: "홍엄마",
    phoneGuardian: "97860554",
    guardian2Relation: "부",
    guardian2Name: "홍아빠",
    guardian2Phone: "85331576",
    baptism: "유아세례",
    familyNote: "형 1명",
    note: "조용한 편",
    parentChatInvited: true,
    registrationSubmitted: true,
    ...overrides,
  };
}

describe("formatBirthday", () => {
  it("연도가 있으면 YYYY-MM-DD", () => {
    expect(formatBirthday(2010, 5, 3)).toBe("2010-05-03");
  });
  it("연도가 없으면 MM-DD", () => {
    expect(formatBirthday(null, 4, 9)).toBe("04-09");
  });
  it("월/일이 없으면 빈 문자열", () => {
    expect(formatBirthday(2010, null, null)).toBe("");
  });
});

describe("studentExportRow", () => {
  it("헤더와 같은 개수·순서로 값을 만든다", () => {
    const row = studentExportRow(baseStudent());
    expect(row).toHaveLength(STUDENT_EXPORT_HEADERS.length);
    expect(row).toEqual([
      "홍길동", 1, "남", "1-1", "2010-05-03", "01012345678", "hong_kakao", "OO고", "Blk 123",
      "모", "홍엄마", "97860554",
      "부", "홍아빠", "85331576",
      "유아세례", "형 1명", "조용한 편", "O", "O",
    ]);
  });

  it("성별 null 은 빈 문자열, O/X 불리언은 O/빈문자열로 변환", () => {
    const row = studentExportRow(
      baseStudent({ gender: null, parentChatInvited: false, registrationSubmitted: false }),
    );
    expect(row[2]).toBe("");
    expect(row[18]).toBe("");
    expect(row[19]).toBe("");
  });

  it("보호자1 관계가 '기타'면 상세 텍스트를 그대로 내보낸다(재업로드 시 normalizeRelation 이 '기타'+상세로 복원)", () => {
    const row = studentExportRow(
      baseStudent({ guardianRelation: "기타", guardianRelationOther: "이모" }),
    );
    expect(row[9]).toBe("이모");
  });

  it("'기타'인데 상세가 없으면 '기타' 문자열 자체를 넣는다", () => {
    const row = studentExportRow(baseStudent({ guardianRelation: "기타", guardianRelationOther: null }));
    expect(row[9]).toBe("기타");
  });

  it("null 필드는 빈 문자열로 채운다", () => {
    const row = studentExportRow(
      baseStudent({
        className: null,
        phoneSelf: null,
        kakaoId: null,
        school: null,
        address: null,
        note: null,
      }),
    );
    expect(row[3]).toBe("");
    expect(row[5]).toBe("");
    expect(row[6]).toBe("");
    expect(row[7]).toBe("");
    expect(row[8]).toBe("");
    expect(row[17]).toBe("");
  });
});

describe("teacherExportRow", () => {
  function baseTeacher(overrides: Partial<ExportTeacher> = {}): ExportTeacher {
    return {
      name: "김선생",
      birthdayYear: null,
      birthdayMonth: 4,
      birthdayDay: 9,
      phone: "01098765432",
      kakaoId: "kim_kakao",
      duty: "찬양팀",
      jobType: "직장인",
      note: "",
      ...overrides,
    };
  }

  it("헤더와 같은 개수·순서로 값을 만든다", () => {
    const row = teacherExportRow(baseTeacher());
    expect(row).toHaveLength(TEACHER_EXPORT_HEADERS.length);
    expect(row).toEqual(["김선생", "04-09", "01098765432", "kim_kakao", "찬양팀", "직장인", ""]);
  });
});
