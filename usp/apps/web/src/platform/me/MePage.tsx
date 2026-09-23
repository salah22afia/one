/* "Me" (prototype screens/Me.tsx, C-UX-87): the digital card, then a grid of widgets that open their pages — each
   business module adds its own (My data, documents, balances, pay, family…), and Settings closes the grid. */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@usp/i18n';
import { I, MeTile, PageChrome, useUI } from '@usp/ui-web';
import { modules } from '../../app/registry';
import { IdCard } from './IdCard';

const WIDGETS = modules.flatMap((m) => m.meWidgets ?? []).sort((a, b) => a.order - b.order);

export default function MePage() {
  const { t } = useI18n(); const { desk } = useUI(); const navigate = useNavigate(); const [flipped, setFlipped] = useState(false);
  return (
    <PageChrome title={t('me.title')} root end={<button type="button" className="icon-btn" onClick={() => navigate('/me/settings')} aria-label={t('me.settings')}><I.gear /></button>}>
      <div className={desk ? 'me-desk' : ''}>
        <div className="me-card"><IdCard flipped={flipped} onFlip={() => setFlipped((f) => !f)} /></div>
        <div className="mw-grid" role="list">
          {WIDGETS.map((w, i) => <w.Component key={w.key} delay={0.04 * (i + 1)} />)}
          <MeTile to="/me/settings" icon="gear" title={t('me.settings')} sub={t('me.settingsSub')} delay={0.04 * (WIDGETS.length + 1)} />
        </div>
      </div>
    </PageChrome>
  );
}
