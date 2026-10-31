import type { Metadata, Viewport } from "next";
import { Heebo, Inter, Montserrat } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTimeZone, getTranslations } from "next-intl/server";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { Toaster } from "sonner";
import ChunkErrorReload from "@/components/ChunkErrorReload";

const heebo = Heebo({
  subsets: ["latin", "hebrew"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-heebo",
});

// English UI (en-US businesses). Not preloaded — Hebrew pages never use it.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  preload: false,
});

// PETRA wordmark in <PetraLoader /> — matches the logo lettering
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["800"],
  display: "swap",
  variable: "--font-montserrat",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = localeFromBusiness({ locale: await getLocale() });
  const tm = await getTranslations("layout.rootLayout");
  const kw = tm.raw("keywords") as Record<string, string>;
  return {
    metadataBase: new URL("https://petra-app.com"),
    title: {
      default: tm("title"),
      template: "%s | Petra",
    },
    description: tm("description"),
    keywords: [
      kw.dogManagementSystem,
      kw.dogTrainerSoftware,
      kw.dogBoardingManagement,
      kw.groomerSoftware,
      kw.trainerScheduling,
      kw.petBusinessCrm,
      kw.trainerClientManagement,
      kw.dogTrainingSoftware,
      kw.dogBusinessManagement,
      "petra app",
      kw.brandName,
    ],
    authors: [{ name: "Petra — All-Dog", url: "https://petra-app.com" }],
    creator: "All-Dog",
    publisher: "All-Dog",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      type: "website",
      locale: locale.replace("-", "_"),
      url: "https://petra-app.com/landing",
      siteName: "Petra",
      title: tm("title"),
      description: tm("ogDescription"),
      images: [
        {
          url: "/hero-image.png",
          width: 1200,
          height: 630,
          alt: tm("title"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: tm("title"),
      description: tm("twitterDescription"),
      images: ["/hero-image.png"],
    },
    alternates: {
      canonical: "https://petra-app.com/landing",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Petra",
    },
    icons: {
      icon: [
        { url: "/favicon.ico", type: "image/x-icon", sizes: "16x16" },
        { url: "/favicon.ico", type: "image/x-icon", sizes: "32x32" },
        { url: "/icon.png", type: "image/png", sizes: "192x192" },
        { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
      ],
      shortcut: "/favicon.ico",
      apple: { url: "/apple-icon.png", sizes: "180x180" },
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1e293b",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = localeFromBusiness({ locale: await getLocale() });
  const cfg = LOCALE_CONFIG[locale];
  const [messages, timeZone, t] = await Promise.all([
    getMessages(),
    getTimeZone(),
    getTranslations("common"),
  ]);
  const isEn = cfg.lang === "en";
  const font = isEn ? inter : heebo;
  const fontFamily = isEn ? "Inter, sans-serif" : "Heebo, sans-serif";
  return (
    <html
      lang={cfg.lang}
      dir={cfg.dir}
      className={`${heebo.variable} ${inter.variable} ${montserrat.variable}`}
      style={{ ["--font-sans" as string]: isEn ? "var(--font-inter)" : "var(--font-heebo)" }}
    >
      <body className={`${font.className} antialiased`}>
        <a href="#main-content" className="skip-link">{t("skipToContent")}</a>
        {/* Service Worker registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', function() { navigator.serviceWorker.register('/sw.js').catch(function(){}); }); }`,
          }}
        />
        <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
        <QueryProvider>
          <ChunkErrorReload />
          <AuthProvider>{children}</AuthProvider>
          <Toaster
            position={cfg.dir === "rtl" ? "bottom-left" : "bottom-right"}
            dir={cfg.dir}
            toastOptions={{
              style: { fontFamily },
              classNames: {
                success: "!bg-green-50 !border-green-200 !text-green-800",
                error: "!bg-red-50 !border-red-200 !text-red-700",
                info: "!bg-blue-50 !border-blue-200 !text-blue-800",
              },
            }}
            richColors
          />
          {/* Accessible live regions for screen readers */}
          <div id="a11y-polite" role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
          <div id="a11y-assertive" role="alert" aria-live="assertive" aria-atomic="true" className="sr-only" />
        </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
