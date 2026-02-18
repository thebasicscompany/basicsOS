export { auth, type Auth } from "./config.js";
export { createClient, type AuthClient } from "./client.js";
export {
  USER_ROLES,
  type UserRole,
  ROLE_HIERARCHY,
  hasRole,
  isAdmin,
  isMember,
} from "./roles.js";
