import { serve } from "@hono/node-server";
import { createApp } from "./server.js";

const port = Number(process.env["PORT"] ?? "3001");
const app = createApp();

serve({ fetch: app.fetch, port }, (info) => {
  console.warn(`Basics OS API server running on http://localhost:${info.port}`);
});
