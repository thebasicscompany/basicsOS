export interface EnrichmentResult {
  entityType: "contact" | "company";
  entityId: number;
  fieldsUpdated: string[];
  data: Record<string, unknown>;
  sources: string[];
}

export interface EnrichSourceParams {
  query: string;
  gatewayUrl: string;
  gatewayHeaders: Record<string, string>;
  env: Record<string, string>;
}
