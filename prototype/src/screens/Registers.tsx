/* v0.16 السجلات المخصصة (خريطة الحالات 4.8 و4.9 و9.4): ما أصدرته الخدمات المهيّأة من قيود باسم الموظفين — لمدير النظام شاشة بحث ومرشّح وتصدير CSV لكل سجل،
   وللموظف «سجلاتي» في ملفه بتاريخ الانتهاء وزر التجديد إلى خدمة التجديد. */
import React, { useMemo, useState } from 'react';
import { useStore } from '../app/store';
import { nav } from '../app/router';
import { I } from '../ui/icons';
import { Group, LargeTitle, Notice, Pill, Segmented, TopBar, SearchField, useLang, usePerson, useToast, Empty } from '../ui/components';
import { Stagger, Item, Press } from '../ui/motion';
import { registerIds, registerEntries, myRegisterEntries, renewServiceFor, configuredById, allFields } from '../domain/designer';
import { toISO, addDays } from '../domain/policy';
import { personById } from '../domain/engine';
import { useUI } from '../app/ui';
import { fill, fmtDate } from '../app/i18n';
import { norm } from '../app/search';
import type { RegisterEntry } from '../domain/types';
import { AdminNav } from './AdminCenter';

const statusTone = (s: RegisterEntry['status']) => (s === 'active' ? 'ok' : s === 'expired' ? 'danger' : s === 'renewed' ? 'tint' : '');

export function EntryRow({ e, showPerson }: { e: RegisterEntry; showPerson?: boolean }) {
  const { state } = useStore(); const { lang, tx } = useLang(); const { L } = useUI(); const x = L.dz.v16.registers;
  const p = personById(state, e.personId); const renew = renewServiceFor(state, e); const svc = configuredById(state, e.serviceId); const fields = svc ? allFields(svc) : [];
  const cols = Object.entries(e.values).slice(0, 3).map(([k, v]) => `${tx(fields.find((f) => f.id === k)?.label) || k}: ${v}`);
  return (
    <div className="cell stacked rg-row">
      <span className="dz-row-main"><span className={`cell-lead ${e.status === 'active' ? 'ok' : 'plain'}`}><I.book /></span><span className="cell-main"><span className="cell-title">{tx(e.title)}<span className="mono cell-code">{e.id}</span></span><span className="cell-sub">{showPerson && p ? `${lang === 'ar' ? p.name : p.nameEn} · ` : ''}{cols.join(' · ')}</span></span></span>
      <span className="dz-row-meta"><Pill tone={statusTone(e.status)}>{x.status[e.status]}</Pill>{e.expiresAt ? <Pill tone={e.status === 'active' && e.expiresAt <= addDays(toISO(Date.now()), 30) ? 'warn' : ''} icon="clock">{x.expires} {e.expiresAt}</Pill> : null}<Pill>{x.issued} {fmtDate(e.issuedAt, lang, { day: 'numeric', month: 'short' })}</Pill>{e.docNumber ? <Pill icon="seal"><span className="mono">{e.docNumber}</span></Pill> : null}
        <a className="btn quiet sm" href={`#/requests/${e.requestId}`}><I.open />{x.request}</a>
        {renew && e.status !== 'renewed' ? <a className="btn soft sm rg-renew" href={`#/new/${renew.id}/renew/${e.id}`}><I.reset />{x.renew}</a> : null}
      </span>
    </div>
  );
}

