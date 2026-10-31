/**
 * Branding per business (docs/verticals, phase 3). Pure + client-safe.
 *
 * Source = the existing `BrandingSettings` row (logoUrl, primaryColor, secondaryColor,
 * senderName) + `Business.logo` / `Business.name` as fallbacks. No new table.
 *
 * Applied ONLY for vertical "generic": a "dogs" business keeps the Petra look even when
 * it has a BrandingSettings row (several do — the online-classes portal uses it), so
 * nothing changes for existing businesses.
 */
import { normalizeVertical } from "./index";

/** Petra's brand scale — exactly the hex values in tailwind.config.ts (`brand.*`). */
export const PETRA_BRAND_SCALE = {
  50: "#FFF7ED",
  100: "#FFEDD5",
  200: "#FED7AA",
  300: "#FDBA74",
  400: "#FB923C",
  500: "#F97316",
  600: "#EA580C",
  700: "#C2410C",
  800: "#9A3412",
  900: "#7C2D12",
} as const;

export type BrandShade = keyof typeof PETRA_BRAND_SCALE;
export const BRAND_SHADES = Object.keys(PETRA_BRAND_SCALE).map(Number) as BrandShade[];

export const PETRA_PRIMARY = PETRA_BRAND_SCALE[500];
export const PETRA_NAME = "Petra";
export const PETRA_LOGO = "/logo.svg";

const HEX_RE = /^#([0-9a-f]{6})$/i;

export function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value.trim());
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.trim().slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** "r g b" — the format the Tailwind `rgb(var(--brand-N) / <alpha-value>)` tokens expect. */
export function rgbTriplet(hex: string): string {
  return hexToRgb(hex).join(" ");
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];
/** How far each shade moves from the base toward white (<500) or black (>500). */
const SHADE_MIX: Record<BrandShade, number> = {
  50: 0.92, 100: 0.84, 200: 0.68, 300: 0.48, 400: 0.24, 500: 0, 600: 0.12, 700: 0.28, 800: 0.44, 900: 0.58,
};

/**
 * A 50..900 scale around one colour (500 = the colour itself). Petra's own colour returns
 * Petra's hand-tuned scale, so the default theme is byte-identical to tailwind.config.ts.
 */
export function brandPalette(primary: string): Record<BrandShade, string> {
  if (!isValidHexColor(primary) || primary.trim().toUpperCase() === PETRA_PRIMARY) {
    return { ...PETRA_BRAND_SCALE };
  }
  const base = hexToRgb(primary);
  const out = {} as Record<BrandShade, string>;
  for (const shade of BRAND_SHADES) {
    const t = SHADE_MIX[shade];
    out[shade] = shade === 500 ? rgbToHex(base) : rgbToHex(mix(base, shade < 500 ? WHITE : BLACK, t));
  }
  return out;
}

/** CSS declarations for :root — `--brand-50: 255 247 237; …` */
export function brandCssVariables(primary: string): string {
  const palette = brandPalette(primary);
  return BRAND_SHADES.map((s) => `--brand-${s}: ${rgbTriplet(palette[s])};`).join(" ");
}

export interface BrandingSource {
  vertical?: string | null;
  businessName?: string | null;
  businessLogo?: string | null;
  branding?: {
    logoUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    senderName?: string | null;
  } | null;
}

export interface ResolvedBranding {
  /** true = the business's own brand is shown (vertical "generic"). */
  enabled: boolean;
  name: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string | null;
  /** Name customers see as the sender of e-mails / messages. */
  senderName: string;
}

/** What a page / e-mail / PDF should show. dogs → always Petra (today's behaviour). */
export function resolveBranding(src: BrandingSource): ResolvedBranding {
  const enabled = normalizeVertical(src.vertical) === "generic";
  if (!enabled) {
    return {
      enabled: false,
      name: PETRA_NAME,
      logoUrl: PETRA_LOGO,
      primaryColor: PETRA_PRIMARY,
      secondaryColor: null,
      senderName: PETRA_NAME,
    };
  }
  const name = src.businessName?.trim() || PETRA_NAME;
  const primary = isValidHexColor(src.branding?.primaryColor) ? src.branding!.primaryColor!.trim() : PETRA_PRIMARY;
  const secondary = isValidHexColor(src.branding?.secondaryColor) ? src.branding!.secondaryColor!.trim() : null;
  return {
    enabled: true,
    name,
    logoUrl: src.branding?.logoUrl?.trim() || src.businessLogo?.trim() || "",
    primaryColor: primary,
    secondaryColor: secondary,
    senderName: src.branding?.senderName?.trim() || name,
  };
}
