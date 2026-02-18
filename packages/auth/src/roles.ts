export const USER_ROLES = ["admin", "member", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  member: 2,
  viewer: 1,
};

export const hasRole = (userRole: UserRole, requiredRole: UserRole): boolean =>
  ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];

export const isAdmin = (role: UserRole): boolean => role === "admin";
export const isMember = (role: UserRole): boolean => hasRole(role, "member");