export function RegistersCenter({ id }: { id?: string }) {
  const { state } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const toast = useToast(); const { L } = useUI(); const x = L.dz.v16.registers;
  const regs = registerIds(state); const cur = id ? regs.find((r) => r.id === id) : undefined;
  const [q, setQ] = useState(''); const [filter, setFilter] = useState<'all' | 'active' | 'soon'>('all');
  const entries = useMemo(() => { if (!cur) return []; const n = norm(q.trim()); const soon = addDays(toISO(Date.now()), 30); return registerEntries(state, cur.id).filter((e) => (filter === 'all' || (filter === 'active' ? e.status === 'active' : e.status === 'active' && !!e.expiresAt && e.expiresAt <= soon)) && (!n || norm(`${Object.values(e.values).join(' ')} ${personById(state, e.personId)?.name || ''} ${e.id} ${e.requestId}`).includes(n))); }, [state, cur, q, filter]);
  const exportCsv = () => { if (!cur) return; const svc = configuredById(state, cur.services[0]); const fields = svc ? allFields(svc) : []; const keys = Array.from(new Set(entries.flatMap((e) => Object.keys(e.values)))); const head = ['id', x.person, x.request, x.status.active, x.issued, x.expires, ...keys.map((k) => tx(fields.find((f) => f.id === k)?.label) || k)]; const rows = entries.map((e) => [e.id, personById(state, e.personId)?.name || e.personId, e.requestId, x.status[e.status], toISO(e.issuedAt), e.expiresAt || '', ...keys.map((k) => e.values[k] || '')]); const csv = '﻿' + [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `${cur.id}-${toISO(Date.now())}.csv`; a.click(); toast({ title: x.exported, sub: a.download, icon: 'download', tone: 'ok' }); };
  if (me.persona !== 'admin') return <div className="page view policy npc"><TopBar title={x.title} back="#/me" /><Notice tone="warn" icon="info">{t.policy.onlyAdmin}</Notice></div>;
  if (!cur) return (
    <div className="page view policy npc dzc">
      <TopBar title={x.title} back="#/admin" />
      <LargeTitle title={x.title} sub={x.sub} />
      <AdminNav />
      {regs.length ? <Stagger className="pt-grid" step={0.035}>{regs.map((r) => { const n = registerEntries(state, r.id).length; return <Item key={r.id}><Press className="pt-card" onClick={() => nav(`#/admin/registers/${r.id}`)} lift><span className="qicon g-sage"><I.book /></span><span className="pt-body"><b>{tx(r.title)} <span className="mono cell-code">{r.id}</span></b><span className="pt-meta"><Pill tone="tint">{n === 1 ? x.entry1 : fill(x.entries, { n })}</Pill>{r.services.map((s) => <Pill key={s}>{s}</Pill>)}</span></span><I.chev className="chev dirchev" /></Press></Item>; })}</Stagger> : <Group><Empty icon="book" title={x.noEntries} /></Group>}
    </div>
  );
  return (
    <div className="page view policy npc dzc">
      <TopBar title={tx(cur.title)} back="#/admin/registers" end={<button type="button" className="icon-btn" aria-label={x.export} title={x.export} onClick={exportCsv}><I.download /></button>} />
      <LargeTitle title={tx(cur.title)} sub={`${cur.id} · ${cur.services.join(', ')}`} />
      <div className="dz-tools"><SearchField id="rgq" value={q} onChange={setQ} placeholder={x.search} /><Segmented id="rgf" value={filter} onChange={setFilter} options={[{ v: 'all', label: x.all }, { v: 'active', label: x.activeOnly }, { v: 'soon', label: x.expiringSoon }]} /></div>
      <div style={{ height: 10 }} />
      {entries.length ? <Group>{entries.map((e) => <EntryRow key={e.id} e={e} showPerson />)}</Group> : <Group><Empty icon="book" title={x.noEntries} /></Group>}
      <p className="cell-sub" style={{ padding: '8px 4px' }}>{lang === 'ar' ? `${entries.length} من ${registerEntries(state, cur.id).length}` : `${entries.length} of ${registerEntries(state, cur.id).length}`}</p>
    </div>
  );
}

/** «سجلاتي» للموظف: داخل «ملفي» */
export function MyRegisters() {
  const { state } = useStore(); const me = usePerson(); const { L } = useUI(); const x = L.dz.v16.registers;
  const mine = myRegisterEntries(state, me.id);
  if (!mine.length) return null;
  return (
    <>
      <div className="section-head"><h2>{x.mine}</h2><span className="lb-muted">{x.mineSub}</span></div>
      <Group>{mine.map((e) => <EntryRow key={e.id} e={e} />)}</Group>
    </>
  );
}
