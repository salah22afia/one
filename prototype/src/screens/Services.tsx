/* «الخدمات» في المختبر: تبدأ بالبحث، ثم «ابدأ الآن» شريط بطاقات لما هو متاح، ثم المجالات صفوفاً مضغوطة بعمودين (C-UX-86)؛
   صفحة المجال ونتائج البحث من الشاشة الرسمية داخل إطار المختبر. */
import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { nav } from '../app/router';
import { DOMAINS, type Service } from '../data/catalog';
import { searchServices, VISIBLE_SERVICES, mergeConfigured } from '../app/search';
import { useStore } from '../app/store';
import { liveServices } from '../domain/designer';
import { I } from '../ui/icons';
import { useLang, SearchField, Pill, Empty, Notice, Group } from '../ui/components';
import { SPRING } from '../ui/motion';
import { fill } from '../app/i18n';
import { useUI, Rail, BottomSheet, useIntroSkip } from '../app/ui';
import { PageChrome } from '../ui/Page';

export const DOMAIN_ICON: Record<string, keyof typeof I> = { TM: 'leave', MD: 'idcard', DC: 'letter', HA: 'team', FN: 'wallet', MI: 'shield', GR: 'passport', TD: 'sparkle', LC: 'person', AS: 'box', PR: 'grid', BG: 'balance', GV: 'calendar', SY: 'gear', EV: 'bell', WP: 'home' };
export const DOMAIN_TONE: Record<string, string> = { TM: 'g-green', MD: 'g-gold', DC: 'g-bronze', HA: 'g-sage', FN: 'g-teal', AS: 'g-bronze', PR: 'g-gold', GV: 'g-green' };

