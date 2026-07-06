export const ROLES = {
  MASTER: "master",
  EDITOR: "editor",
  VIEWER: "viewer",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const MEMBERSHIP_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  REMOVED: "removed",
} as const;
export type MembershipStatus =
  (typeof MEMBERSHIP_STATUS)[keyof typeof MEMBERSHIP_STATUS];

export const ROLE_LABELS_KO: Record<Role, string> = {
  master: "마스터",
  editor: "편집 교사",
  viewer: "조회 교사",
};
