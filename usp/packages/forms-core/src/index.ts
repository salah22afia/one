// Service definition model + rule evaluation shared by web, mobile (and mirrored by the Java rules module).
// The server re-evaluates everything; clients use this for immediate feedback (AB-35, A11).
import jsonLogic from 'json-logic-js';
import { catalogs, interpolate, pick, type LocalizedText } from '@usp/i18n';

/** A JSON Logic expression, e.g. {"==": [{"var": "type"}, "sick"]}. */
export type Rule = Record<string, unknown>;

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'money' | 'date' | 'daterange' | 'select' | 'boolean'
  | 'email' | 'phone' | 'iban' | 'attachment' | 'person' | 'orgUnit' | 'position' | 'table' | 'info';

export interface FieldDef {
  key: string; type: FieldType; label: LocalizedText; help?: LocalizedText;
  required?: boolean; requiredWhen?: Rule; visibleWhen?: Rule;
  options?: { value: string; label: LocalizedText }[];
  pattern?: string; min?: number; max?: number;
}
export interface RuleDef { id: string; when: Rule; level: 'block' | 'warn' | 'info'; message: LocalizedText; field?: string }
export interface Check { key: string; level: 'ok' | 'info' | 'warn' | 'block'; text: LocalizedText; field?: string }

/** Approver rule (CAP-01), extended by the service builder (AB-51). */
export interface AgentRule {
  kind: 'lineManager' | 'orgHead' | 'chain' | 'positions' | 'pool' | 'requester' | 'field' | 'role';
  level?: string; upTo?: string; positionIds?: string[]; quorum?: 'any' | 'all'; unitId?: string; field?: string; role?: string;
}
/** What the holder of a step may decide. */
export type Decision = 'approve' | 'return' | 'reject' | 'done' | 'receive';
export interface StepDef {
  key: string; title: LocalizedText; mode: 'approve' | 'notify' | 'fulfil' | 'receipt' | 'system' | 'decision' | 'wait';
  agent?: AgentRule; slaHours?: number; when?: Rule; operation?: string;
  /** Allowed decisions; omitted = the mode's defaults (DEFAULT_DECISIONS). Must include the mode's first decision. */
  decisions?: Decision[];
}
/** Everything a step of each human mode may allow, and the prototype's defaults (mirrors the Java ServiceDefinition). */
export const DECISIONS: Partial<Record<StepDef['mode'], Decision[]>> = { approve: ['approve', 'return', 'reject'], fulfil: ['done', 'return', 'reject'], receipt: ['receive'] };
export const DEFAULT_DECISIONS: Partial<Record<StepDef['mode'], Decision[]>> = { approve: ['approve', 'return', 'reject'], fulfil: ['done'], receipt: ['receive'] };
export interface ServiceDefinition {
  id: string; module: string; feature: string; version: number; name: LocalizedText;
  /** Icon of the service on request rows (a UI-kit icon name). */
  icon?: string;
  /** When the requester may withdraw: before anyone else decided (default) or never. */
  withdraw?: 'beforeDecision' | 'never';
  fields: FieldDef[];
  form: { pages: { title: LocalizedText; fields: string[] }[] };
  rules: RuleDef[];
  workflow: { steps: StepDef[] };
  /** Shown on the review page: what happens after submission. */
  next?: LocalizedText;
}

export type FormData = Record<string, unknown>;

/** JSON Logic truthiness, as json-logic-js / json-logic-java define it (checked by fixtures/rules.json). */
export const holds = (rule: Rule, data: FormData) => jsonLogic.truthy(jsonLogic.apply(rule as jsonLogic.RulesLogic, data));
const holdsOr = (rule: Rule | undefined, data: FormData, fallback: boolean) => (rule ? holds(rule, data) : fallback);
export const isVisible = (f: FieldDef, data: FormData) => holdsOr(f.visibleWhen, data, true);
export const isRequired = (f: FieldDef, data: FormData) => isVisible(f, data) && (f.required || holdsOr(f.requiredWhen, data, false));
/** Local ISO date (YYYY-MM-DD), exposed to rules as {"var": "today"} like the server does. */
export const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const empty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** A catalog message in every shipped language, with the field label in the same language. */
function fieldMessage(key: string, label: LocalizedText): LocalizedText {
  return Object.fromEntries(Object.entries(catalogs).map(([lang, c]) => [lang, interpolate(c[key] ?? key, { label: pick(label, lang) })]));
}

/** Field rules, then business rules. Returns only failing checks; empty = ok. Mirrors the Java FormValidator. */
export function validate(def: ServiceDefinition, data: FormData, today = isoToday()): Check[] {
  const ctx = { ...data, today };
  const out: Check[] = [];
  for (const f of def.fields) {
    if (!isVisible(f, ctx)) continue;
    const v = data[f.key];
    if (empty(v)) {
      if (isRequired(f, ctx)) out.push({ key: `required:${f.key}`, level: 'block', field: f.key, text: fieldMessage('validation.required', f.label) });
      continue;
    }
    if (f.pattern && typeof v === 'string' && !new RegExp(f.pattern).test(v))
      out.push({ key: `pattern:${f.key}`, level: 'block', field: f.key, text: fieldMessage('validation.pattern', f.label) });
    if (typeof v === 'number' && ((f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max)))
      out.push({ key: `range:${f.key}`, level: 'block', field: f.key, text: fieldMessage('validation.range', f.label) });
  }
  for (const r of def.rules) if (holds(r.when, ctx)) out.push({ key: r.id, level: r.level, text: r.message, field: r.field });
  return out;
}
export const blocks = (checks: Check[]) => checks.some((c) => c.level === 'block');
