import { cache } from "react"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import { hasFeatureWithOverrides } from "@/lib/feature-flags"
import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale"

type Props = { params: { slug: string }; children: React.ReactNode }

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/

function slugCandidates(rawSlug: string): string[] {
  // Page/layout params can arrive raw, percent-encoded, or double-encoded
  // depending on runtime — try every decode level for non-ASCII slugs.
  const out = new Set<string>([rawSlug])
  let cur = rawSlug
  for (let i = 0; i < 2; i++) {
    try {
      const dec = decodeURIComponent(cur)
      if (dec === cur) break
      out.add(dec)
      cur = dec
    } catch {
      break
    }
  }
  return [...out]
}

const getPortalBusiness = cache(async (rawSlug: string) => {
  try {
    const business = await prisma.business.findFirst({
      where: { slug: { in: slugCandidates(rawSlug) } },
      select: {
        id: true,
        name: true,
        logo: true,
        status: true,
        tier: true,
        featureOverrides: true,
      },
    })
    if (!business) return null
    const branding = await prisma.brandingSettings.findUnique({
      where: { businessId: business.id },
    })
    return { business, branding }
  } catch {
    return null
  }
})

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const data = await getPortalBusiness(params.slug)
  const t = await getTranslations("portal.cDetailLayout")
  // TODO(i18n): the portal is public → locale = NEXT_LOCALE cookie / he-IL.
  // Taking the locale from the business in the path is a later phase.
  const locale = localeFromBusiness({ locale: await getLocale() })
  if (!data) return { title: t("metaTitle") }
  const title = t("metaTitleWithBusiness", { business: data.business.name })
  return {
    title,
    description: t("metaDescription", { business: data.business.name }),
    openGraph: {
      title,
      url: `https://petra-app.com/c/${params.slug}`,
      type: "website",
      images: data.business.logo ? [{ url: data.business.logo }] : [],
      locale: locale.replace("-", "_"),
    },
    robots: { index: false, follow: false },
  }
}

export default async function PortalLayout({ children, params }: Props) {
  const data = await getPortalBusiness(params.slug)
  if (!data) notFound()

  const { business, branding } = data
  if (business.status !== "active") notFound()

  const overrides = (business.featureOverrides as Record<string, boolean> | null) ?? null
  if (!hasFeatureWithOverrides(business.tier, "online_classes", overrides)) notFound()

  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: await getLocale() })]

  const primary =
    branding?.primaryColor && HEX_COLOR.test(branding.primaryColor)
      ? branding.primaryColor
      : "#F97316"
  const secondary =
    branding?.secondaryColor && HEX_COLOR.test(branding.secondaryColor)
      ? branding.secondaryColor
      : "#EA580C"

  return (
    <div className="portal-root min-h-screen bg-petra-bg flex flex-col" dir={cfg.dir}>
      <style
        dangerouslySetInnerHTML={{
          __html: `.portal-root{--portal-primary:${primary};--portal-secondary:${secondary};}`,
        }}
      />
      <div className="flex-1">{children}</div>
      <footer className="py-6 text-center">
        <a
          href="https://petra-app.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-petra-muted hover:text-petra-text transition-colors"
        >
          Powered by Petra
        </a>
      </footer>
    </div>
  )
}
