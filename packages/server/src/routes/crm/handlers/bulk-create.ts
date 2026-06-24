import type { Context } from "hono";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import { jsonError } from "@/lib/api-error.js";
import { createRecord } from "@/services/crm/create-record.js";
import { snakeToCamel } from "@/routes/crm/utils.js";
import {
  CRM_RESOURCES,
  TABLE_MAP,
  type Resource,
} from "@/routes/crm/constants.js";
import {
  resolveCustomTable,
  insertCustomRecord,
} from "@/data-access/crm/dynamic-table.js";

const MAX_BULK = 1000;

/**
 * POST /:resource/bulk — create many records in one request.
 * Body: { records: object[] }. Partial success: each row is attempted
 * independently; returns { created: [...], errors: [{ index, message }] }.
 * Standard resources go through the full create service (validation +
 * embeddings + events fire per row); custom objects use insertCustomRecord.
 */
export function createBulkCreateHandler(db: Db, env: Env) {
  return async (c: Context) => {
    const resource = c.req.param("resource") as Resource;

    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;
    const { crmUser } = authz;
    const crmUserId = crmUser.id;
    const orgId = crmUser.organizationId;
    if (!crmUserId || !orgId) {
      return jsonError(c, "Organization not found", 404, "NOT_FOUND");
    }

    let rawBody: { records?: unknown };
    try {
      rawBody = (await c.req.json()) as { records?: unknown };
    } catch {
      return jsonError(c, "Invalid JSON body", 400, "VALIDATION_FAILED");
    }
    const records = Array.isArray(rawBody.records) ? rawBody.records : null;
    if (!records) {
      return jsonError(c, "`records` must be an array", 400, "VALIDATION_FAILED");
    }
    if (records.length === 0) return c.json({ created: [], errors: [] });
    if (records.length > MAX_BULK) {
      return jsonError(
        c,
        `Too many records (max ${MAX_BULK})`,
        400,
        "VALIDATION_FAILED",
      );
    }

    const created: Record<string, unknown>[] = [];
    const errors: { index: number; message: string }[] = [];

    const isStandard =
      CRM_RESOURCES.includes(resource) &&
      !!TABLE_MAP[
        resource as Exclude<Resource, "companies_summary" | "contacts_summary">
      ] &&
      !resource.endsWith("_summary");

    // ── Custom object ──────────────────────────────────────────────────────
    if (!isStandard) {
      const customTable = await resolveCustomTable(db, resource, orgId);
      if (!customTable) return jsonError(c, "Unknown resource", 404, "NOT_FOUND");
      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        if (!row || typeof row !== "object") {
          errors.push({ index: i, message: "Each record must be an object" });
          continue;
        }
        try {
          const rec = await insertCustomRecord(
            db,
            customTable,
            row as Record<string, unknown>,
            crmUserId,
            orgId,
          );
          if (rec) created.push(rec);
          else errors.push({ index: i, message: "Insert failed" });
        } catch (e) {
          errors.push({
            index: i,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
      return c.json({ created, errors });
    }

    // ── Standard resource ──────────────────────────────────────────────────
    if (resource.endsWith("_summary")) {
      return jsonError(c, "Cannot create on this resource", 400, "INVALID_RESOURCE");
    }
    if (resource === "crm_users" && !authz.permissions.has("*")) {
      return jsonError(c, "Forbidden", 403, "FORBIDDEN");
    }

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      if (!row || typeof row !== "object") {
        errors.push({ index: i, message: "Each record must be an object" });
        continue;
      }
      const body = snakeToCamel(row as Record<string, unknown>);
      const result = await createRecord(db, env, {
        resource,
        body,
        crmUserId,
        orgId,
        crmUserRow: crmUser as Record<string, unknown>,
      });
      if (result.success) created.push(result.record);
      else errors.push({ index: i, message: result.error });
    }
    return c.json({ created, errors });
  };
}
