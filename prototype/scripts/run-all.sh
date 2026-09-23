#!/bin/bash
cd /home/claude/work/employee-portal/portal
for s in overflow-audit shot-v12 shot-v82 shot-v8 shot-v7 shot-v6 shot-v5 shot-leave shot-picker shot-ops accept shot3 interact probe6 shot-en shot-desk; do
  echo "=== $s ===" 
  t=900; [ "$s" = "shot-v12" ] && t=3000
  timeout $t node scripts/$s.mjs > dist/run-$s.log 2>&1; echo "exit $?"
  grep -c "^PASS" dist/run-$s.log | sed 's/^/PASS /'; grep -c "^FAIL" dist/run-$s.log | sed 's/^/FAIL /'; grep "^FAIL\|Error\|error" dist/run-$s.log | head -5 | cut -c1-300; tail -1 dist/run-$s.log | cut -c1-200
done
echo ALLDONE
