import { Hono } from "hono";
import { authMiddleware } from "@/middleware/auth.js";
import { registerInitSignupInviteRoutes } from "@/routes/auth/init-signup-invite-routes.js";
import { registerMeSettingsRoutes } from "@/routes/auth/me-settings-routes.js";
import { registerOrganizationRoutes } from "@/routes/auth/organization-routes.js";
export function createAuthRoutes(db, auth, env) {
    const app = new Hono();
    app.get("/gateway-token", authMiddleware(auth, db), async (c) => {
        const session = c.get("session");
        const token = session?.session?.token ?? session?.session?.id;
        if (!token) {
            return c.json({ error: "No session token" }, 401);
        }
        return c.json({ token });
    });
    registerInitSignupInviteRoutes(app, db, auth, env);
    registerMeSettingsRoutes(app, db, auth, env);
    registerOrganizationRoutes(app, db, auth);
    return app;
}
