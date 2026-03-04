import { pgTable, bigserial, varchar, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
export const tags = pgTable("tags", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    color: varchar("color", { length: 64 }).notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
        onDelete: "cascade",
    }),
});
