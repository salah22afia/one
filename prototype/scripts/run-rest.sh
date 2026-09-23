#!/bin/bash
# الانحدار السابق وحده (shot-v12 والتدفق البصري نُفِّذا وحدهما: 98/98 و44/44)؛ يُشغَّل في الخلفية بـ setsid nohup
cd /home/claude/work/employee-portal/portal
for s in shot-v82 shot-v8 shot-v7 shot-v6 shot-v5 shot-leave shot-picker shot-ops accept shot3 interact probe6 shot-en shot-desk; do
  echo "=== $s ==="
  timeout 900 node scripts/$s.mjs > dist/run-$s.log 2>&1; echo "exit $?"
  grep -c "^PASS" dist/run-$s.log | sed 's/^/PASS /'; grep -c "^FAIL" dist/run-$s.log | sed 's/^/FAIL /'; grep "^FAIL\|Error\|error" dist/run-$s.log | head -5 | cut -c1-300; tail -1 dist/run-$s.log | cut -c1-200
done
echo ALLDONE
