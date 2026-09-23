import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { holds, type Rule } from './index';

// Same fixtures run by the Java RuleEvaluatorTest: web, mobile and server must agree on every rule (A11).
const cases = JSON.parse(readFileSync(join(import.meta.dirname, '../fixtures/rules.json'), 'utf8')) as { name: string; rule: Rule; data: Record<string, unknown>; expected: boolean }[];

describe('rule parity fixtures', () => {
  it.each(cases)('$name', ({ rule, data, expected }) => expect(holds(rule, data)).toBe(expected));
});
