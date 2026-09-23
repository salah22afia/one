/* إطار الصفحة في المختبر: على الهاتف صفٌّ علوي (رجوع أو الصورة الرمزية · شعار الأمانة في الوسط · فعل) وعنوان كبير 34pt يصير 17pt في شريط زجاجي عند التمرير (iOS 26)؛
   على الحاسوب صف عنوان بفعله. الشعار يظهر مرة واحدة في أعلى كل جذر لسان (C-UX-82). */
import React from 'react';
import { motion, useTransform } from 'motion/react';
import { nav } from '../app/router';
import { I } from './icons';
import { useLang, usePerson, Avatar } from './components';
import emblem from '../assets/emblem.png';
import { useUI, useScrollY } from '../app/ui';

export function Mark({ size = 30, className = '' }: { size?: number; className?: string }) {
  return <img className={`lb-mark ${className}`} src={emblem} alt="" width={size} height={size} draggable={false} />;
}

export function PageChrome({ title, sub, back, end, children, className = '', root = false, wideActions }: { title: string; sub?: string; back?: string; end?: React.ReactNode; children: React.ReactNode; className?: string; root?: boolean; wideActions?: React.ReactNode }) {
  const { wide } = useUI(); const { t } = useLang(); const me = usePerson();
  /* العنوان الكبير يخفت حتى 56px ثم يظهر الصغير في الشريط الزجاجي بعدها — لا يظهران معاً */
  const y = useScrollY(); const barO = useTransform(y, [56, 100], [0, 1]); const barY = useTransform(y, [56, 100], [-6, 0]); const titleO = useTransform(y, [0, 56], [1, 0]);
  /* الشريط الزجاجي يستقبل اللمس حين يكون ظاهراً فقط (وإلا يمرّ اللمس إلى ما تحته)، وزر الرجوع فيه يبقى في متناول الإبهام بعد التمرير كما في iOS */
  const barPE = useTransform(barO, (v) => (v > 0.6 ? 'auto' : 'none'));
  return (
    <div className={`lb-page lp ${root ? 'root' : ''} ${className}`}>
      {!wide && (
        <motion.div className="lb-topbar lp-bar" style={{ opacity: barO, y: barY, pointerEvents: barPE }} aria-hidden="true">
          <span className="lp-slot start">{back !== undefined ? <button type="button" className="back-btn" tabIndex={-1} onClick={() => nav(back)}><I.chev className="backchev" />{t.nav.back}</button> : null}</span>
          <b className="lp-bar-t">{title}</b>
          <span className="lp-slot end" />
        </motion.div>
      )}
      {!wide ? (
        <div className="lp-top">
          <span className="lp-slot start">{back !== undefined ? <motion.button type="button" className="back-btn" whileTap={{ scale: 0.94 }} onClick={() => nav(back)}><I.chev className="backchev" />{t.nav.back}</motion.button> : root ? <motion.button type="button" className="icon-btn lp-me" onClick={() => nav('#/me')} aria-label={t.tabs.me} whileTap={{ scale: 0.9 }}><Avatar p={me} size="sm" /></motion.button> : null}</span>
          <Mark />
          <span className="lp-slot end">{end}</span>
        </div>
      ) : null}
      <motion.div className="lp-head" style={{ opacity: wide ? 1 : titleO }}>
        <div className="lp-head-txt"><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>
        {wide ? <div className="lp-head-act">{wideActions ?? end}</div> : null}
      </motion.div>
      {children}
    </div>
  );
}
