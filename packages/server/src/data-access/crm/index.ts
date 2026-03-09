export {
  listRecords,
  isListableResource,
  type ListParams,
  type ListResult,
} from "@/data-access/crm/list.js";
export { getOneRecord, type GetOneParams } from "@/data-access/crm/get-one.js";
export { insertRecord, type CreateParams } from "@/data-access/crm/create.js";
export { updateRecord, type UpdateParams } from "@/data-access/crm/update.js";
export {
  archiveDeal,
  hardDeleteRecord,
  type DeleteParams,
  type ArchiveResult,
  type HardDeleteResult,
} from "@/data-access/crm/delete.js";
export {
  mergeContacts,
  type MergeContactsParams,
} from "@/data-access/crm/merge-contacts.js";
export { restoreDeal, type RestoreParams } from "@/data-access/crm/restore.js";
export type { GenericFilter } from "@/data-access/crm/utils.js";
