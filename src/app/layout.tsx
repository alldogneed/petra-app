import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Petra - ניהול עסקי חיות מחמד",
  description: "מערכת ניהול מתקדמת לעסקי חיות מחמד - אילוף, פנסיון, טיפוח",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased">
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
        </QueryProvider>
      </body>
    </html>
  );
}
