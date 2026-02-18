import { createWorker, getQueue, QUEUE_NAMES } from "./queue.js";

type ImportJob = {
  tenantId: string;
  importType: "csv" | "json";
  resourceType: string;
  fileKey: string;
};

export const importQueue = getQueue(QUEUE_NAMES.IMPORT);

export const startImportWorker = () =>
  createWorker<ImportJob>(QUEUE_NAMES.IMPORT, async (job) => {
    const { tenantId, resourceType, fileKey } = job.data;
    console.warn(`[import] Importing ${resourceType} from ${fileKey} for tenant:${tenantId}`);
  });
