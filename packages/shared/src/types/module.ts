export type ModuleField = {
  name: string;
  type: "text" | "number" | "boolean" | "date" | "uuid" | "jsonb";
  required?: boolean;
};

export type ModuleManifest = {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  defaultFields: ModuleField[];
  activeByDefault: boolean;
  platforms: Array<"web" | "desktop" | "mobile">;
  hasMCPTool: boolean;
};

export type TenantModuleConfig = {
  tenantId: string;
  moduleName: string;
  enabled: boolean;
  updatedAt: Date;
};
