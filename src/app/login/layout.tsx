import type { Metadata } from "next";

// The login screen is shared by every business type — a neutral tab title (QA 1/11/2026).
export const metadata: Metadata = {
  title: { absolute: "Petra — כניסה" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
