import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/" className="text-sm text-pasture-600 underline">
        ← 홈
      </Link>
      <h1 className="mt-4 text-2xl font-bold">개인정보 처리 방침</h1>
      <p className="mt-2 text-sm text-gray-500">최종 개정일: 2026-07-03</p>

      <section className="mt-8 space-y-6 text-gray-700">
        <div>
          <h2 className="text-lg font-semibold">1. 수집 항목</h2>
          <ul className="ml-6 mt-2 list-disc">
            <li>가입 시: 이름, 이메일, 비밀번호(암호화 저장)</li>
            <li>선택: 생년월일(월/일)</li>
            <li>학생 정보(교사가 입력): 이름, 학년, 반, 생일, 본인/보호자 연락처</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold">2. 이용 목적</h2>
          <p>교회 그룹의 출석 관리 · 일정 공유 · 생일 알림 · 결석자 연락.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">3. 보관 및 파기</h2>
          <p>
            탈퇴 요청 시 개인 프로필 정보는 즉시 삭제합니다. 학생 정보는 교사가
            직접 삭제할 수 있으며, 소프트 삭제 후 30일이 지나면 완전 삭제됩니다.
            출석 이력의 감사 기록은 익명화되어 유지될 수 있습니다.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">4. 접근 통제</h2>
          <p>
            연락처 등 민감 정보는 편집 권한 교사에게만 완전 노출되며, 조회 권한
            교사에게는 마스킹 처리됩니다. 다른 그룹의 데이터는 원천 차단됩니다.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">5. 미성년자 정보</h2>
          <p>
            학생 개인정보 등록 시 보호자 동의를 반드시 확인해주세요. 앱은 최소
            수집 원칙에 따라 기능에 필요한 필드만 저장합니다.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">6. 문의</h2>
          <p>hyunkyu18@gmail.com</p>
        </div>
      </section>
    </main>
  );
}
