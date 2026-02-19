import { USER_ROLES, type UserRole } from "@basicsos/auth";

export const parseRole = (role: unknown): UserRole => {
  const found = USER_ROLES.find((r) => r === role);
  return found ?? "member";
};
