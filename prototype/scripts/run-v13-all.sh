#!/bin/bash
# جولة v0.13 الكاملة: حِزم التحقق ثم النظرة الشاملة على البناء الرسمي
cd "$(dirname "$0")/.."
mkdir -p shots/v13
node scripts/v13-verify.mjs > shots/v13/verify.log 2>&1
node scripts/v13-motion.mjs > shots/v13/motion.log 2>&1
node scripts/v13-pages.mjs shots/v13-pages > shots/v13/pages.log 2>&1
node scripts/v13-shots.mjs > shots/v13/shots.log 2>&1
node scripts/v13-media.mjs > shots/v13/media.log 2>&1
node scripts/v13-review.mjs > shots/v13/review.log 2>&1
echo ALL_DONE >> shots/v13/review.log
