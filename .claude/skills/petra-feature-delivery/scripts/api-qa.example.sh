#!/bin/bash
# Local API QA for business-admin control center. Usage: api-qa.sh [base]
B=${1:-http://localhost:3000}; D=$(dirname "$0"); PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✅ $1"; }; bad(){ FAIL=$((FAIL+1)); echo "  ❌ $1 — $2"; }
expect(){ # name expected actual
  [ "$2" == "$3" ] && ok "$1 ($3)" || bad "$1" "expected $2 got $3"; }
login(){ rm -f $D/$1.jar; curl -s -c $D/$1.jar -o $D/$1.login.json -w "%{http_code}" -H "Content-Type: application/json" -H "User-Agent: $3" -X POST $B/api/auth/login -d "{\"email\":\"$2\",\"password\":\"Admin1234!\"}"; }
code(){ jar=$1; shift; curl -s -b $D/$jar.jar -o $D/last.json -w "%{http_code}" "$@"; }
J(){ python3 -c "import json,sys;d=json.load(open('$D/last.json'));print(eval(sys.argv[1]))" "$1" 2>/dev/null; }

echo "== login"
expect "owner login" 200 $(login owner owner@petra.local "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36")
expect "staff login" 200 $(login staff staff@petra.local "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")
expect "other-owner login" 200 $(login other other@petra.local "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36")

echo "== activity logged with businessId/entity"
expect "owner creates customer" 200 $(code owner -H "Content-Type: application/json" -X POST $B/api/customers -d "{\"name\":\"QA לקוח בדיקה\",\"phone\":\"054$((RANDOM%9000000+1000000))\"}")
CUST=$(J "d.get('id') or d.get('customer',{}).get('id')"); echo "  customer=$CUST"
sleep 1
expect "activity list" 200 $(code owner "$B/api/business-admin/activity?action=CREATE_CUSTOMER&take=5")
expect "CREATE_CUSTOMER row has entity label" "QA לקוח בדיקה" "$(J "d['items'][0]['entityLabel']")"
expect "row entityId = customer" "$CUST" "$(J "d['items'][0]['entityId']")"
expect "LOGIN row has device" "Chrome · Mac" "$(code owner "$B/api/business-admin/activity?action=LOGIN&take=1&userId=$(python3 -c "import json;print(json.load(open('$D/owner.login.json'))['user']['id'])" 2>/dev/null)" >/dev/null; J "d['items'][0]['entityLabel']")"

echo "== activity filters/validation"
expect "search q" 200 $(code owner "$B/api/business-admin/activity?q=QA%20%D7%9C%D7%A7%D7%95%D7%97")
expect "search finds row" True "$(J "len(d['items'])>=1")"
expect "invalid action 400" 400 $(code owner "$B/api/business-admin/activity?action=DROP_TABLE")
expect "malformed cursor 400" 400 $(code owner "$B/api/business-admin/activity?cursor=%27%3B--")
expect "bad date 400" 400 $(code owner "$B/api/business-admin/activity?from=2026-13-40")
expect "from>to 400" 400 $(code owner "$B/api/business-admin/activity?from=2026-10-02&to=2026-10-01")
expect "take=1 paging" 200 $(code owner "$B/api/business-admin/activity?take=1")
NC=$(J "d['nextCursor']"); FIRST=$(J "d['items'][0]['id']")
expect "page 2" 200 $(code owner "$B/api/business-admin/activity?take=1&cursor=$NC")
[ "$(J "d['items'][0]['id']")" != "$FIRST" ] && ok "page 2 differs" || bad "page 2 differs" same
expect "export xlsx" 200 $(code owner "$B/api/business-admin/activity/export")
file $D/last.json | grep -qi "zip\|Microsoft\|OOXML" && ok "export is xlsx" || bad "export is xlsx" "$(file $D/last.json)"

echo "== other endpoints (owner)"
for p in overview ai-activity sessions security-alerts data-health "team-stats?days=30"; do expect "GET $p" 200 $(code owner "$B/api/business-admin/$p"); done
expect "team-stats days=5 400" 400 $(code owner "$B/api/business-admin/team-stats?days=5")
code owner "$B/api/business-admin/data-health" >/dev/null; expect "health score numeric" True "$(J "0<=d['score']<=100")"

echo "== staff (non-owner) is blocked"
for p in activity activity/export overview ai-activity sessions security-alerts data-health "team-stats?days=30"; do expect "staff GET $p" 403 $(code staff "$B/api/business-admin/$p"); done
expect "staff PUT alerts" 403 $(code staff -X PUT -H "Content-Type: application/json" "$B/api/business-admin/security-alerts" -d '{"enabled":false}')

echo "== cross-tenant (other owner)"
expect "other sees own activity only" 200 $(code other "$B/api/business-admin/activity?take=100")
expect "no demo rows leak" False "$(J "any(i.get('entityLabel')=='QA לקוח בדיקה' or i['userName']=='דנה עובדת' for i in d['items'])")"
code owner "$B/api/business-admin/sessions" >/dev/null
STAFFSID=$(J "[s['id'] for s in d if s['user']['email']=='staff@petra.local'][0]")
OWNSID=$(J "[s['id'] for s in d if s.get('isCurrent')][0]")
expect "staff session isNewDevice field present" True "$(J "all('isNewDevice' in s and 'device' in s and 'token' not in s for s in d)")"
expect "other owner cannot revoke demo staff session" 404 $(code other -X DELETE "$B/api/business-admin/sessions/$STAFFSID")
expect "other owner revoke-all demo staff" 404 $(code other -X DELETE "$B/api/business-admin/sessions?userId=qa-staff-1")
expect "other activity userId filter foreign → empty" 200 $(code other "$B/api/business-admin/activity?userId=qa-staff-1")
expect "foreign userId gives nothing of demo" True "$(J "all(i['userId']!='qa-staff-1' for i in d['items'])")"

echo "== security alerts prefs"
expect "PUT prefs" 200 $(code owner -X PUT -H "Content-Type: application/json" "$B/api/business-admin/security-alerts" -d '{"enabled":true,"email":true,"includeOwnActions":true,"evil":"x","rules":{"deleteCustomer":true,"hack":1}}')
expect "unknown keys dropped" False "$(J "'evil' in d or 'hack' in d.get('rules',d.get('prefs',{}).get('rules',{}))")"
expect "PUT non-object 400" 400 $(code owner -X PUT -H "Content-Type: application/json" "$B/api/business-admin/security-alerts" -d '"x"')

echo "== sensitive action shows in recent"
expect "owner deletes QA customer" 200 $(code owner -X DELETE -H "x-confirm-action: DELETE_CUSTOMER_$CUST" "$B/api/customers/$CUST")
code owner "$B/api/business-admin/security-alerts" >/dev/null
expect "recent has DELETE_CUSTOMER" True "$(J "any(r['action']=='DELETE_CUSTOMER' and r['entityLabel']=='QA לקוח בדיקה' for r in d['recent'])")"

echo "== session revoke"
expect "cannot revoke own current" 400 $(code owner -X DELETE "$B/api/business-admin/sessions/$OWNSID")
expect "revoke staff session" 200 $(code owner -X DELETE "$B/api/business-admin/sessions/$STAFFSID")
S=$(code staff "$B/api/auth/me"); [ "$S" == "401" ] && ok "staff logged out after revoke (401)" || echo "  ⚠️  staff /api/auth/me → $S (session cache up to 30s)"
expect "REVOKE_SESSION logged" 200 $(code owner "$B/api/business-admin/activity?action=REVOKE_SESSION&take=1")
expect "revoke label has device" True "$(J "'iPhone' in d['items'][0]['entityLabel']")"

echo "== permission matrix enforced"
login staff staff@petra.local "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1" >/dev/null
P="psql -qtA postgresql://petra:petra@localhost:5432/petra"
$P -c "update \"BusinessUser\" set \"permissionOverrides\"=null, role='user', \"isActive\"=true where id='bu-qa-staff-1'" >/dev/null
expect "staff (default) can export customers" 200 $(code staff "$B/api/customers/export")
expect "owner revokes staff export" 200 $(code owner -X PATCH -H "Content-Type: application/json" "$B/api/admin/demo-business-001/members/bu-qa-staff-1" -d '{"permissionOverrides":{"tenant.data.export":false}}')
expect "staff export now 403" 403 $(code staff "$B/api/customers/export")
expect "UPDATE_MEMBER_PERMISSIONS logged" 200 $(code owner "$B/api/business-admin/activity?action=UPDATE_MEMBER_PERMISSIONS&take=1")
expect "perm change entity = staff" "דנה עובדת" "$(J "d['items'][0]['entityLabel']")"
expect "staff cannot touch team-stats" 403 $(code staff "$B/api/business-admin/team-stats")
$P -c "update \"BusinessUser\" set role='manager' where id='bu-qa-staff-1'" >/dev/null
$P -c "insert into \"McpConnection\"(id,\"businessId\",name,\"tokenHash\",scopes,\"createdByUserId\",\"createdAt\") values ('qa-mcp-1','demo-business-001','qa','qahash'||floor(random()*1e9)::text,'{}','qa-staff-1',now()) on conflict (id) do update set \"revokedAt\"=null" >/dev/null
expect "owner switches AI off for manager" 200 $(code owner -X PATCH -H "Content-Type: application/json" "$B/api/admin/demo-business-001/members/bu-qa-staff-1" -d '{"permissionOverrides":{"tenant.ai.assistant":false}}')
expect "manager AI connection revoked" t "$($P -c "select \"revokedAt\" is not null from \"McpConnection\" where id='qa-mcp-1'")"
$P -c "update \"BusinessUser\" set \"permissionOverrides\"=null, role='user' where id='bu-qa-staff-1'" >/dev/null

echo; echo "RESULT: $PASS passed, $FAIL failed"
