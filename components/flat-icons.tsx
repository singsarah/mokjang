// 단색 flat SVG 아이콘 (fill=currentColor, stroke 없음). 크롬/UI 아이콘 전용.
// 정보 전달용 이모지(🎂 등)나 브랜드 요소(양 얼굴)는 여기 포함하지 않음.
import type { SVGProps } from "react";

type FlatIconProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "fill">;

function base(props: FlatIconProps) {
  return {
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-hidden": true,
    ...props,
  } as const;
}

export function CalendarIcon(props: FlatIconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 2.5a1 1 0 0 1 2 0V4h8V2.5a1 1 0 0 1 2 0V4h1a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V2.5ZM4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9H4Z" />
    </svg>
  );
}

export function ChartIcon(props: FlatIconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="11" width="4" height="9" rx="1.2" />
      <rect x="10" y="4" width="4" height="16" rx="1.2" />
      <rect x="16" y="8" width="4" height="12" rx="1.2" />
    </svg>
  );
}

export function GearIcon(props: FlatIconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 1.8 14 2l.6 2.6 1.9.8 2.3-1.4 1.5 1.5-1.4 2.3.8 1.9L22 10v4l-2.3.6-.8 1.9 1.4 2.3-1.5 1.5-2.3-1.4-1.9.8L14 22h-4l-.6-2.3-1.9-.8-2.3 1.4-1.5-1.5 1.4-2.3-.8-1.9L2 14v-4l2.3-.6.8-1.9L3.7 5.2l1.5-1.5 2.3 1.4 1.9-.8L10 1.8h2Zm0 6.7a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
    </svg>
  );
}

export function NotebookIcon(props: FlatIconProps) {
  return (
    <svg {...base(props)}>
      {/* 회의록: 스프링 노트 — 왼쪽에 링 구멍 2개, 안에 글줄 3개 */}
      <path d="M7 2h11a2.5 2.5 0 0 1 2.5 2.5v15A2.5 2.5 0 0 1 18 22H7a2.5 2.5 0 0 1-2.5-2.5V18H3a1 1 0 1 1 0-2h1.5v-3H3a1 1 0 1 1 0-2h1.5V8H3a1 1 0 0 1 0-2h1.5V4.5A2.5 2.5 0 0 1 7 2Zm2.5 5.5a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2h-6Zm0 4a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-6Zm0 4a1 1 0 1 0 0 2h3.5a1 1 0 1 0 0-2H9.5Z" />
    </svg>
  );
}

export function PhoneIcon(props: FlatIconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.6 2.3c.6-.2 1.3 0 1.7.6l1.7 2.9c.4.6.3 1.4-.2 1.9l-1.2 1.2a14.5 14.5 0 0 0 6.5 6.5l1.2-1.2c.5-.5 1.3-.6 1.9-.2l2.9 1.7c.6.4.8 1.1.6 1.7l-.9 2.6c-.2.7-.9 1.1-1.6 1C10.5 20.1 3.9 13.5 3 4.9c-.1-.7.3-1.4 1-1.6l2.6-1Z" />
    </svg>
  );
}

export function PencilIcon(props: FlatIconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z" />
    </svg>
  );
}

export function CakeIcon(props: FlatIconProps) {
  return (
    <svg {...base(props)}>
      <path d="M11 5.5a2 2 0 0 1-1-1.7c0-.8.7-1.6 2-2.8 1.3 1.2 2 2 2 2.8a2 2 0 0 1-1 1.7V8h4a3 3 0 0 1 3 3v1.6c-.8.7-1.7.7-2.5.1-.9-.7-2.1-.7-3 0-.9.7-2.1.7-3 0-.9-.7-2.1-.7-3 0-.8.6-1.7.6-2.5-.1V11a3 3 0 0 1 3-3h2V5.5ZM4 15.9c1.2.5 2.5.4 3.5-.4.5-.4 1.5-.4 2 0 1.5 1.1 3.5 1.1 5 0 .5-.4 1.5-.4 2 0 1 .8 2.3.9 3.5.4V19a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-3.1Z" />
    </svg>
  );
}
