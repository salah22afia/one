#!/bin/bash
# جولة v0.17: النظرة العميقة (لقطات وكواشف) ثم جولة v0.16 كاملة على البناء الرسمي
cd "$(dirname "$0")/.."
mkdir -p shots/v17
node scripts/v17-deeplook.mjs shots/v17 > shots/v17/deeplook.log 2>&1
bash scripts/run-v16-all.sh
echo V17_DONE >> shots/v13/review.log
