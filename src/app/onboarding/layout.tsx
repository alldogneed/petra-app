import { Metadata } from "next";

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
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8" dir="rtl">
            {children}
        </div>
    );
}
