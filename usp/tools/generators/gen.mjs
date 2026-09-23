#!/usr/bin/env node
// Scaffolds modules and features across backend, web, admin and mobile (docs/PLATFORM_REQUIREMENTS.md §6.6).
//
//   pnpm gen:module  <key> --code XX --ar "…" --en "…" [--icon grid] [--order 100]
//   pnpm gen:feature <module> <feature> [--kind service|view|desk|policy|integration] [--service-id XX-00]
//                    [--ar "…"] [--en "…"] [--doc "…"] [--configured]
//
// Kinds: service/view/desk → web + mobile pages; policy → admin page. --configured → registry entry + config package only (no code).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const JAVA = 'backend/src/main/java/org/gcc/usp/modules';
const MIGR = 'backend/src/main/resources/db/migration';
const KINDS = ['service', 'view', 'desk', 'policy', 'integration'];

const [cmd, ...rest] = process.argv.slice(2);
const pos = [], opt = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) { const k = rest[i].slice(2); const v = rest[i + 1]; if (v === undefined || v.startsWith('--')) opt[k] = true; else { opt[k] = v; i++; } }
  else pos.push(rest[i]);
}

const die = (m) => { console.error(`✖ ${m}`); process.exit(1); };
const pascal = (s) => s.split(/[-_]/).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const q = (s) => JSON.stringify(s); // safe for both Java and TS string literals
const abs = (p) => path.join(ROOT, p);
function write(p, content) {
  if (fs.existsSync(abs(p))) die(`${p} already exists`);
  fs.mkdirSync(path.dirname(abs(p)), { recursive: true });
  fs.writeFileSync(abs(p), content.replace(/^\n/, ''));
  console.log(`  + ${p}`);
}
/** Inserts `text` above the marker line; with `javaList`, adds the comma the previous element needs. */
function insert(p, marker, text, { javaList = false } = {}) {
  const lines = fs.readFileSync(abs(p), 'utf8').split('\n');
  const i = lines.findIndex((l) => l.includes(marker));
  if (i < 0) die(`marker ${marker} not found in ${p}`);
  if (javaList) { let j = i - 1; while (j >= 0 && !lines[j].trim()) j--; if (!lines[j].trimEnd().endsWith('(')) lines[j] += ','; }
  const indent = lines[i].match(/^\s*/)[0];
  lines.splice(i, 0, ...text.split('\n').map((l) => indent + l));
  fs.writeFileSync(abs(p), lines.join('\n'));
  console.log(`  ~ ${p}`);
}
/** Timestamp version, always above every existing migration (modules share one Flyway history). */
function migrationVersion() {
  const z = (n) => String(n).padStart(2, '0'); const d = new Date();
  let v = BigInt(`${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`);
  for (const dir of fs.readdirSync(abs(MIGR))) for (const f of fs.readdirSync(abs(`${MIGR}/${dir}`))) {
    const m = f.match(/^V([\d_]+)__/); if (m) { const x = BigInt(m[1].replaceAll('_', '').padEnd(14, '0')); if (x >= v) v = x + 1n; }
  }
  const s = String(v); return `V${s.slice(0, 8)}_${s.slice(8)}`;
}
const APPS = { web: 'apps/web/src', admin: 'apps/admin/src', mobile: 'apps/mobile/src' };
const REGISTRY = { web: 'apps/web/src/app/registry.ts', admin: 'apps/admin/src/app/registry.ts', mobile: 'apps/mobile/src/registry.ts' };

