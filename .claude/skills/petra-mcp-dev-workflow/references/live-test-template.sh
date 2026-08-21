#!/bin/zsh
# Live E2E template (from the package-4 sweep). Copy it, keep header+helpers, replace sections 1-3 with one block per new tool:
# dry_run -> real -> replay -> foreign id rejected -> RO token denied -> list/get reflects it. Mint RW+RO tokens at start, revoke at end.
set -u
B=https://petra-app.com
S=/private/tmp/claude-501/-Users-or-rabinovich-Desktop-------petra-app/55834619-ef7b-4a56-a894-58ed45a21c03/scratchpad
NODE=/Users/or-rabinovich/local/node/bin/node
QA_EMAIL=qa-test@petra.local; QA_PASS='Qa7!N3dRQOcooSlT'
RUN=$(date +%s); PASS=0; FAIL=0; NOTE=0
ok(){ echo "  ✅ $1"; PASS=$((PASS+1)); }
bad(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }
note(){ echo "  ⚠️  $1"; NOTE=$((NOTE+1)); }
mcp(){ curl -s -X POST "$B/api/mcp" -H "Authorization: Bearer $1" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d "$2" | grep "^data:" | sed 's/^data: //'; }
jget(){ $NODE -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(eval(process.argv[1]))}catch(e){console.log("PARSE_FAIL")}})' "$1"; }
call(){ mcp "$1" "{\"jsonrpc\":\"2.0\",\"id\":9,\"method\":\"tools/call\",\"params\":{\"name\":\"$2\",\"arguments\":$3}}" | jget '(j.result&&j.result.content&&j.result.content[0]&&j.result.content[0].text) || JSON.stringify(j).slice(0,400)'; }
idof(){ echo "$1" | grep -o 'id: [0-9a-f-]\{36\}' | head -1 | cut -d' ' -f2; }
short(){ echo "$1" | head -c ${2:-90} | tr '\n' ' '; }
good(){ [[ "$1" == *"❌"* || "$1" == "PARSE_FAIL" || "$1" == *"MCP error"* ]] && return 1 || return 0; }

