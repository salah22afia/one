/* جزيرة البحث (iOS 26): لوح يبحث في الخدمات الثماني والسبعين ويفتح الخدمة المتاحة أو مجالها */
import React, { useEffect, useState } from 'react';
import { nav } from '../app/router';
import { useLang, SearchField } from './components';
import { I } from './icons';
import { searchServices, mergeConfigured, VISIBLE_SERVICES } from '../app/search';
import { useStore } from '../app/store';
import { liveServices } from '../domain/designer';
import { useUI, BottomSheet } from '../app/ui';

/** لوح البحث من جزيرة البحث: يبحث في الخدمات الثماني والسبعين */
export function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { L } = useUI(); const { lang, t } = useLang(); const [q, setQ] = useState(''); const { state } = useStore();
  const list = mergeConfigured(VISIBLE_SERVICES, liveServices(state));
  const hits = q.trim() ? searchServices(q, 8, list) : [];
  useEffect(() => { if (!open) setQ(''); }, [open]);
  return (
    <BottomSheet open={open} onClose={onClose} title={L.searchIsland} tall>
      <SearchField id="uspq" value={q} onChange={setQ} placeholder={L.searchPh} autoFocus />
      <div className="lb-hits">
        {!q.trim() ? <p className="lb-muted">{L.searchHint}</p> : hits.length === 0 ? <p className="lb-muted">{L.noHits}</p> : hits.map((s) => (
          <button key={s.id} type="button" className="cell" onClick={() => { onClose(); nav(s.rec === 'w1' ? `#/new/${s.id}` : `#/services/${s.domain}`); }}>
            <span className={`cell-lead ${s.rec === 'w1' ? '' : 'plain'}`}><I.grid /></span>
            <span className="cell-main"><span className="cell-title">{lang === 'ar' ? s.name : s.nameEn || s.name}</span><span className="cell-sub">{s.rec === 'w1' ? t.services.available : s.rec === 'later' ? t.services.later : `${t.services.soon} · ${t.services.wave} ${s.rec === 'w2' ? 2 : 3}`}</span></span>
            <I.chev className="chev dirchev" />
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
