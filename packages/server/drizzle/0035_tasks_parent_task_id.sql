ALTER TABLE "tasks" ADD COLUMN "parent_task_id" bigint REFERENCES "tasks"("id") ON DELETE CASCADE;
CREATE INDEX "tasks_parent_task_id_idx" ON "tasks" ("parent_task_id");
