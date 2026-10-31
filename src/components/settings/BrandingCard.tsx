"use client";

/**
 * "מיתוג" — Settings → פרטי העסק, only for a "generic"-vertical business (docs/verticals
 * phase 3). Saves to the existing BrandingSettings row via PATCH /api/settings/branding
 * (SETTINGS_CRITICAL, like the rest of the tab). The logo is the business logo above
 * (Business.logo) — no second upload.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Palette } from "lucide-react";
import { toast } from "sonner";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { useAuth } from "@/providers/auth-provider";
import { usePermissions } from "@/hooks/usePermissions";
import { useVertical } from "@/hooks/useVertical";
import { fetchJSON } from "@/lib/utils";
import { brandPalette, isValidHexColor, PETRA_PRIMARY } from "@/lib/verticals/branding";
import { ReadOnlyNotice, SettingsSectionHeader } from "./settings-ui";
import { useRegisterDirty } from "./SettingsDirtyContext";

interface BrandingEdit {
  primaryColor: string | null;
  secondaryColor: string | null;
  senderName: string | null;
  businessLogo: string | null;
  resolved: { name: string; logoUrl: string; primaryColor: string };
}

const QUERY_KEY = ["settings", "branding"];

export function BrandingCard() {
  const { isGeneric } = useVertical();
  if (!isGeneric) return null; // dogs: the Petra brand, no card (not a locked feature)
  return <BrandingCardInner />;
}

function BrandingCardInner() {
  const qc = useQueryClient();
  const { refreshUser } = useAuth();
  const canEdit = usePermissions().canCriticalSettings;
  const { data, isLoading } = useQuery<BrandingEdit>({
    queryKey: QUERY_KEY,
    queryFn: () => fetchJSON<BrandingEdit>("/api/settings/branding"),
  });

  const [primary, setPrimary] = useState<string>(PETRA_PRIMARY);
  const [secondary, setSecondary] = useState("");
  const [sender, setSender] = useState("");
  useEffect(() => {
    if (!data) return;
    setPrimary(data.primaryColor || PETRA_PRIMARY);
    setSecondary(data.secondaryColor || "");
    setSender(data.senderName || "");
  }, [data]);

  const dirty =
    !!data &&
    (primary !== (data.primaryColor || PETRA_PRIMARY) ||
      secondary !== (data.secondaryColor || "") ||
      sender !== (data.senderName || ""));
  useRegisterDirty("branding", dirty);

  const save = useMutation({
    mutationFn: () =>
      fetchJSON<BrandingEdit>("/api/settings/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryColor: primary,
          secondaryColor: secondary || null,
          senderName: sender.trim() || null,
        }),
      }),
    onSuccess: async (next) => {
      qc.setQueryData(QUERY_KEY, next);
      // /api/auth/me is HTTP-cached for 60s — reload it so the new colour applies now.
      await fetch("/api/auth/me", { cache: "reload" }).catch(() => null);
      await refreshUser();
      toast.success("המיתוג נשמר");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בשמירת המיתוג"),
  });

  if (isLoading) return <PetraLoader variant="inline" />;
  if (!data) return null;

  const validPrimary = isValidHexColor(primary);
  const validSecondary = secondary === "" || isValidHexColor(secondary);
  const palette = brandPalette(validPrimary ? primary : PETRA_PRIMARY);

  return (
    <div className="max-w-xl mt-10 pt-8 border-t border-slate-100" data-testid="branding-card">
      <SettingsSectionHeader
        icon={Palette}
        title="מיתוג"
        description="הצבעים והשם שהלקוחות שלך רואים — במערכת, בדף ההזמנות, במיילים ובדף החתימה. הלוגו הוא לוגו העסק שלמעלה."
      />
      {!canEdit && <ReadOnlyNotice className="mb-5" />}

      <fieldset disabled={!canEdit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <ColorField id="brand-primary" label="צבע ראשי" value={primary} onChange={setPrimary} invalid={!validPrimary} />
          <ColorField id="brand-secondary" label="צבע משני (אופציונלי)" value={secondary} onChange={setSecondary} invalid={!validSecondary} allowEmpty />
        </div>

        <div>
          <label className="label" htmlFor="brand-sender">שם השולח במיילים ללקוחות</label>
          <input
            id="brand-sender"
            className="input w-full"
            maxLength={100}
            placeholder={data.resolved.name}
            value={sender}
            onChange={(e) => setSender(e.target.value)}
          />
        </div>

        <div>
          <p className="label">תצוגה מקדימה</p>
          <div className="flex rounded-xl overflow-hidden border border-slate-200" aria-hidden="true">
            {([50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const).map((shade) => (
              <div key={shade} className="flex-1 h-8" style={{ background: palette[shade] }} title={`${shade}`} />
            ))}
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={!dirty || !validPrimary || !validSecondary || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "שומר..." : "שמור מיתוג"}
            </button>
            {dirty && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setPrimary(data.primaryColor || PETRA_PRIMARY);
                  setSecondary(data.secondaryColor || "");
                  setSender(data.senderName || "");
                }}
              >
                ביטול
              </button>
            )}
          </div>
        )}
      </fieldset>
    </div>
  );
}

function ColorField({
  id, label, value, onChange, invalid, allowEmpty,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; invalid: boolean; allowEmpty?: boolean;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
          value={isValidHexColor(value) ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <input
          id={id}
          dir="ltr"
          className={`input flex-1 text-left ${invalid ? "border-red-300" : ""}`}
          placeholder={allowEmpty ? "—" : "#F97316"}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          aria-invalid={invalid}
        />
      </div>
      {invalid && <p className="text-xs text-red-500 mt-1">צבע בפורמט #RRGGBB</p>}
    </div>
  );
}
