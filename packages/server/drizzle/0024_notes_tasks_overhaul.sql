-- Notes: add title column
ALTER TABLE contact_notes ADD COLUMN title varchar(512);
ALTER TABLE deal_notes ADD COLUMN title varchar(512);

-- Company notes table
CREATE TABLE company_notes (
  id bigserial PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title varchar(512),
  text text,
  date timestamptz DEFAULT now(),
  crm_user_id bigint REFERENCES crm_users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  status varchar(64),
  attachments jsonb
);
CREATE INDEX company_notes_company_id_idx ON company_notes(company_id);
CREATE INDEX company_notes_crm_user_id_idx ON company_notes(crm_user_id);
CREATE INDEX company_notes_org_idx ON company_notes(organization_id);

-- Tasks: make contactId nullable (company tasks may not have a contact)
ALTER TABLE tasks ALTER COLUMN contact_id DROP NOT NULL;
-- Tasks: add company, assignee, description
ALTER TABLE tasks ADD COLUMN company_id bigint REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN assignee_id bigint REFERENCES crm_users(id);
ALTER TABLE tasks ADD COLUMN description text;
CREATE INDEX tasks_company_id_idx ON tasks(company_id);
