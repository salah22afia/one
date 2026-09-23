/* v0.16 إدارة المستأجرين (CAP-02 §5، D-033، خريطة الحالات §8): سجل الجهات التي تشغّل البوابة — الهوية، والحالة، والنظام المرجعي (مشترك بعميل آخر أو مستقل) وبيئاته،
   والمديرون والمصمّمون المفوَّضون بمجالاتهم، وتبديل سياق المستأجر لمدير المنصّة. الإضافة والإنهاء بتاريخ (P-12). */
import React, { useState } from 'react';
import { useStore } from '../app/store';
import { nav } from '../app/router';
import { I } from '../ui/icons';
import { Field, Group, LargeTitle, Notice, Pill, Sheet, TopBar, useLang, usePerson, useToast } from '../ui/components';
import { motion, Stagger, Item, Press } from '../ui/motion';
import { liveTenants, blankTenant, tenantKey, TENANT_STATUS_TITLE, ERP_MODE_TITLE, isPlatformAdmin } from '../domain/tenants';
import { ENVS, ENV_TITLE } from '../domain/contracts';
import { toISO } from '../domain/policy';
import { DOMAINS } from '../data/catalog';
import { PosPicker, EndDate } from './NeedPolicyCenter';
import { useUI } from '../app/ui';
import type { Tenant, Env } from '../domain/types';
import { Sw } from './DesignerBits';
import { AdminNav } from './AdminCenter';

