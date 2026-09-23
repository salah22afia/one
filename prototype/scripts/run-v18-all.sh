#!/bin/bash
# جولة v0.18: حزمة مركز الإدارة والمعاينة، ثم النظرة العميقة (كل المناظر)، ثم جولة v0.16 كاملة على البناء الرسمي
cd "$(dirname "$0")/.."
mkdir -p shots/v18 shots/v17
node scripts/v18-admin.mjs shots/v18 > shots/v18/admin.log 2>&1
bash scripts/run-v17-all.sh
echo V18_DONE >> shots/v13/review.log
