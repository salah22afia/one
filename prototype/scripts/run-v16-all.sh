#!/bin/bash
# جولة v0.16: المصمّم الكامل + جولة v0.15 + وسائط المنشور + حِزم «اليوم» كلها على البناء الرسمي
cd "$(dirname "$0")/.."
mkdir -p shots/v13 shots/v14 shots/v15 shots/v16
node scripts/v16-designer.mjs > shots/v16/designer.log 2>&1
node scripts/v15-designer.mjs > shots/v15/designer.log 2>&1
node scripts/v14-postmedia.mjs > shots/v14/postmedia.log 2>&1
node scripts/v13-verify.mjs > shots/v13/verify.log 2>&1
node scripts/v13-motion.mjs > shots/v13/motion.log 2>&1
node scripts/v13-pages.mjs shots/v13-pages > shots/v13/pages.log 2>&1
node scripts/v13-shots.mjs > shots/v13/shots.log 2>&1
node scripts/v13-media.mjs > shots/v13/media.log 2>&1
node scripts/v13-review.mjs > shots/v13/review.log 2>&1
echo ALL_DONE >> shots/v13/review.log
