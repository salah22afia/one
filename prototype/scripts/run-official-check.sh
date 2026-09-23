#!/bin/bash
# تحقق سريع من الرسمية بعد إعادة الهيكلة (تصدير TaskDetail/IdCard/RequestActions/DocPreview): v12 وv7 وv82 وshot-desk
cd /home/claude/work/employee-portal/portal
for s in shot-v12 shot-v7 shot-v82 shot-desk; do
  echo "=== $s ==="
  timeout 2400 node scripts/$s.mjs > shots/v13/run-$s.log 2>&1; echo "exit $?"
  grep -c "^PASS" shots/v13/run-$s.log | sed 's/^/PASS /'; grep -c "^FAIL" shots/v13/run-$s.log | sed 's/^/FAIL /'; grep "^FAIL" shots/v13/run-$s.log | head -5 | cut -c1-300; tail -1 shots/v13/run-$s.log | cut -c1-200
done
echo ALLDONE