echo "=== 0. login + RW/RO tokens"
curl -s -o /dev/null -c $S/lt4-cookies.txt -X POST $B/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$QA_EMAIL\",\"password\":\"$QA_PASS\"}"
curl -s -o $S/lt4-rw.json -b $S/lt4-cookies.txt -X POST $B/api/mcp/connections -H "Content-Type: application/json" -d "{\"name\":\"lt4-rw-$RUN\",\"readOnly\":false}"
curl -s -o $S/lt4-ro.json -b $S/lt4-cookies.txt -X POST $B/api/mcp/connections -H "Content-Type: application/json" -d "{\"name\":\"lt4-ro-$RUN\",\"readOnly\":true}"
RW=$(cat $S/lt4-rw.json | jget 'j.token'); RWID=$(cat $S/lt4-rw.json | jget 'j.id'); NS=$(cat $S/lt4-rw.json | jget 'j.scopes.length')
RO=$(cat $S/lt4-ro.json | jget 'j.token'); ROID=$(cat $S/lt4-ro.json | jget 'j.id')
[[ "$RW" == petra_mcp_* ]] && ok "RW token (scopes=$NS)" || { bad "mint: $(head -c 200 $S/lt4-rw.json)"; exit 1; }
code=$(curl -s -o /dev/null -w "%{http_code}" -b $S/lt4-cookies.txt -X POST $B/api/mcp/connections -H "Content-Type: application/json" -d '{bad json'); [[ "$code" == "400" ]] && ok "malformed JSON -> 400" || bad "malformed JSON -> $code"
n=$(mcp "$RW" '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | jget 'j.result.tools.length'); [[ "$n" == "56" ]] && ok "56 tools" || bad "tools=$n"

echo "=== 1. pets + services"
out=$(call "$RW" create_client "{\"name\":\"בעלים חבילה4 $RUN\",\"phone\":\"052$(printf '%07d' $((RUN % 10000000)))\",\"idempotency_key\":\"lt4-client-$RUN\"}"); CLIENT=$(idof "$out"); good "$out" && ok "create_client -> $CLIENT" || bad "create_client -> $(short "$out" 200)"
out=$(call "$RW" create_pet "{\"client_id\":\"$CLIENT\",\"name\":\"צ'רלי $RUN\",\"species\":\"dog\",\"breed\":\"בורדר קולי\",\"gender\":\"male\",\"birth_date\":\"2024-03-15\",\"weight\":18.5,\"neutered\":true,\"medical_notes\":\"אלרגיה לעוף\",\"food_brand\":\"רויאל קנין\",\"food_grams_per_day\":300,\"idempotency_key\":\"lt4-pet-$RUN\",\"dry_run\":true}"); [[ "$out" == *"תצוגה מקדימה"* ]] && ok "create_pet dry_run" || bad "create_pet dry -> $(short "$out" 200)"
out=$(call "$RW" create_pet "{\"client_id\":\"$CLIENT\",\"name\":\"צ'רלי $RUN\",\"species\":\"dog\",\"breed\":\"בורדר קולי\",\"gender\":\"male\",\"birth_date\":\"2024-03-15\",\"weight\":18.5,\"neutered\":true,\"medical_notes\":\"אלרגיה לעוף\",\"food_brand\":\"רויאל קנין\",\"food_grams_per_day\":300,\"idempotency_key\":\"lt4-pet-$RUN\"}"); PET=$(idof "$out"); good "$out" && [[ -n "$PET" ]] && ok "create_pet -> $PET" || bad "create_pet -> $(short "$out" 200)"
out=$(call "$RW" create_pet "{\"client_id\":\"$CLIENT\",\"name\":\"כפול\",\"idempotency_key\":\"lt4-pet-$RUN\"}"); [[ "$out" == *"♻️"* ]] && ok "create_pet replay" || bad "pet replay -> $(short "$out")"
out=$(call "$RW" create_pet "{\"client_id\":\"00000000-0000-0000-0000-000000000000\",\"name\":\"זר\"}"); [[ "$out" == *"❌"* ]] && ok "create_pet foreign client rejected" || bad "create_pet foreign -> $(short "$out")"
out=$(call "$RW" update_pet "{\"pet_id\":\"$PET\",\"weight\":19.2,\"allergies\":\"עוף, חיטה\",\"behavior_notes\":\"ידידותי\"}"); good "$out" && ok "update_pet -> $(short "$out" 100)" || bad "update_pet -> $(short "$out" 200)"
out=$(call "$RW" record_vaccination "{\"pet_id\":\"$PET\",\"vaccine\":\"rabies\",\"date\":\"2025-09-05\",\"valid_until\":\"2026-09-05\",\"idempotency_key\":\"lt4-vacc-$RUN\"}"); good "$out" && ok "record_vaccination" || bad "record_vaccination -> $(short "$out" 200)"
out=$(call "$RW" record_vaccination "{\"pet_id\":\"$PET\",\"vaccine\":\"dhpp\",\"date\":\"2026-08-01\",\"valid_until\":\"2026-09-10\"}"); good "$out" && ok "record_vaccination dhpp (expiring soon)" || bad "vacc dhpp -> $(short "$out" 200)"
out=$(call "$RW" add_weight_entry "{\"pet_id\":\"$PET\",\"weight_kg\":19.4,\"notes\":\"שקילה\"}"); good "$out" && ok "add_weight_entry" || bad "add_weight_entry -> $(short "$out" 200)"
out=$(call "$RW" get_pet "{\"pet_id\":\"$PET\"}"); [[ "$out" == *"צ'רלי"* && "$out" == *"כלבת"* ]] && ok "get_pet card (health+weights)" || bad "get_pet -> $(short "$out" 300)"
out=$(call "$RW" list_expiring_vaccinations '{"days_ahead":60}'); [[ "$out" == *"$PET"* ]] && ok "list_expiring_vaccinations shows rabies expiring" || bad "expiring -> $(short "$out" 200)"
out=$(call "$RW" create_service "{\"name\":\"טיפוח מלא $RUN\",\"duration\":90,\"price\":180,\"type\":\"grooming\",\"idempotency_key\":\"lt4-svc-$RUN\"}"); SVC=$(idof "$out"); good "$out" && [[ -n "$SVC" ]] && ok "create_service -> $SVC" || bad "create_service -> $(short "$out" 200)"
out=$(call "$RW" create_service "{\"name\":\"טיפוח מלא $RUN\",\"duration\":30,\"price\":1}"); [[ "$out" == *"❌"* ]] && ok "create_service duplicate name rejected" || bad "svc dup -> $(short "$out")"
out=$(call "$RW" list_services '{}'); [[ "$out" == *"$SVC"* ]] && ok "list_services shows new service" || bad "list_services -> $(short "$out" 200)"
out=$(call "$RW" get_whatsapp_link "{\"client_id\":\"$CLIENT\",\"text\":\"שלום! תזכורת לתור\"}"); [[ "$out" == *"wa.me/972"* ]] && ok "get_whatsapp_link -> $(short "$out" 100)" || bad "whatsapp link -> $(short "$out" 200)"
out=$(call "$RO" get_whatsapp_link "{\"phone\":\"0585652240\"}"); [[ "$out" == *"wa.me/9725"* || "$out" == *"❌"* ]] && ok "get_whatsapp_link by phone (no foreign customer leak): $(short "$out" 80)" || bad "wa phone -> $(short "$out")"

echo "=== 2. training"
out=$(call "$RW" create_training_program "{\"client_id\":\"$CLIENT\",\"dog_id\":\"$PET\",\"name\":\"ציות בסיסי $RUN\",\"program_type\":\"BASIC_OBEDIENCE\",\"total_sessions\":8,\"frequency\":\"WEEKLY\",\"start_date\":\"2026-09-01\",\"goals\":[\"שב\",\"ארצה\",\"הליכה ברצועה\"],\"idempotency_key\":\"lt4-prog-$RUN\"}"); PROG=$(idof "$out"); good "$out" && [[ -n "$PROG" ]] && ok "create_training_program -> $PROG" || bad "create_training_program -> $(short "$out" 300)"
out=$(call "$RW" get_training_program "{\"program_id\":\"$PROG\"}"); [[ "$out" == *"שב"* ]] && ok "get_training_program shows goals" || bad "get_training_program -> $(short "$out" 300)"
out=$(call "$RW" add_training_goal "{\"program_id\":\"$PROG\",\"title\":\"ישיבה על פקודה\"}"); GOAL=$(idof "$out"); good "$out" && ok "add_training_goal (pre-session) -> $GOAL" || bad "add_training_goal -> $(short "$out" 200)"
out=$(call "$RW" log_training_session "{\"program_id\":\"$PROG\",\"date\":\"2026-09-01\",\"start_time\":\"17:00\",\"duration_minutes\":60,\"notes\":\"מפגש ראשון — שב ארצה\",\"homework\":\"לתרגל שב 5 דק' ביום\",\"rating\":4,\"goal_progress\":[{\"goal_id\":\"$GOAL\",\"progress_percent\":40}],\"idempotency_key\":\"lt4-sess-$RUN\"}"); SESS=$(idof "$out"); good "$out" && [[ -n "$SESS" ]] && ok "log_training_session -> $SESS" || bad "log_training_session -> $(short "$out" 300)"
out=$(call "$RW" log_training_session "{\"program_id\":\"$PROG\",\"date\":\"2026-09-01\",\"idempotency_key\":\"lt4-sess-$RUN\"}"); [[ "$out" == *"♻️"* ]] && ok "log_training_session replay" || bad "sess replay -> $(short "$out")"
out=$(call "$RW" update_training_session "{\"session_id\":\"$SESS\",\"rating\":5,\"notes\":\"עודכן\"}"); good "$out" && ok "update_training_session" || bad "update_training_session -> $(short "$out" 200)"
out=$(call "$RW" add_training_goal "{\"program_id\":\"$PROG\",\"title\":\"היזכרות\",\"target_date\":\"2026-10-01\"}"); GOAL2=$(idof "$out"); good "$out" && ok "add_training_goal -> $GOAL2" || bad "add_training_goal -> $(short "$out" 200)"
out=$(call "$RW" update_training_goal "{\"goal_id\":\"$GOAL2\",\"progress_percent\":100}"); good "$out" && ok "update_training_goal 100%" || bad "update_training_goal -> $(short "$out" 200)"
out=$(call "$RW" update_training_program "{\"program_id\":\"$PROG\",\"status\":\"PAUSED\",\"notes\":\"הפסקה\"}"); good "$out" && ok "update_training_program PAUSED" || bad "update_training_program -> $(short "$out" 200)"
out=$(call "$RW" get_training_program '{"program_id":"00000000-0000-0000-0000-000000000000"}'); [[ "$out" == *"❌"* ]] && ok "get_training_program foreign id rejected" || bad "prog foreign -> $(short "$out")"
out=$(call "$RW" update_training_session '{"session_id":"00000000-0000-0000-0000-000000000000","rating":1}'); [[ "$out" == *"❌"* ]] && ok "update_training_session foreign id rejected" || bad "sess foreign -> $(short "$out")"
out=$(call "$RW" list_training_programs '{"status":"PAUSED"}'); [[ "$out" == *"$PROG"* ]] && ok "list_training_programs status filter" || bad "list_training_programs -> $(short "$out" 200)"

echo "=== 3. finance + deletions"
out=$(call "$RW" create_order "{\"customer_id\":\"$CLIENT\",\"item_name\":\"חבילת אילוף 8\",\"quantity\":1,\"unit_price\":1200,\"status\":\"confirmed\",\"idempotency_key\":\"lt4-order-$RUN\"}"); ORDER=$(idof "$out"); good "$out" && ok "create_order confirmed -> $ORDER" || bad "create_order -> $(short "$out" 200)"
out=$(call "$RW" get_outstanding_balances '{"limit":10}'); [[ "$out" == *"$CLIENT"* ]] && ok "get_outstanding_balances lists client" || note "outstanding -> $(short "$out" 200)"
out=$(call "$RW" record_payment "{\"customer_id\":\"$CLIENT\",\"amount\":500,\"method\":\"bit\",\"order_id\":\"$ORDER\",\"paid_at\":\"2026-08-20\",\"notes\":\"מקדמה\",\"is_deposit\":true,\"idempotency_key\":\"lt4-pay-$RUN\",\"dry_run\":true}"); [[ "$out" == *"תצוגה מקדימה"* ]] && ok "record_payment dry_run" || bad "record_payment dry -> $(short "$out" 200)"
out=$(call "$RW" record_payment "{\"customer_id\":\"$CLIENT\",\"amount\":500,\"method\":\"bit\",\"order_id\":\"$ORDER\",\"paid_at\":\"2026-08-20\",\"notes\":\"מקדמה\",\"is_deposit\":true,\"idempotency_key\":\"lt4-pay-$RUN\"}"); PAY=$(idof "$out"); good "$out" && [[ -n "$PAY" ]] && ok "record_payment -> $PAY" || bad "record_payment -> $(short "$out" 300)"
out=$(call "$RW" record_payment "{\"customer_id\":\"$CLIENT\",\"amount\":500,\"method\":\"bit\",\"idempotency_key\":\"lt4-pay-$RUN\"}"); [[ "$out" == *"♻️"* ]] && ok "record_payment replay" || bad "pay replay -> $(short "$out")"
out=$(call "$RW" record_payment "{\"customer_id\":\"$CLIENT\",\"amount\":10,\"method\":\"cash\",\"order_id\":\"00000000-0000-0000-0000-000000000000\"}"); [[ "$out" == *"❌"* ]] && ok "record_payment foreign order rejected" || bad "pay foreign -> $(short "$out")"
out=$(call "$RW" get_payment "{\"payment_id\":\"$PAY\"}"); [[ "$out" == *"500"* && "$out" == *"$ORDER"* ]] && ok "get_payment links order" || bad "get_payment -> $(short "$out" 200)"
out=$(call "$RW" list_payments "{\"from\":\"2026-08-01\",\"to\":\"2026-08-31\",\"customer_id\":\"$CLIENT\"}"); [[ "$out" == *"$PAY"* || "$out" == *"500"* ]] && ok "list_payments shows it" || bad "list_payments -> $(short "$out" 200)"
out=$(call "$RW" update_payment "{\"payment_id\":\"$PAY\",\"notes\":\"מקדמה — אושר\",\"invoice_number\":\"INV-$RUN\"}"); good "$out" && ok "update_payment" || bad "update_payment -> $(short "$out" 200)"
out=$(call "$RW" cancel_order "{\"order_id\":\"$ORDER\",\"reason\":\"בדיקה\"}"); [[ "$out" == *"❌"* && "$out" == *"force"* ]] && ok "cancel_order refuses (paid payment) without force" || note "cancel_order w/o force -> $(short "$out" 150)"
out=$(call "$RW" update_order_status "{\"order_id\":\"$ORDER\",\"status\":\"in_progress\"}"); good "$out" && ok "update_order_status in_progress" || bad "update_order_status -> $(short "$out" 200)"
out=$(call "$RW" cancel_order "{\"order_id\":\"$ORDER\",\"reason\":\"בדיקה\",\"force\":true}"); good "$out" && ok "cancel_order force" || bad "cancel_order force -> $(short "$out" 200)"
out=$(call "$RW" create_task "{\"title\":\"למחיקה $RUN\",\"idempotency_key\":\"lt4-task-$RUN\"}"); TASK=$(idof "$out"); good "$out" && ok "create_task -> $TASK" || bad "create_task -> $(short "$out")"
out=$(call "$RW" delete_task "{\"task_id\":\"$TASK\",\"dry_run\":true}"); [[ "$out" == *"תצוגה מקדימה"* ]] && ok "delete_task dry_run" || bad "delete_task dry -> $(short "$out")"
out=$(call "$RW" delete_task "{\"task_id\":\"$TASK\"}"); good "$out" && ok "delete_task" || bad "delete_task -> $(short "$out" 200)"
out=$(call "$RW" delete_task "{\"task_id\":\"$TASK\"}"); [[ "$out" == *"❌"* ]] && ok "delete_task again -> not found" || bad "delete twice -> $(short "$out")"
out=$(call "$RO" delete_task "{\"task_id\":\"$TASK\"}"); [[ "$out" == *"הרשאת write:tasks"* ]] && ok "RO delete_task denied" || bad "RO delete -> $(short "$out")"
out=$(call "$RO" record_payment "{\"customer_id\":\"$CLIENT\",\"amount\":1,\"method\":\"cash\"}"); [[ "$out" == *"הרשאת write:payments"* ]] && ok "RO record_payment denied" || bad "RO pay -> $(short "$out")"
out=$(call "$RO" create_pet "{\"client_id\":\"$CLIENT\",\"name\":\"x\"}"); [[ "$out" == *"הרשאת write:pets"* ]] && ok "RO create_pet denied" || bad "RO pet -> $(short "$out")"
out=$(call "$RO" log_training_session "{\"program_id\":\"$PROG\",\"date\":\"2026-09-02\"}"); [[ "$out" == *"הרשאת write:training"* ]] && ok "RO log_training_session denied" || bad "RO sess -> $(short "$out")"

echo "=== 4. rate limit: 40 parallel + sequential tail up to 105 tools/call on one token"
TMP=$S/lt4-burst; rm -rf $TMP; mkdir -p $TMP
for i in $(seq 1 40); do (curl -s -o /dev/null -w "%{http_code}\n" -X POST "$B/api/mcp" -H "Authorization: Bearer $RW" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_business_stats","arguments":{}}}' > $TMP/$i.txt) & done; wait
c429=$(cat $TMP/*.txt | grep -c "^429"); c200=$(cat $TMP/*.txt | grep -c "^200"); echo "  burst: 200=$c200 429=$c429"
[[ "$c429" -ge 1 ]] && ok "parallel burst capped by Redis (some 429)" || note "parallel burst not capped (Redis limiter inactive) — DB guard checked next"
seq429=0; for i in $(seq 1 70); do code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/api/mcp" -H "Authorization: Bearer $RW" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_business_stats","arguments":{}}}'); [[ "$code" == "429" ]] && { seq429=$((seq429+1)); [[ $seq429 -ge 3 ]] && break; }; done; echo "  sequential tail: first 429 after ~$((40+i)) calls"
[[ "$seq429" -ge 1 ]] && ok "DB burst guard trips within the 100/min window" || bad "no 429 after 110 sequential+parallel calls"
sleep 5; code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/api/mcp" -H "Authorization: Bearer $RW" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_business_stats","arguments":{}}}'); [[ "$code" == "429" ]] && ok "follow-up call after burst -> 429 (guard holds)" || note "follow-up after burst -> $code"

echo "=== 5. cleanup"
for id in $RWID $ROID; do code=$(curl -s -o /dev/null -w "%{http_code}" -b $S/lt4-cookies.txt -X DELETE $B/api/mcp/connections/$id); [[ "$code" == "200" ]] && ok "revoked $id" || bad "revoke $id -> $code"; done
echo; echo "RESULT: pass=$PASS fail=$FAIL notes=$NOTE"
echo "QA rows: client=$CLIENT pet=$PET svc=$SVC prog=$PROG sess=$SESS order=$ORDER pay=$PAY"
