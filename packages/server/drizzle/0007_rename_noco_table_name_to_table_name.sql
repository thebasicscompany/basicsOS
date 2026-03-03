-- Rename object_config.noco_table_name to table_name (Postgres table name for this object)

ALTER TABLE "object_config" RENAME COLUMN "noco_table_name" TO "table_name";