function genModule([key]) {
  if (!key || !/^[a-z][a-z0-9]*$/.test(key)) die('module key must be lowercase letters/digits, e.g. timeleave');
  const { code, ar, en } = opt; if (!code || !ar || !en) die('--code, --ar and --en are required');
  const icon = opt.icon || 'grid'; const order = Number(opt.order || 100); const cls = `${pascal(key)}Module`;
  if (fs.existsSync(abs(`${JAVA}/${key}`))) die(`module ${key} already exists`);
  console.log(`Module ${key} (${code})`);

  write(`${JAVA}/${key}/package-info.java`, `
/**
 * Business module ${code}: ${en}. Features are sub-packages (one package per feature).
 */
@ApplicationModule(displayName = ${q(en)})
package org.gcc.usp.modules.${key};

import org.springframework.modulith.ApplicationModule;
`);
  write(`${JAVA}/${key}/${cls}.java`, `
package org.gcc.usp.modules.${key};

import java.util.List;
import org.gcc.usp.platform.modules.FeatureDescriptor;
import org.gcc.usp.platform.modules.FeatureDescriptor.Kind;
import org.gcc.usp.platform.modules.ModuleDescriptor;
import org.gcc.usp.platform.shared.LocalizedText;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Module descriptor: key, catalogue code and features. New features are added by {@code pnpm gen:feature ${key} <feature>}. */
@Configuration
class ${cls} {

    @Bean
    ModuleDescriptor ${key}Descriptor() {
        return new ModuleDescriptor(${q(key)}, ${q(code)}, LocalizedText.arEn(${q(ar)}, ${q(en)}), ${q(icon)}, ${order},
                List.of(
                        // @gen:features
                ));
    }
}
`);
  write(`${JAVA}/${key}/README.md`, `
# Module \`${key}\`: ${en} (${code})

${ar}

| Feature | Kind | Implementation | Service | Description |
|---|---|---|---|---|
<!-- @gen:features -->

Rules: features are sub-packages; other modules may only use this module's root package or \`@NamedInterface\` packages;
tables live in schema \`${key}\` (migrations in \`${MIGR}/${key}\`).
`);
  write(`${MIGR}/${key}/${migrationVersion()}__${key}_init.sql`, `
-- Module ${key} owns this schema. Never reference another module's tables (B4).
create schema if not exists ${key};
`);

  for (const app of ['web', 'admin']) {
    write(`${APPS[app]}/modules/${key}/index.ts`, `
import type { AppModule } from '../../app/module';

export const ${key}: AppModule = {
  key: ${q(key)},
  name: { ar: ${q(ar)}, en: ${q(en)} },
  routes: [
    // @gen:routes
  ],
};
`);
  }
  write(`${APPS.mobile}/modules/${key}/index.ts`, `
import type { MobileModule } from '../../module';

export const ${key}: MobileModule = {
  key: ${q(key)},
  name: { ar: ${q(ar)}, en: ${q(en)} },
  screens: [
    // @gen:screens
  ],
};
`);
  for (const app of ['web', 'admin', 'mobile']) {
    const from = app === 'mobile' ? `./modules/${key}` : `../modules/${key}`;
    insert(REGISTRY[app], '// @gen:imports', `import { ${key} } from '${from}';`);
    insert(REGISTRY[app], '// @gen:modules', `${key},`);
  }
}

