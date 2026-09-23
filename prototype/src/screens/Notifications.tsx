/* «التنبيهات» في المختبر: خيوط لا سيل — تنبيهات الطلب الواحد تُجمع في صف واحد بآخر تحديث وعدّاد يُفتح على الخيط، وما لا طلب له صفٌّ وحده،
   والأقسام اليوم / هذا الأسبوع / سابقاً، وغير المقروء بنقطة (C-UX-88). */
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../app/store';
import { nav } from '../app/router';
import { I, type IconName } from '../ui/icons';
import { useLang, usePerson, Empty, useNow } from '../ui/components';
import { SPRING } from '../ui/motion';
import { notificationsFor, requestTitle } from '../domain/engine';
import { relTime, fill } from '../app/i18n';
import type { Notification, NotifKind } from '../domain/types';
import { useUI, useIntroSkip, Nb } from '../app/ui';
import { PageChrome } from '../ui/Page';

const KIND_ICON: Record<NotifKind, IconName> = { task: 'inbox', status: 'doc', document: 'seal', expiry: 'alert', reminder: 'clock', policy: 'shield', circular: 'seal', story: 'sparkle' };
const KIND_TONE: Record<NotifKind, string> = { task: '', status: '', document: 'gold', expiry: 'warn', reminder: 'warn', policy: 'gold', circular: 'gold', story: '' };
const REQ = /REQ-\d{4}-\d{4}/;

interface Thread { key: string; reqId?: string; items: Notification[]; latest: Notification; unread: number }
function threadsOf(list: Notification[]): Thread[] {
  const map = new Map<string, Thread>();
  for (const n of list) {
    const m = (n.link || '').match(REQ) || n.title.ar.match(REQ) || n.body.ar.match(REQ);
    const key = m ? `req:${m[0]}` : `one:${n.id}`;
    const t = map.get(key); if (t) { t.items.push(n); if (n.at > t.latest.at) t.latest = n; if (!n.read) t.unread++; }
    else map.set(key, { key, reqId: m ? m[0] : undefined, items: [n], latest: n, unread: n.read ? 0 : 1 });
  }
  return [...map.values()].sort((a, b) => b.latest.at - a.latest.at);
}

export function Notifications() {
  const { state, dispatch } = useStore(); const { lang, t, tx } = useLang(); const me = usePerson(); const now = useNow(); const { L } = useUI(); const reduce = useIntroSkip();
  const list = notificationsFor(state, me);
  const threads = useMemo(() => threadsOf(list), [list]);
  const [open, setOpen] = useState<string | null>(null);
  const sections: [string, Thread[]][] = [[t.notif.today, threads.filter((x) => now - x.latest.at < 86400000)], [L.pages.thisWeek, threads.filter((x) => now - x.latest.at >= 86400000 && now - x.latest.at < 7 * 86400000)], [L.pages.earlier, threads.filter((x) => now - x.latest.at >= 7 * 86400000)]];
  const go = (n: Notification) => { dispatch({ type: 'read', id: n.id }); if (n.link) nav(n.link); };
  const unread = list.filter((n) => !n.read).length;
  const reqName = (id?: string) => { const r = id ? state.requests.find((x) => x.id === id) : undefined; return r ? tx(requestTitle(r)) : ''; };
  return (
    <PageChrome title={t.notif.title} back="#/home" end={unread ? <button type="button" className="btn quiet sm" onClick={() => dispatch({ type: 'readAll', personId: me.id })}>{t.notif.markAll}</button> : undefined}>
      {list.length === 0 ? <div className="lb-empty"><Empty icon="bell" title={L.pages.noNotifs} sub={L.pages.noNotifsSub} /></div> : sections.map(([label, ths]) => ths.length === 0 ? null : (
        <section key={label} className="lb-sec-list">
          <div className="lb-head"><h2>{label}</h2></div>
          <div className="nt-list" role="list">
            {ths.map((th, i) => { const n = th.latest; const Ic = I[KIND_ICON[n.kind]]; const many = th.items.length > 1; const isOpen = open === th.key; return (
              <motion.div key={th.key} className={`nt ${th.unread ? 'unread' : ''} ${isOpen ? 'open' : ''}`} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: i * 0.03 }} role="listitem">
                <button type="button" className="nt-row" onClick={() => (many ? setOpen(isOpen ? null : th.key) : go(n))}>
                  <span className={`cell-lead ${KIND_TONE[n.kind]}`}><Ic /></span>
                  <span className="nt-txt"><b><Nb s={tx(n.title)} /></b><span>{many ? <>{reqName(th.reqId)} · <span className="mono">{th.reqId}</span> · {th.items.length === 2 ? L.pages.updatesTwo : fill(L.pages.updates, { n: th.items.length })}</> : <Nb s={tx(n.body)} />}</span></span>
                  <span className="nt-trail"><span className="nt-when">{relTime(n.at, lang, now)}</span>{th.unread ? <span className="nt-dot" /> : null}{many ? <I.chevDown className={`lb-chev ${isOpen ? 'up' : ''}`} /> : null}</span>
                </button>
                <AnimatePresence initial={false}>{many && isOpen ? (
                  <motion.div className="nt-thread" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }} style={{ overflow: 'hidden' }}>
                    {th.items.slice().sort((a, b) => b.at - a.at).map((x) => { const Xi = I[KIND_ICON[x.kind]]; return (
                      <button key={x.id} type="button" className={`nt-item ${x.read ? '' : 'unread'}`} onClick={() => go(x)}><span className="nt-item-ic"><Xi /></span><span className="nt-txt"><b><Nb s={tx(x.title)} /></b><span><Nb s={tx(x.body)} /></span></span><span className="nt-when">{relTime(x.at, lang, now)}</span></button>
                    ); })}
                  </motion.div>
                ) : null}</AnimatePresence>
              </motion.div>
            ); })}
          </div>
        </section>
      ))}
      <p className="lb-muted lb-foot-note"><a className="lb-link" href="#/me/settings">{L.pages.whatYouGet}</a></p>
    </PageChrome>
  );
}
