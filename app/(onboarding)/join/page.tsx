import { JoinForm } from "./join-form";

// URL(?code=)에 코드가 있으면 그걸 우선 넘긴다. 없으면(로그인 튕김 등)
// JoinForm이 초대 링크가 남긴 쿠키(pending_join_code)를 클라이언트에서 읽는다.
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const codeFromUrl = (code ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);

  return <JoinForm codeFromUrl={codeFromUrl} />;
}
