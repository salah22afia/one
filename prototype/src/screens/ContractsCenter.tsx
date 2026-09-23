/* v0.16 سجل عقود التكامل (CAP-02 §4، خريطة الحالات §6): العقود المبنيّة بالشيفرة بمدخلاتها ومخرجاتها وكائنها في SAP (المثبَّت وما يُثبَّت)،
   وربطها لكل مستأجر وبيئة (الوجهة والنظام والعميل ومرجع الاعتماد لا سرّه) واختبار الاتصال، ومن يستعملها من الخدمات المهيّأة. */
import React, { useState } from 'react';
import { useStore } from '../app/store';
import { I } from '../ui/icons';
import { Field, Group, LargeTitle, Notice, Pill, Sheet, TopBar, useLang, usePerson, useToast } from '../ui/components';
import { motion, Stagger, Item } from '../ui/motion';
import { CONTRACTS, ENVS, ENV_TITLE, SYSTEM_TITLE, bindingFor, currentEnv, type Contract } from '../domain/contracts';
import { liveServices } from '../domain/designer';
import { liveTenants } from '../domain/tenants';
import { useUI } from '../app/ui';
import { fmtDate } from '../app/i18n';
import type { Env } from '../domain/types';
import { AdminNav } from './AdminCenter';

export function ContractsCenter() {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const toast = useToast(); const { L } = useUI(); const x = L.dz.v16.contracts;
  const admin = me.persona === 'admin'; const tenants = liveTenants(state);
  const [tenant, setTenant] = useState(state.tenant.id); const [env, setEnv] = useState<Env>(currentEnv(state));
  const [bind, setBind] = useState<Contract | null>(null); const [form, setForm] = useState({ destination: '', systemId: '', client: '', credentialRef: '', note: '' });
  const services = liveServices(state);
  const usedBy = (cid: string) => services.filter((s) => s.route.some((st) => st.contractId === cid) || (s.outputs || []).some((o) => o.contractId === cid));
  const openBind = (c: Contract) => { const b = bindingFor(state, tenant, c.id, env); const tn = tenants.find((z) => z.id === tenant); setForm({ destination: b?.destination || '', systemId: b?.systemId || tn?.erp.systemId || '', client: b?.client || tn?.erp.client || '', credentialRef: b?.credentialRef || '', note: b?.note || '' }); setBind(c); };
  const save = () => { if (!bind) return; dispatch({ type: 'bindingUpsert', binding: { tenant, contractId: bind.id, env, destination: form.destination.trim(), systemId: form.systemId.trim(), client: form.client.trim(), credentialRef: form.credentialRef.trim(), note: form.note.trim() || undefined, status: form.destination.trim() ? 'bound' : 'unbound', by: me.id } }); toast({ title: x.saved, sub: `${tx(bind.name)} · ${tx(ENV_TITLE[env])}`, icon: 'plug', tone: 'ok' }); setBind(null); };
  const test = (id: string, name: string) => { dispatch({ type: 'bindingTest', id, by: me.id }); toast({ title: x.tested, sub: name, icon: 'check', tone: 'ok' }); };
  return (
    <div className="page view policy npc dzc">
      <TopBar title={x.title} back="#/admin" />
      <LargeTitle title={x.title} sub={x.sub} />
      <AdminNav />
      {!admin ? <><Notice tone="warn" icon="info">{t.policy.onlyAdmin}</Notice><div style={{ height: 12 }} /></> : null}
      <div className="dz-tools">
        <label className="dz-as"><span>{x.forTenant}</span><select className="select-in sm" value={tenant} onChange={(e) => setTenant(e.target.value)}>{tenants.map((z) => <option key={z.id} value={z.id}>{tx(z.short)} · {z.id}</option>)}</select></label>
        <div className="segmented sm" id="ct-env">{ENVS.map((e) => <button key={e} type="button" aria-pressed={env === e} onClick={() => setEnv(e)}><span className="seg-txt">{tx(ENV_TITLE[e])}</span></button>)}</div>
      </div>
      <div style={{ height: 8 }} />
      <Stagger>
        {CONTRACTS.map((c) => { const b = bindingFor(state, tenant, c.id, env); const st = b?.status || 'unbound'; const users = usedBy(c.id); return (
          <Item key={c.id}><Group className="ct-card">
            <div className="cell stacked">
              <span className="dz-row-main"><span className={`cell-lead ${st === 'tested' ? 'ok' : st === 'bound' ? 'tint' : 'plain'}`}><I.plug /></span><span className="cell-main"><span className="cell-title">{tx(c.name)}<span className="mono cell-code">{c.id}</span></span><span className="cell-sub">{tx(SYSTEM_TITLE[c.system])} · {c.direction === 'read' ? x.read : x.write} · {tx(c.sapObject)}</span></span></span>
              <span className="dz-row-meta"><Pill tone={c.verified ? 'ok' : 'warn'} icon={c.verified ? 'check' : 'alert'}>{c.verified ? x.verified : x.unverified}</Pill><Pill tone={st === 'tested' ? 'ok' : st === 'bound' ? 'tint' : 'danger'}>{x.statuses[st]}{b ? ` · ${b.destination}` : ''}</Pill>{b?.testedAt ? <Pill>{x.tested} {fmtDate(b.testedAt, lang, { day: 'numeric', month: 'short' })}</Pill> : null}
                {admin ? <button type="button" className={`btn ${b ? 'soft' : 'primary'} sm ct-bind`} onClick={() => openBind(c)}><I.gear />{b ? x.rebind : x.bind}</button> : null}
                {admin && b && b.status === 'bound' ? <button type="button" className="btn secondary sm ct-test" onClick={() => test(b.id, tx(c.name))}><I.check />{x.test}</button> : null}
              </span>
            </div>
            <div className="ct-body">
              <p className="cell-sub">{tx(c.guidance)}</p>
              <div className="ct-io"><span><b>{x.inputs}:</b> {c.inputs.map((i) => `${tx(i.label)}${i.required ? '*' : ''}`).join(lang === 'ar' ? '، ' : ', ')}</span><span><b>{x.outputs}:</b> {c.outputs.map((o) => tx(o.label)).join(lang === 'ar' ? '، ' : ', ')}</span></div>
              <div className="chips" style={{ paddingTop: 6 }}><span className="cell-sub">{users.length ? x.usedBy : x.notUsed}</span>{users.map((s) => <a key={s.id} className="pill" href={`#/admin/designer/svc/${s.id}`}>{tx(s.name)}</a>)}</div>
            </div>
          </Group></Item>
        ); })}
      </Stagger>
      <Sheet open={!!bind} onClose={() => setBind(null)} title={bind ? tx(bind.name) : ''} lead={<span className="qicon g-teal" style={{ width: 40, height: 40, borderRadius: 13 }}><I.plug /></span>}>
        <Notice icon="info">{x.forTenant} <b>{tenant}</b> · {x.env} <b>{tx(ENV_TITLE[env])}</b></Notice>
        <div style={{ height: 10 }} />
        <Group>
          <Field id="ct-dest" label={x.destination}><input id="ct-dest" className="mono" dir="ltr" value={form.destination} placeholder="H4S_DEV_ODATA" onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} /></Field>
          <Field id="ct-sys" label={x.systemId}><input id="ct-sys" className="mono" dir="ltr" value={form.systemId} onChange={(e) => setForm((f) => ({ ...f, systemId: e.target.value.toUpperCase() }))} /></Field>
          <Field id="ct-client" label={x.client}><input id="ct-client" className="mono num" dir="ltr" value={form.client} onChange={(e) => setForm((f) => ({ ...f, client: e.target.value.replace(/\D/g, '').slice(0, 3) }))} /></Field>
          <Field id="ct-cred" label={x.credentialRef}><input id="ct-cred" className="mono" dir="ltr" value={form.credentialRef} placeholder="BTP-DEST-…" onChange={(e) => setForm((f) => ({ ...f, credentialRef: e.target.value }))} /></Field>
          <Field id="ct-note" label={L.dz.v16.tenants.note}><input id="ct-note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></Field>
        </Group>
        <div style={{ height: 12 }} />
        <motion.button type="button" className="btn primary block lg" id="ct-save" disabled={!form.destination.trim()} whileTap={{ scale: 0.97 }} onClick={save}><I.plug />{x.bind}</motion.button>
      </Sheet>
    </div>
  );
}
