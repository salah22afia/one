-- Steps assigned to people rather than positions (the requester's own steps) keep their employee numbers here.
-- Position steps are matched live against the viewer's SAP positions (position_ids).
alter table workflow.step add column assigned_to jsonb not null default '[]';
