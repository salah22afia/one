import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validate, type ServiceDefinition } from './index';

// Guards the source-controlled configured services (config-packages/<module>/<feature>/service.json).
const root = join(import.meta.dirname, '../../../config-packages');
const defs = readdirSync(root).flatMap((m) => readdirSync(join(root, m)).map((f) => ({ m, f, def: JSON.parse(readFileSync(join(root, m, f, 'service.json'), 'utf8')) as ServiceDefinition })));

describe('config packages', () => {
  it.each(defs)('$m/$f is well-formed', ({ m, f, def }) => {
    expect(def.module).toBe(m);
    expect(def.feature).toBe(f);
    const keys = new Set(def.fields.map((x) => x.key));
    for (const p of def.form.pages) for (const k of p.fields) expect(keys, `page field ${k}`).toContain(k);
    expect(def.workflow.steps.length).toBeGreaterThan(0);
    expect(() => validate(def, {})).not.toThrow();
  });
});
