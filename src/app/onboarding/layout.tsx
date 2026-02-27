import { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "הגדרת חשבון - Petra",
  description: "הגדרת החשבון והעסק שלך במערכת פטרה",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex flex-col"
      dir="rtl"
      style={{ background: "#F8FAFC" }}
    >
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Petra" width={28} height={28} />
          <span className="text-lg font-bold text-petra-text">Petra</span>
        </div>
        <span className="text-sm text-petra-muted">הגדרת חשבון</span>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center py-10 px-4">
        {children}
      </main>
    </div>
  );
}
