import { describe, expect, it } from 'vitest';
import { blocks, validate, type ServiceDefinition } from './index';

const def: ServiceDefinition = {
  id: 'MD-02', module: 'mydata', feature: 'bank-account', version: 1, name: { ar: 'ح', en: 'Bank' },
  fields: [
    { key: 'iban', type: 'iban', label: { ar: 'الآيبان', en: 'IBAN' }, required: true, pattern: '^SA\\d{22}$' },
    { key: 'other', type: 'text', label: { ar: 'بنك آخر', en: 'Other bank' }, visibleWhen: { '==': [{ var: 'bank' }, 'other'] }, required: true },
  ],
  form: { pages: [] },
  rules: [{ id: 'same', when: { and: [{ var: 'iban' }, { '==': [{ var: 'iban' }, { var: 'currentIban' }] }] }, level: 'warn', message: { ar: 'نفس الحساب', en: 'Same account' } }],
  workflow: { steps: [] },
};

describe('validate', () => {
  it('requires visible required fields only', () => {
    expect(validate(def, {}).map((c) => c.key)).toEqual(['required:iban']);
    expect(validate(def, { bank: 'other' }).map((c) => c.key)).toEqual(['required:iban', 'required:other']);
  });
  it('checks patterns and business rules with severity', () => {
    expect(blocks(validate(def, { iban: 'SA12' }))).toBe(true);
    const ok = 'SA0380000000608010167519';
    expect(validate(def, { iban: ok })).toEqual([]);
    const warn = validate(def, { iban: ok, currentIban: ok });
    expect(warn.map((c) => c.level)).toEqual(['warn']);
    expect(blocks(warn)).toBe(false);
  });
});