export function Services({ domainId, initialQuery }: { domainId?: string; initialQuery?: string }) {
  const { lang, t } = useLang(); const { L, desk } = useUI(); const reduce = useReducedMotion(); const skip = useIntroSkip(); const { state } = useStore();
  const [q, setQ] = useState(initialQuery || ''); const [coming, setComing] = useState<Service | null>(null);
  /* v0.15: الخدمات المهيّأة السارية متاحة كالمبنيّة؛ الموظف لا يفرّق (المبدأ 6) */
  const cfg = liveServices(state); const ALL = useMemo(() => mergeConfigured(VISIBLE_SERVICES, cfg), [cfg]);
  const name = (s: Service) => (lang === 'ar' ? s.name : s.nameEn || s.name);
  const results = useMemo(() => (q.trim() ? searchServices(q, 12, ALL) : []), [q, ALL]);
  const available = useMemo(() => ALL.filter((s) => s.rec === 'w1'), [ALL]);
  const openService = (s: Service) => { if (s.rec === 'w1') nav(`#/new/${s.id}`); else setComing(s); };
  const wavePill = (s: Service) => s.rec === 'w1' ? <Pill tone="tint">{t.services.available}</Pill> : s.rec === 'later' ? <Pill>{t.services.later}</Pill> : <Pill>{t.services.soon} · {t.services.wave} {s.rec === 'w2' ? 2 : 3}</Pill>;
  const row = (s: Service) => { const Ic = I[DOMAIN_ICON[s.domain] || 'grid']; return <button key={s.id} type="button" className={`lrow ${s.rec === 'w1' ? '' : 'dim'}`} onClick={() => openService(s)} role="listitem"><span className={`qicon ${s.rec === 'w1' ? DOMAIN_TONE[s.domain] || 'g-green' : 'g-plain'} sv-ic`}><Ic /></span><span className="lrow-txt"><b>{name(s)}</b><span>{s.scope}</span></span><span className="lrow-trail">{wavePill(s)}<I.chev className="dirchev" /></span></button>; };
  const comingSheet = (
    <BottomSheet open={!!coming} onClose={() => setComing(null)} title={coming ? name(coming) : ''}>
      {coming && (<>
        <p className="lb-muted">{coming.scope}</p>
        <Notice tone="tint" icon="clock">{t.services.comingBody} {coming.rec === 'later' ? t.services.later : `${t.services.wave} ${coming.rec === 'w2' ? 2 : 3}`}.</Notice>
        <div style={{ height: 10 }} />
        <Group><div className="summary-row"><span className="k">{t.services.requestFrom}</span><span className="v">{coming.requester.join('، ')}</span></div><div className="summary-row"><span className="k">{t.services.endsIn}</span><span className="v">{coming.target}</span></div></Group>
        <div style={{ height: 12 }} />
        <button type="button" className="btn secondary block" onClick={() => setComing(null)}><I.bell />{t.services.notify}</button>
      </>)}
    </BottomSheet>
  );
  if (domainId) {
    const d = DOMAINS.find((x) => x.id === domainId); const list = ALL.filter((s) => s.domain === domainId);
    return (
      <PageChrome title={d ? (lang === 'ar' ? d.name : d.nameEn) : t.services.title} sub={d?.desc} back="#/services">
        {d ? <section className="lb-sec-list"><div className="lrow-list" role="list">{list.map(row)}</div></section>
          : <div className="lb-empty"><Empty icon="grid" title={L.notFoundDomain} sub={L.notFoundDomainSub} /></div>}
        {comingSheet}
      </PageChrome>
    );
  }
  return (
    <PageChrome title={t.services.title} root>
      <div className="sv-search"><SearchField id="lbsvq" value={q} onChange={setQ} placeholder={L.pages.searchServices} /></div>
      {q.trim() ? (
        results.length === 0 ? <div className="lb-empty"><Empty icon="search" title={t.services.noResults} sub={t.services.noResultsSub} /></div> : (
          <section className="lb-sec-list"><div className="lb-head"><h2>{results.length} {t.services.count}</h2></div>
            <div className="lrow-list" role="list">{results.map(row)}</div>
          </section>
        )
      ) : (
        <>
          <section className="lb-sec-list">
            <div className="lb-head"><h2>{L.pages.startNow}</h2><span className="lb-muted">{available.length} {t.services.count}</span></div>
            {desk ? (
              <div className="sv-grid">{available.map((s, i) => <SvCard key={s.id} s={s} i={i} name={name(s)} onOpen={() => openService(s)} reduce={!!reduce} skip={skip} />)}</div>
            ) : (
              <Rail className="sv-rail" ariaLabel={L.pages.startNow}>{available.map((s, i) => <SvCard key={s.id} s={s} i={i} name={name(s)} onOpen={() => openService(s)} reduce={!!reduce} skip={skip} />)}</Rail>
            )}
          </section>
          <section className="lb-sec-list">
            <div className="lb-head"><h2>{t.services.domains}</h2><span className="lb-muted">{fill(L.pages.services, { n: ALL.length })}</span></div>
            <div className="dm-grid" role="list">
              {DOMAINS.map((d, i) => { const n = ALL.filter((s) => s.domain === d.id).length; if (!n) return null; const Ic = I[DOMAIN_ICON[d.id] || 'grid']; return (
                <motion.a key={d.id} className="dm" href={`#/services/${d.id}`} role="listitem" initial={skip ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 0.1 + i * 0.025 }} whileTap={{ scale: 0.97 }}>
                  <span className={`qicon ${DOMAIN_TONE[d.id] || 'g-sage'} dm-ic`}><Ic /></span><span className="dm-txt"><b>{lang === 'ar' ? d.name : d.nameEn}</b><span>{n} {t.services.count}</span></span><I.chev className="dirchev dm-chev" />
                </motion.a>
              ); })}
            </div>
          </section>
        </>
      )}
      {comingSheet}
    </PageChrome>
  );
}

function SvCard({ s, i, name, onOpen, reduce, skip }: { s: Service; i: number; name: string; onOpen: () => void; reduce: boolean; skip: boolean }) {
  const Ic = I[DOMAIN_ICON[s.domain] || 'grid'];
  return (
    <motion.button type="button" className="sv" onClick={onOpen} initial={skip ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 0.05 + i * 0.04 }} whileTap={{ scale: 0.96 }} whileHover={reduce ? undefined : { y: -2 }}>
      <span className={`qicon ${DOMAIN_TONE[s.domain] || 'g-green'} sv-ic`}><Ic /></span>
      <b>{name}</b>
      <span>{s.scope}</span>
    </motion.button>
  );
}
