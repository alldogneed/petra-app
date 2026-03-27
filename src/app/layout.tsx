import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { Toaster } from "sonner";

const heebo = Heebo({
  subsets: ["latin", "hebrew"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://petra-app.com"),
  title: {
    default: "Petra — מערכת ניהול לעסקי חיות מחמד",
    template: "%s | Petra",
  },
  description:
    "ניהול לקוחות, תורים, WhatsApp ופנסיון — כל הכלים לעסק שלך במקום אחד. מסלול חינמי ללא כרטיס אשראי. מאלפי כלבים, גרומרים, פנסיונים וארגוני כלבי שירות.",
  keywords: [
    "מערכת ניהול כלבים",
    "תוכנה לאלף כלבים",
    "ניהול פנסיון כלבים",
    "תוכנה לגרומרים",
    "ניהול תורים לאלפים",
    "CRM לעסקי חיות מחמד",
    "תוכנת ניהול לקוחות לאלפים",
    "אילוף כלבים תוכנה",
    "ניהול עסק כלבים ישראל",
    "petra app",
    "פטרה",
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
    locale: "he_IL",
    url: "https://petra-app.com/landing",
    siteName: "Petra",
    title: "Petra — מערכת ניהול לעסקי חיות מחמד",
    description:
      "ניהול לקוחות, תורים, WhatsApp ופנסיון — כל הכלים לעסק שלך במקום אחד. התחל בחינם.",
    images: [
      {
        url: "/hero-image.png",
        width: 1200,
        height: 630,
        alt: "Petra — מערכת ניהול לעסקי חיות מחמד",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Petra — מערכת ניהול לעסקי חיות מחמד",
    description:
      "ניהול לקוחות, תורים, WhatsApp ופנסיון — כל הכלים לעסק שלך במקום אחד.",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1e293b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className={`${heebo.className} antialiased`}>
        <a href="#main-content" className="skip-link">דלג לתוכן הראשי</a>
        {/* Service Worker registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', function() { navigator.serviceWorker.register('/sw.js').catch(function(){}); }); }`,
          }}
        />
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
          <Toaster
            position="bottom-left"
            toastOptions={{
              style: { fontFamily: "Heebo, sans-serif", direction: "rtl" },
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
      </body>
    </html>
  );
}
