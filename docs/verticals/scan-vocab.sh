#!/usr/bin/env bash
# scan-vocab.sh — list every dog/pet word in src/ that a "generic" business could see,
# grouped by the Phase 2 categories (docs/verticals/PHASE-2.md §2.2).
#
# Usage (from the repo root):  bash docs/verticals/scan-vocab.sh > docs/verticals/scan-vocab.out.txt
#
# Out of scope (never shown to a generic business, or not ours to change):
#   service dogs, AllDog automations, landing/marketing, platform owner panel, MCP,
#   generated assistant knowledge, tests, the vocab dictionary itself.
set -euo pipefail
cd "$(dirname "$0")/../.."

WORDS='כלב|כלבים|כלבה|הכלב|לכלב|חיות מחמד|חיית מחמד|חיית המחמד|"חיות"|>חיות<|אין חיות|חיות נוצרו|🐕|🐶|🐾'
EXCLUDE='service-dog|serviceDog|service_dog|ServiceDog|service-recipient|alldog|AllDog|/landing/|/owner/|/admin/|src/lib/mcp/|api/mcp/|assistant/knowledge|assistant/catalog|__tests__|messages/|verticals/'

matches() {
  grep -rnE "$WORDS" src --include=*.ts --include=*.tsx | grep -vE "$EXCLUDE" || true
}

ALL="$(matches)"

section() {
  local title="$1" pattern="$2"
  local hits
  hits="$(printf '%s\n' "$ALL" | grep -E "$pattern" || true)"
  local n=0
  [ -n "$hits" ] && n="$(printf '%s\n' "$hits" | wc -l | tr -d ' ')"
  echo "════════ $title ($n)"
  [ -n "$hits" ] && printf '%s\n' "$hits" | cut -c1-220
  echo
}

echo "# scan-vocab — $(date -u +%Y-%m-%dT%H:%MZ) — $(git rev-parse --short HEAD)"
echo "# total: $(printf '%s\n' "$ALL" | grep -c . || true) lines in $(printf '%s\n' "$ALL" | cut -d: -f1 | sort -u | grep -c . || true) files"
echo

section "1. ניווט"      'components/layout/|components/search/|app/manifest|app/layout\.tsx'
section "2. Pet"         'customers/|components/customers/|app/\(dashboard\)/pets/|api/pets/|services/pets|services/clients|services/customer|lib/customer|vaccin|import-utils|lead-pet-notes'
section "3. יומן"        'calendar|scheduler|appointment|Appointment|bookings/|google-calendar'
section "4. אימון"       'training|Training'
section "5. הודעות"      'messages-panel|reminder-service|meta-template|whatsapp|scheduled-message|automations'
section "6. booking"     'app/book/|api/book/|my-booking|intake'
section "7. אונבורדינג"  'onboarding|register/|login/'
section "8. דשבורד"      'app/\(dashboard\)/dashboard/|components/dashboard/|dashboard-widgets|api/dashboard/'

CATEGORIZED='components/layout/|components/search/|app/manifest|app/layout\.tsx|customers/|components/customers/|app/\(dashboard\)/pets/|api/pets/|services/pets|services/clients|services/customer|lib/customer|vaccin|import-utils|lead-pet-notes|calendar|scheduler|appointment|Appointment|bookings/|google-calendar|training|Training|messages-panel|reminder-service|meta-template|whatsapp|scheduled-message|automations|app/book/|api/book/|my-booking|intake|onboarding|register/|login/|app/\(dashboard\)/dashboard/|components/dashboard/|dashboard-widgets|api/dashboard/'
section "9. מודולים מוסתרים ב-generic (פנסיון / חיות / האכלה / תרופות) — לא דורש מילון" 'boarding|feeding|medications|app/\(dashboard\)/pets'
REST="$(printf '%s\n' "$ALL" | grep -vE "$CATEGORIZED|boarding|feeding|medications" | grep . || true)"
echo "════════ 10. שאר (הגדרות / עזרה / ייצוא / הרשאות …) — לבדוק ידנית ($(printf '%s\n' "$REST" | grep -c . || true))"
[ -n "$REST" ] && printf '%s\n' "$REST" | cut -c1-220
echo