function genFeature([mod, feat]) {
  if (!mod || !feat) die('usage: gen:feature <module> <feature>');
  if (!/^[a-z][a-z0-9-]*$/.test(feat)) die('feature key must be kebab-case, e.g. leave-request');
  if (!fs.existsSync(abs(`${JAVA}/${mod}`))) die(`module ${mod} does not exist (run gen:module first)`);
  const kind = opt.kind || 'service'; if (!KINDS.includes(kind)) die(`--kind must be one of ${KINDS.join(', ')}`);
  const ar = opt.ar || feat, en = opt.en || feat, sid = opt['service-id'];
  const P = pascal(feat), pkg = feat.replaceAll('-', ''), moduleJava = `${JAVA}/${mod}/${pascal(mod)}Module.java`;
  console.log(`Feature ${mod}.${feat} (${opt.configured ? 'configured' : 'coded'} ${kind})`);

  if (opt.configured && !sid) die('--service-id is required for configured services');
  const readme = `${JAVA}/${mod}/README.md`;
  insert(readme, '<!-- @gen:features -->', `| \`${feat}\` | ${kind} | ${opt.configured ? 'configured' : 'coded'} | ${sid || ''} | ${opt.doc || en} |`);
  if (opt.configured) {
    insert(moduleJava, '// @gen:features', `FeatureDescriptor.configured(${q(`${mod}.${feat}`)}, ${q(sid)}, LocalizedText.arEn(${q(ar)}, ${q(en)}))`, { javaList: true });
    write(`config-packages/${mod}/${feat}/service.json`, JSON.stringify({
      id: sid, module: mod, feature: feat, version: 1, name: { ar, en },
      fields: [], form: { pages: [{ title: { ar, en }, fields: [] }] }, rules: [], workflow: { steps: [] },
    }, null, 2) + '\n');
    return;
  }

  write(`${JAVA}/${mod}/${pkg}/package-info.java`, `
/**
 * Feature ${mod}.${feat}: ${opt.doc || en}
 */
package org.gcc.usp.modules.${mod}.${pkg};
`);
  write(`${JAVA}/${mod}/${pkg}/${P}Controller.java`, `
package org.gcc.usp.modules.${mod}.${pkg};

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** REST API of feature ${mod}.${feat}. Keep the feature's service, entities and repository in this package. */
@RestController
@RequestMapping("/api/v1/${mod}/${feat}")
class ${P}Controller {
}
`);
  insert(moduleJava, '// @gen:features', `FeatureDescriptor.coded(${q(`${mod}.${feat}`)}, ${sid ? q(sid) : 'null'}, Kind.${kind.toUpperCase()}, LocalizedText.arEn(${q(ar)}, ${q(en)}))`, { javaList: true });

  const route = () => `{ path: '/${mod}/${feat}', feature: ${q(feat)}, ${sid ? `serviceId: ${q(sid)}, ` : ''}name: { ar: ${q(ar)}, en: ${q(en)} }, Component: lazy(() => import('./features/${feat}/pages/${P}Page')) },`;
  const page = () => `
import { Placeholder } from '@usp/ui-web';

/** ${mod}.${feat}${opt.doc ? `: ${opt.doc}` : ''} */
export default function ${P}Page() {
  return <Placeholder title={{ ar: ${q(ar)}, en: ${q(en)} }} feature="${mod}.${feat}" />;
}
`;
  const apps = kind === 'policy' ? ['admin'] : ['web'];
  for (const app of apps) {
    write(`${APPS[app]}/modules/${mod}/features/${feat}/pages/${P}Page.tsx`, page());
    const manifest = `${APPS[app]}/modules/${mod}/index.ts`;
    const src = fs.readFileSync(abs(manifest), 'utf8');
    if (!src.includes("import { lazy } from 'react';")) fs.writeFileSync(abs(manifest), `import { lazy } from 'react';\n${src}`);
    insert(manifest, '// @gen:routes', route());
  }
  if (kind !== 'policy' && kind !== 'integration') {
    write(`${APPS.mobile}/modules/${mod}/features/${feat}/${P}Screen.tsx`, `
import { Placeholder } from '../../../../shared/Placeholder';

/** ${mod}.${feat}${opt.doc ? `: ${opt.doc}` : ''} */
export default function ${P}Screen() {
  return <Placeholder title={{ ar: ${q(ar)}, en: ${q(en)} }} feature="${mod}.${feat}" />;
}
`);
    write(`apps/mobile/app/${mod}/${feat}.tsx`, `export { default } from '../../src/modules/${mod}/features/${feat}/${P}Screen';\n`);
    insert(`${APPS.mobile}/modules/${mod}/index.ts`, '// @gen:screens', `{ href: '/${mod}/${feat}', feature: ${q(feat)}, ${sid ? `serviceId: ${q(sid)}, ` : ''}name: { ar: ${q(ar)}, en: ${q(en)} } },`);
  }
  console.log(`\nNext: implement the feature; add tables with a migration in ${MIGR}/${mod}/ if it needs any.`);
}

if (cmd === 'module') genModule(pos);
else if (cmd === 'feature') genFeature(pos);
else die('usage: gen.mjs module|feature …');
