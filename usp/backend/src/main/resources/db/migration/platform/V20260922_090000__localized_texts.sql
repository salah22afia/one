-- Texts become language maps (any number of languages) or message references rendered on read (i18n).

-- workflow.step: title as {"ar": …, "en": …}; why as a message reference {"key": …, "args": […]}.
alter table workflow.step add column title jsonb, add column why jsonb;
update workflow.step set title = jsonb_build_object('ar', title_ar, 'en', title_en);
update workflow.step set why = jsonb_build_object('key', 'legacy.text', 'args', jsonb_build_array(jsonb_build_object('ar', why_ar, 'en', why_en)))
 where why_ar is not null;
alter table workflow.step alter column title set not null;
alter table workflow.step drop column title_ar, drop column title_en, drop column why_ar, drop column why_en;

-- requests.audit: what as a message reference.
alter table requests.audit add column what jsonb;
update requests.audit set what = jsonb_build_object('key', 'legacy.text', 'args', jsonb_build_array(jsonb_build_object('ar', what_ar, 'en', what_en)));
alter table requests.audit alter column what set not null;
alter table requests.audit drop column what_ar, drop column what_en;
