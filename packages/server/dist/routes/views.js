import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { registerColumnRoutes } from "../routes/views/column-routes.js";
import { registerFilterRoutes } from "../routes/views/filter-routes.js";
import { registerObjectViewRoutes } from "../routes/views/object-routes.js";
import { registerSortRoutes } from "../routes/views/sort-routes.js";
import { registerViewItemRoutes } from "../routes/views/view-item-routes.js";
export function createViewRoutes(db, auth) {
    const app = new Hono();
    app.use("*", authMiddleware(auth, db));
    registerObjectViewRoutes(app, db);
    registerColumnRoutes(app, db);
    registerSortRoutes(app, db);
    registerFilterRoutes(app, db);
    registerViewItemRoutes(app, db);
    return app;
}
