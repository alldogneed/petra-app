import { cache } from "react"
import prisma from "@/lib/prisma"
import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"

type Props = { params: { slug: string }; children: React.ReactNode }

const getBusiness = cache(async (slug: string) => {
  try {
    return await prisma.business.findUnique({
      where: { slug },
      select: { name: true, logo: true },
    })
  } catch {
    return null
  }
})

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const business = await getBusiness(params.slug)
  const t = await getTranslations("booking.bookDetailLayout")
  if (!business) return { title: t("defaultTitle") }

  const title = t("title", { name: business.name })
  const description = t("description", { name: business.name })
  // Open Graph wants "he_IL" / "en_US"
  const ogLocale = (await getLocale()).replace("-", "_")

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://petra-app.com/book/${params.slug}`,
      type: "website",
      images: business.logo ? [{ url: business.logo }] : [],
      locale: ogLocale,
    },
    alternates: { canonical: `https://petra-app.com/book/${params.slug}` },
    twitter: { card: "summary", title },
  }
}

export default async function BookSlugLayout({ children, params }: Props) {
  const business = await getBusiness(params.slug)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business?.name ?? "Pet Business",
    url: `https://petra-app.com/book/${params.slug}`,
    potentialAction: {
      "@type": "ReserveAction",
      target: `https://petra-app.com/book/${params.slug}`,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {children}
    </>
  )
}
