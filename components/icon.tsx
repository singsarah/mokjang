// public/icons/<name>.svg 를 불러오는 재사용 아이콘.
// SVG 파일들은 이미 design-guide 팔레트 색으로 그려져 있어 그대로 사용한다.
//   sheep-face — 로고/출석 탭 · star — 생일·강조 배지 · cross — 헤더 로고 포인트
export type IconName = "sheep-face" | "star" | "cross";

export function Icon({
  name,
  size = 24,
  className,
  alt = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/${name}.svg`}
      width={size}
      height={size}
      alt={alt}
      className={className}
      draggable={false}
    />
  );
}
