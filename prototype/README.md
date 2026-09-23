# بوابة الخدمات الموحدة — المصدر (أساس التجربة v0.3 «الحركة والمواد»)

- `npm install` ثم `npm run build` → `dist/index.html` (ملف واحد مكتمل) و`dist/artifact.html` (للنشر في Claude).
- `npm run dev` للتطوير المحلي، و`npm run typecheck` للتحقق من الأنواع.
- دليل الخدمات داخل التطبيق يُولَّد من `../catalog/data.js`: `node scripts/gen-catalog.mjs`.
- البنية: `src/domain` النموذج والمحرك · `src/app` المخزن والموجّه (يعرف اتجاه الانتقال) واللغة والبحث · `src/ui` المكونات والأيقونات و`motion.tsx` (مفردات الحركة: الشاشات، الجزيرة، اللوح، السحب، الحلقة، العدّاد، علامة الإتمام، البطاقة المائلة) · `src/screens` الشاشات · `src/styles` الرموز التصميمية والأنماط (`motion.css` للمواد والحركة).
- الحركة بمكتبة `motion` (نوابض)، وتُطفأ كلها مع تفضيل تقليل الحركة في النظام.
- الحالة محفوظة في localStorage (المفتاح `usp-portal-v1`)؛ رفع `STATE_VERSION` في `src/data/seed.ts` يعيد البذرة.
- لقطات التحقق: `node scripts/shot3.mjs` (كل الشاشات)، و`node scripts/interact.mjs` (السحب والجزيرة ولوحة الأوامر والإرسال والقلب)، و`node scripts/probe6.mjs` (كل المسارات مع تقليل الحركة وبدونه).
