import { cache } from "react"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import { hasFeatureWithOverrides } from "@/lib/feature-flags"
import type { Metadata } from "next"

type Props = { params: { slug: string }; children: React.ReactNode }

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/

const getPortalBusiness = cache(async (slug: string) => {
  try {
    const business = await prisma.business.findUnique({
      where: { slug },
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
  if (!data) return { title: "פורטל חברים" }
  const title = `${data.business.name} — פורטל חברים`
  return {
    title,
    description: `פורטל החברים של ${data.business.name} — שיעורים חיים, קורסים מוקלטים ומנוי`,
    openGraph: {
      title,
      url: `https://petra-app.com/c/${params.slug}`,
      type: "website",
      images: data.business.logo ? [{ url: data.business.logo }] : [],
      locale: "he_IL",
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

  const primary =
    branding?.primaryColor && HEX_COLOR.test(branding.primaryColor)
      ? branding.primaryColor
      : "#F97316"
  const secondary =
    branding?.secondaryColor && HEX_COLOR.test(branding.secondaryColor)
      ? branding.secondaryColor
      : "#EA580C"

  return (
    <div className="portal-root min-h-screen bg-petra-bg flex flex-col" dir="rtl">
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
