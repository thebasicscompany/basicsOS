import type { Env } from "@/env.js";
import type { AppModule } from "@/apps/module-types.js";
import { helloModule } from "@/apps/samples/hello-module.js";

/**
 * The installed backend app modules. Production registries are EMPTY unless a
 * hosted app's module has been deployed (APP-4d wires deployed modules in here).
 * The sample is opt-in via LOAD_SAMPLE_APP_MODULE=1 for local/dev demos + E2E.
 */
export function getInstalledModules(env: Env): AppModule[] {
  const flag = env.LOAD_SAMPLE_APP_MODULE;
  if (flag === "1" || flag === "true") return [helloModule];
  return [];
}
