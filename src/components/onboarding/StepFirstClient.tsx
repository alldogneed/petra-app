"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StepFirstClientProps {
    onNext: (data?: any) => void;
    onSkip: () => void;
    isPending: boolean;
    businessId?: string;
}

export default function StepFirstClient({ onNext, onSkip, isPending }: StepFirstClientProps) {
    const [clientName, setClientName] = useState("");
    const [clientPhone, setClientPhone] = useState("");
    const [dogName, setDogName] = useState("");
    const [dogBreed, setDogBreed] = useState("");

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    const handleContinue = async () => {
        setIsSaving(true);
        setError("");

        try {
            const res = await fetch("/api/onboarding/client", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientName,
                    clientPhone,
                    dogName,
                    dogBreed
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to save client");
            }

            const data = await res.json();
            onNext({ lastCustomerId: data.customerId }); // Save customer ID to progress so we can use it later if needed
        } catch (err: any) {
            setError(err.message || "שגיאה בשמירת הלקוח. אנא נסה שוב.");
        } finally {
            setIsSaving(false);
        }
    };

    const isComplete = clientName.trim().length > 0 && clientPhone.trim().length > 0;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">לקוח (וכלב) ראשון 🐶</h1>
                <p className="text-gray-500 text-lg">
                    כמעט סיימנו! בוא נוסיף לקוח ראשון למערכת כדי שנוכל להתחיל לעבוד מהר.
                </p>
            </div>

            <div className="space-y-6 max-w-sm mx-auto">
                <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <h3 className="font-semibold text-gray-700">פרטי לקוח</h3>
                    <div className="space-y-2">
                        <Label htmlFor="client-name" className="text-sm">שם הלקוח <span className="text-red-500">*</span></Label>
                        <Input
                            id="client-name"
                            placeholder="ישראל ישראלי"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            className="h-10 rounded-lg bg-white"
                            dir="rtl"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="client-phone" className="text-sm">טלפון הלקוח <span className="text-red-500">*</span></Label>
                        <Input
                            id="client-phone"
                            placeholder="050-0000000"
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value)}
                            className="h-10 rounded-lg bg-white"
                            dir="rtl"
                        />
                    </div>
                </div>

                <div className="space-y-3 p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                    <h3 className="font-semibold text-orange-800">פרטי הכלב (אופציונלי)</h3>
                    <div className="space-y-2">
                        <Label htmlFor="dog-name" className="text-sm">שם הכלב</Label>
                        <Input
                            id="dog-name"
                            placeholder="רקס"
                            value={dogName}
                            onChange={(e) => setDogName(e.target.value)}
                            className="h-10 rounded-lg bg-white"
                            dir="rtl"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="dog-breed" className="text-sm">גזע</Label>
                        <Input
                            id="dog-breed"
                            placeholder="רועה גרמני"
                            value={dogBreed}
                            onChange={(e) => setDogBreed(e.target.value)}
                            className="h-10 rounded-lg bg-white"
                            dir="rtl"
                        />
                    </div>
                </div>

                {error && (
                    <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
                        {error}
                    </div>
                )}
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center items-center max-w-sm mx-auto">
                <Button
                    onClick={handleContinue}
                    disabled={!isComplete || isPending || isSaving}
                    className="w-full h-12 text-base rounded-xl bg-blue-600 hover:bg-blue-700 text-white truncate"
                >
                    {isSaving || isPending ? "שומר..." : "שמור והמשך"}
                </Button>
                <Button
                    variant="outline"
                    onClick={onSkip}
                    disabled={isPending || isSaving}
                    className="w-full h-12 text-base rounded-xl text-gray-500 hover:text-gray-700 truncate"
                >
                    נדלג, אצור לקוחות בהמשך
                </Button>
            </div>
        </div>
    );
}
