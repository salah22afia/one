#!/bin/bash
cd /home/claude/work/employee-portal/portal
timeout 3000 node scripts/shot-v12.mjs > shots/v12/run-shot-v12-1.log 2>&1
echo "exit $?" >> shots/v12/run-shot-v12-1.log
