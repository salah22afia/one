import React from 'react';
import { useStore } from '../app/store';
import { I } from '../ui/icons';
import { Cell, Empty, Group, LargeTitle, Notice, Pill, TopBar, useLang, usePerson } from '../ui/components';
import { Stagger, Item, Ticker } from '../ui/motion';
import { myCustody, needContent, categoryOf } from '../domain/need';
import { fmtDate } from '../app/i18n';
import type { CustodyEntry } from '../domain/types';

/* ——— v0.9 «عهدتي» (D-019): ما سُلِّم إلى الموظف وقُيِّد في عهدته بسند تسليم واستلام — يُقرأ من سجل العهدة في البوابة (مرآة أصول النظام المرجعي) ——— */
function CustodyRow({ c }: { c: CustodyEntry }) {
  const { state } = useStore(); const { lang, t, tx } = useLang();
  const item = c.itemId ? state.erp.items.find((x) => x.id === c.itemId) : undefined; const r = state.requests.find((x) => x.id === c.requestId);
  const cat = r?.need ? categoryOf(needContent(state), r.need.categoryId) : undefined; const Ic = item ? (I[item.icon as keyof typeof I] || I.box) : I.box;
  return (
    <a className="custody-card" href={`#/requests/${c.requestId}`}>
      <span className={`qicon ${cat?.tone || 'g-sage'}`}><Ic /></span>
      <span className="cc-main"><b>{tx(c.name)} <span className="num">× {c.qty}</span></b><span className="cell-sub">{c.digital ? <>{t.need.custody.digital}{c.ref ? <> · {t.need.custody.ref} <span className="mono">{c.ref}</span></> : null}</> : <>{t.need.custody.asset} <span className="mono">{c.assetNo}</span></>} · {t.need.custody.by} <span className="mono">{c.handoverNo}</span>{item?.specs ? ` · ${tx(item.specs)}` : ''}</span><span className="cc-foot"><Pill tone="gold" icon="seal">{t.need.custody.since} {fmtDate(c.at, lang, { day: 'numeric', month: 'short', year: 'numeric' })}</Pill><span className="cell-sub mono">{c.requestId}</span></span></span>
      <I.chev className="chev dirchev" style={{ width: 18, height: 18, color: 'var(--fg-4)', flex: 'none' }} />
    </a>
  );
}

export function Custody() {
  const { state } = useStore(); const { lang, t } = useLang(); const me = usePerson();
  const list = myCustody(state, me.id); const oldest = list.length ? Math.min(...list.map((c) => c.at)) : null;
  return (
    <div className="page view">
      <TopBar title={t.need.custody.title} back="#/me" />
      <LargeTitle title={t.need.custody.title} sub={t.need.custody.sub} />
      <Stagger className="custody-sum" delay={0.1}>
        <Item><div className="tile soft"><b className="num"><Ticker value={list.length} delay={0.2} /></b><span>{t.need.custody.countLabel}</span></div></Item>
        <Item><div className="tile"><b className="num">{oldest ? fmtDate(oldest, lang, { month: 'short', year: 'numeric' }) : '—'}</b><span>{t.need.custody.since}</span></div></Item>
      </Stagger>
      <Stagger delay={0.2}>
        <Group>{list.length === 0 ? <Empty icon="seal" title={t.need.custody.empty} /> : list.map((c) => <Item key={c.id}><CustodyRow c={c} /></Item>)}</Group>
        <div style={{ height: 12 }} />
        <Item><Notice icon="info">{lang === 'ar' ? 'سجل العهدة في البوابة مرآة لسجل الأصول في النظام المرجعي: كل بند هنا له رقم أصل ومستند صرف وسند تسليم واستلام بتوقيع الطرفين. إرجاع العهدة ونقلها إجراء لاحق (AS-02).' : 'The custody register in the portal mirrors the asset register in the system of record: every line here has an asset number, an issue document and a handover note with both signatures. Returning or transferring custody is a later process (AS-02).'}</Notice></Item>
      </Stagger>
    </div>
  );
}

/** معاينة في «ملفي»: آخر بنود العهدة ورابط السجل كاملاً */
export function CustodyPreview() {
  const { state } = useStore(); const { t } = useLang(); const me = usePerson();
  const list = myCustody(state, me.id).slice(0, 3);
  if (!list.length) return <Group><Cell icon="seal" tone="plain" title={t.need.custody.empty} chevron={false} /></Group>;
  return <Group>{list.map((c) => <Item key={c.id}><CustodyRow c={c} /></Item>)}</Group>;
}
