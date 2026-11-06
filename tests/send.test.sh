#!/usr/bin/env bash
# Проверка send.php на локальном PHP-сервере
set -u
cd "$(dirname "$0")/.."
PORT=8765
php -S 127.0.0.1:$PORT >/dev/null 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null' EXIT
for i in $(seq 1 30); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.1; done

fail=0
check() { # name expected_code expected_substring curl-args...
  local name=$1 code=$2 sub=$3; shift 3
  local out; out=$(curl -s -w '\n%{http_code}' "$@" "http://127.0.0.1:$PORT/send.php")
  local got=${out##*$'\n'} body=${out%$'\n'*}
  if [ "$got" = "$code" ] && [[ "$body" == *"$sub"* ]]; then echo "ok   $name ($got)"; else echo "FAIL $name: got $got '$body', want $code '$sub'"; fail=1; fi
}

check "GET → 405"           405 '"ok":false'
check "empty name → 422"    422 'invalid'          --data-urlencode 'name=' --data-urlencode 'phone=123'
check "short phone → 422"   422 'invalid'          --data-urlencode 'name=Анна' --data-urlencode 'phone=12345'
check "long name → 422"     422 'invalid'          --data-urlencode "name=$(printf 'а%.0s' $(seq 1 101))" --data-urlencode 'phone=+7 999 123-45-67'
check "honeypot → fake ok"  200 '"ok":true'        --data-urlencode 'name=Анна' --data-urlencode 'phone=+7 999 123-45-67' --data-urlencode 'website=spam'
check "not configured → 500" 500 'not_configured'  --data-urlencode 'name=Анна' --data-urlencode 'phone=+7 999 123-45-67'

php -l send.php | grep -q 'No syntax errors' && echo "ok   php -l" || { echo "FAIL php -l"; fail=1; }

[ $fail = 0 ] && echo "SEND: ALL PASS" || { echo "SEND: FAILED"; exit 1; }
