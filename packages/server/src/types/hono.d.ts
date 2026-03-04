declare module "hono" {
  interface ContextVariableMap {
    session:
      | {
          user?: {
            id?: string;
          };
          session?: {
            id?: string;
            token?: string;
          };
        }
      | null;
  }
}

export {};