export function TenantsCenter() {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const toast = useToast(); const { L } = useUI(); const x = L.dz.v16.tenants; const today = toISO(Date.now());
  const admin = isPlatformAdmin(state, me); const tenants = liveTenants(state);
  const [sel, setSel] = useState<string>(state.tenant.id); const tn = tenants.find((z) => z.id === sel) || tenants[0];
  const [newOpen, setNewOpen] = useState(false); const [nw, setNw] = useState({ key: '', ar: '', en: '', shortAr: '', shortEn: '' });
  const upd = (patch: Partial<Tenant>) => { if (!tn) return; dispatch({ type: 'tenantUpdate', id: tn.id, patch }); };
  const create = () => { const id = tenantKey(nw.key); if (!id || tenants.some((z) => z.id === id)) return; const tt = blankTenant(id, { ar: nw.ar.trim(), en: nw.en.trim() }, { ar: nw.shortAr.trim() || nw.ar.trim(), en: nw.shortEn.trim() || nw.en.trim() }); dispatch({ type: 'tenantAdd', tenant: tt }); setNewOpen(false); setSel(id); toast({ title: x.created, sub: id, icon: 'building', tone: 'ok' }); };
  const people = state.people.filter((p) => p.positionId);
  return (
    <div className="page view policy npc dzc">
      <TopBar title={x.title} back="#/admin" />
      <LargeTitle title={x.title} sub={x.sub} />
      <AdminNav />
      {!admin ? <><Notice tone="warn" icon="info">{t.policy.onlyAdmin}</Notice><div style={{ height: 12 }} /></> : null}
      <div className="ptl">
        {tenants.map((z) => (
          <Press key={z.id} className={`ptl-card ${z.status} ${z.id === sel ? 'on' : ''} tn-card`} onClick={() => setSel(z.id)} lift>
            <span className="ptl-body"><span className="ptl-top"><span className={`tn-emblem h-${z.hue}`}>{tx(z.initials)}</span><b>{tx(z.short)}</b><Pill tone={z.status === 'active' ? 'ok' : z.status === 'onboarding' ? 'gold' : 'danger'}>{tx(TENANT_STATUS_TITLE[z.status])}</Pill></span><span className="ptl-dates num">{z.id} · {z.joinedAt}</span><span className="ptl-sub">{z.id === state.tenant.id ? x.current : tx(ERP_MODE_TITLE[z.erp.mode]).split(' (')[0]}</span></span>
          </Press>
        ))}
        {admin ? <Press className="ptl-card new" onClick={() => { setNw({ key: '', ar: '', en: '', shortAr: '', shortEn: '' }); setNewOpen(true); }} lift><span className="ptl-body"><span className="cell-lead"><I.plus /></span><b>{x.add}</b></span></Press> : null}
      </div>
      {tn ? (
        <Stagger>
          <Item><div className="pv-head"><div className="pv-line"><span><b>{tx(tn.name)}</b> <Pill tone="tint"><span className="mono">{tn.id}</span></Pill></span>{tn.id !== state.tenant.id && admin ? <button type="button" className="btn soft sm" id="tn-switch" onClick={() => { dispatch({ type: 'tenantSwitch', id: tn.id }); toast({ title: x.switchTo, sub: tx(tn.name), icon: 'building', tone: 'info' }); nav('#/admin/designer'); }}><I.gear />{x.switchTo}</button> : <Pill tone="ok" icon="check">{x.current}</Pill>}</div><p className="cell-sub">{x.isolation}</p>{tn.note ? <p className="cell-sub">{tn.note}</p> : null}{!state.people.some((p) => (p as { tenant?: string }).tenant === tn.id) && tn.id !== 'GCC-SG' ? <p className="cell-sub"><I.info /> {x.noPeople}</p> : null}</div></Item>
          <div className="section-label"><span>{x.name} · {x.status}</span></div>
          <Item><Group><div className="ed-row dz-ed">
            <label><span>{x.name}</span><input id="tn-name-ar" value={tn.name.ar} disabled={!admin} onChange={(e) => upd({ name: { ...tn.name, ar: e.target.value } })} /></label>
            <label><span>{x.nameEn}</span><input dir="ltr" value={tn.name.en} disabled={!admin} onChange={(e) => upd({ name: { ...tn.name, en: e.target.value } })} /></label>
            <label><span>{x.short}</span><input value={tn.short.ar} disabled={!admin} onChange={(e) => upd({ short: { ...tn.short, ar: e.target.value } })} /></label>
            <label><span>{x.shortEn}</span><input dir="ltr" value={tn.short.en} disabled={!admin} onChange={(e) => upd({ short: { ...tn.short, en: e.target.value } })} /></label>
            <label><span>{x.status}</span><select id="tn-status" className="select-in" value={tn.status} disabled={!admin} onChange={(e) => upd({ status: e.target.value as Tenant['status'] })}>{(['onboarding', 'active', 'ended'] as const).map((s) => <option key={s} value={s}>{tx(TENANT_STATUS_TITLE[s])}</option>)}</select></label>
            <label><span>{x.joined}</span><input type="date" dir="ltr" className="num" value={tn.joinedAt} disabled={!admin} onChange={(e) => upd({ joinedAt: e.target.value })} /></label>
            <label><span>{x.lang}</span><div className="segmented sm"><button type="button" aria-pressed={tn.lang === 'ar'} disabled={!admin} onClick={() => upd({ lang: 'ar' })}><span className="seg-txt">العربية</span></button><button type="button" aria-pressed={tn.lang === 'en'} disabled={!admin} onClick={() => upd({ lang: 'en' })}><span className="seg-txt">English</span></button></div></label>
            <label><span>{L.dz.basics.tone}</span><span className="chips">{(['green', 'gold', 'teal', 'bronze', 'sage', 'night'] as const).map((h) => <button key={h} type="button" className={`tn-emblem h-${h} ${tn.hue === h ? 'on' : ''}`} aria-pressed={tn.hue === h} disabled={!admin} onClick={() => upd({ hue: h })}>{tx(tn.initials)}</button>)}</span></label>
            <label><span>{x.contact}</span><select className="select-in" value={tn.contact || ''} disabled={!admin} onChange={(e) => upd({ contact: e.target.value || undefined })}><option value="">—</option>{people.map((p) => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name : p.nameEn}</option>)}</select></label>
            <label style={{ flexBasis: '100%' }}><span>{x.note}</span><input value={tn.note || ''} disabled={!admin} onChange={(e) => upd({ note: e.target.value || undefined })} /></label>
            {admin && tn.id !== 'GCC-SG' ? <EndDate endedAt={tn.endedAt} editable={admin} today={today} onChange={(endedAt) => upd({ endedAt })} t={t} lang={lang} /> : null}
          </div></Group></Item>
          <div className="section-label"><span>{x.erp}</span></div>
          <Item><Group><div className="ed-row dz-ed">
            <label style={{ flexBasis: '100%' }}><span>{x.erpMode}</span><div className="segmented sm"><button type="button" aria-pressed={tn.erp.mode === 'shared'} disabled={!admin} onClick={() => upd({ erp: { ...tn.erp, mode: 'shared' } })}><span className="seg-txt">{tx(ERP_MODE_TITLE.shared)}</span></button><button type="button" aria-pressed={tn.erp.mode === 'own'} disabled={!admin} onClick={() => upd({ erp: { ...tn.erp, mode: 'own' } })}><span className="seg-txt">{tx(ERP_MODE_TITLE.own)}</span></button></div></label>
            <label><span>{x.systemId}</span><input id="tn-sysid" className="mono" dir="ltr" value={tn.erp.systemId} disabled={!admin} onChange={(e) => upd({ erp: { ...tn.erp, systemId: e.target.value.toUpperCase().slice(0, 8) } })} /></label>
            <label><span>{x.client}</span><input className="mono num" dir="ltr" value={tn.erp.client} disabled={!admin} onChange={(e) => upd({ erp: { ...tn.erp, client: e.target.value.replace(/\D/g, '').slice(0, 3) } })} /></label>
            <label><span>{x.env}</span><div className="segmented sm">{ENVS.map((e: Env) => <button key={e} type="button" aria-pressed={tn.env === e} disabled={!admin} onClick={() => upd({ env: e })}><span className="seg-txt">{tx(ENV_TITLE[e])}</span></button>)}</div></label>
            <div style={{ flexBasis: '100%' }} className="tn-envs">{ENVS.map((e: Env) => { const ev = tn.erp.envs[e]; return <div key={e} className="tn-env"><b>{tx(ENV_TITLE[e])}</b><input dir="ltr" className="mono" placeholder="host" value={ev.host} disabled={!admin} onChange={(x2) => upd({ erp: { ...tn.erp, envs: { ...tn.erp.envs, [e]: { ...ev, host: x2.target.value } } } })} /><select className="select-in" value={ev.status} disabled={!admin} onChange={(x2) => upd({ erp: { ...tn.erp, envs: { ...tn.erp.envs, [e]: { ...ev, status: x2.target.value as typeof ev.status } } } })}>{(['unbound', 'bound', 'tested'] as const).map((s) => <option key={s} value={s}>{x.envStatus[s]}</option>)}</select></div>; })}</div>
          </div></Group></Item>
          <div className="section-label"><span>{x.admins} · {x.designers}</span></div>
          <Item><Group><div className="ed-row dz-ed">
            <div style={{ flexBasis: '100%' }}><PosPicker label={x.admins} ids={tn.admins} editable={admin} onChange={(admins) => upd({ admins })} /></div>
            <div style={{ flexBasis: '100%' }}>
              {tn.designers.map((d, i) => { const pos = state.org.positions.find((p) => p.id === d.positionId); return <div key={i} className="tn-designer"><b>{pos ? tx(pos.title) : d.positionId}</b><span className="chips">{DOMAINS.map((dm) => { const all = d.domains === 'all'; const on = all || (d.domains as string[]).includes(dm.id); return <button key={dm.id} type="button" className={`pill ${on ? 'tint' : ''}`} aria-pressed={on} disabled={!admin || all} onClick={() => upd({ designers: tn.designers.map((z, k) => (k === i ? { ...z, domains: on ? (z.domains as string[]).filter((q) => q !== dm.id) : [...(z.domains as string[]), dm.id] } : z)) })}>{dm.id}</button>; })}</span><Sw on={d.domains === 'all'} set={(v) => upd({ designers: tn.designers.map((z, k) => (k === i ? { ...z, domains: v ? 'all' : [] } : z)) })} label={x.allDomains} editable={admin} />{admin ? <button type="button" className="icon-btn" aria-label={L.dz.form.remove} onClick={() => upd({ designers: tn.designers.filter((_, k) => k !== i) })}><I.x /></button> : null}</div>; })}
              {admin ? <PosPicker label={x.addDesigner} ids={[]} editable={admin} onChange={(ids) => { const pid = ids[0]; if (pid && !tn.designers.some((d) => d.positionId === pid)) upd({ designers: [...tn.designers, { positionId: pid, domains: [] }] }); }} /> : null}
            </div>
          </div></Group></Item>
        </Stagger>
      ) : null}
      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title={x.add} lead={<span className="qicon g-teal" style={{ width: 40, height: 40, borderRadius: 13 }}><I.building /></span>}>
        <Group>
          <Field id="tn-key" label={x.key} hint={x.keyHint}><input id="tn-key" className="mono" dir="ltr" value={nw.key} onChange={(e) => setNw((z) => ({ ...z, key: tenantKey(e.target.value) }))} /></Field>
          <Field id="tn-ar" label={x.name}><input id="tn-ar" value={nw.ar} onChange={(e) => setNw((z) => ({ ...z, ar: e.target.value }))} /></Field>
          <Field id="tn-en" label={x.nameEn}><input id="tn-en" dir="ltr" value={nw.en} onChange={(e) => setNw((z) => ({ ...z, en: e.target.value }))} /></Field>
          <Field id="tn-sar" label={x.short}><input id="tn-sar" value={nw.shortAr} onChange={(e) => setNw((z) => ({ ...z, shortAr: e.target.value }))} /></Field>
          <Field id="tn-sen" label={x.shortEn}><input id="tn-sen" dir="ltr" value={nw.shortEn} onChange={(e) => setNw((z) => ({ ...z, shortEn: e.target.value }))} /></Field>
        </Group>
        <div style={{ height: 12 }} />
        <motion.button type="button" className="btn primary block lg" disabled={!nw.key || !nw.ar.trim() || !nw.en.trim() || tenants.some((z) => z.id === nw.key)} whileTap={{ scale: 0.97 }} onClick={create}><I.plus />{x.add}</motion.button>
      </Sheet>
    </div>
  );
}
