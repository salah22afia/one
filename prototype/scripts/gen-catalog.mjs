// يولّد src/data/catalog.ts من المصدر الواحد لدليل الخدمات (../catalog/data.js) مع الأسماء الإنجليزية للمجالات وخدمات الموجة الأولى
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const D = require(path.resolve('../catalog/data.js'));

const DOMAIN_EN = {
  TM: 'Time & leave', MD: 'My data & documents', DC: 'Letters & official documents', HA: 'HR actions & organisation',
  FN: 'Employee finance', MI: 'Medical insurance', GR: 'Residency, visas & government relations', TD: 'Training, development & performance',
  LC: 'Lifecycle journeys', AS: 'Needs, custody & assets', PR: 'Procurement & contracts (departments)', BG: 'Budget (departments)',
  GV: 'Meetings, committees, tasks & projects', SY: 'System operations (departments)', EV: 'Employee voice', WP: 'Workplace & support',
};
const SERVICE_EN = {
  'TM-01': 'Leave request', 'DC-01': 'Employment letter', 'MD-01': 'Update my personal data', 'MD-02': 'Change salary account', 'MD-05': 'Update a document (passport, ID, residency, licence)', 'AS-01': 'I need something', 'FN-01': 'Business trip & assignment',
  'TM-03': 'Short permission', 'TM-02': 'Carry over leave balance', 'TM-04': 'Attendance correction', 'TM-05': 'Remote work', 'TM-06': 'Work schedule or shift swap', 'TM-07': 'Overtime',
};

const q = (s) => JSON.stringify(s);
const lines = [];
lines.push('// ملف مولَّد آلياً من ../catalog/data.js (دليل الخدمات 1.0). لا يُعدَّل يدوياً؛ عدّل المصدر ثم node scripts/gen-catalog.mjs');
lines.push("export type Rec = 'w1' | 'w2' | 'w3' | 'later' | 'merge' | 'out';");
lines.push('export interface Domain { id: string; name: string; nameEn: string; desc: string; }');
lines.push('export interface Service { id: string; domain: string; name: string; nameEn?: string; scope: string; requester: string[]; target: string; freq: string; rec: Rec; mergeInto?: string; }');
lines.push('export const DOMAINS: Domain[] = [');
for (const d of D.DOMAINS) lines.push(`  { id: ${q(d.id)}, name: ${q(d.name)}, nameEn: ${q(DOMAIN_EN[d.id] || d.name)}, desc: ${q(d.desc)} },`);
lines.push('];');
lines.push('export const SERVICES: Service[] = [');
for (const s of D.SERVICES) {
  const en = SERVICE_EN[s.id] ? `, nameEn: ${q(SERVICE_EN[s.id])}` : '';
  const mi = s.mergeInto ? `, mergeInto: ${q(s.mergeInto)}` : '';
  lines.push(`  { id: ${q(s.id)}, domain: ${q(s.domain)}, name: ${q(s.name)}${en}, scope: ${q(s.scope)}, requester: ${q(s.requester)}, target: ${q(s.target)}, freq: ${q(s.freq)}, rec: ${q(s.rec)}${mi} },`);
}
lines.push('];');
lines.push(`export const WAVE1_IDS: string[] = ${q(D.SERVICES.filter((s) => s.rec === 'w1').map((s) => s.id))};`);
lines.push(`export const WAVE1_CARDS: { title: string; ids: string[] }[] = ${q(D.WAVE1.cards.map((c) => ({ title: c.title, ids: c.ids })))};`);
fs.mkdirSync(path.resolve('src/data'), { recursive: true });
fs.writeFileSync(path.resolve('src/data/catalog.ts'), lines.join('\n') + '\n');
console.log('catalog.ts generated:', D.SERVICES.length, 'services');
