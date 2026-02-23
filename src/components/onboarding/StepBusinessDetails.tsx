"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StepBusinessDetailsProps {
    onNext: () => void;
    isPending: boolean;
}

export default function StepBusinessDetails({ onNext, isPending }: StepBusinessDetailsProps) {
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [vatNumber, setVatNumber] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    const handleContinue = async () => {
        setIsSaving(true);
        setError("");

        try {
            const res = await fetch("/api/onboarding/business", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, phone, address, vatNumber }),
            });

            if (!res.ok) {
                throw new Error("Failed to save business details");
            }

            onNext();
        } catch (err: any) {
            setError(err.message || "שגיאה בשמירת פרטי העסק. אנא נסה שוב.");
        } finally {
            setIsSaving(false);
        }
    };

    const isComplete = name.trim().length > 0;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">פרטי העסק שלך 🏢</h1>
                <p className="text-gray-500 text-lg">
                    כדי שנוכל להציג את העסק שלך בצורה הטובה ביותר ללקוחות
                </p>
            </div>

            <div className="space-y-6 max-w-sm mx-auto">
                <div className="space-y-2">
                    <Label htmlFor="business-name" className="text-base font-medium">שם העסק <span className="text-red-500">*</span></Label>
                    <Input
                        id="business-name"
                        placeholder="למשל: הכלבים של דני"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-12 text-base rounded-xl"
                        dir="rtl"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="business-phone" className="text-base font-medium">טלפון העסק</Label>
                    <Input
                        id="business-phone"
                        placeholder="050-1234567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-12 text-base rounded-xl"
                        dir="rtl"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="business-address" className="text-base font-medium">כתובת (לפגישות / פנסיון)</Label>
                    <Input
                        id="business-address"
                        placeholder="רחוב, עיר"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="h-12 text-base rounded-xl"
                        dir="rtl"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="business-vat" className="text-base font-medium">ח.פ / עוסק מורשה (אופציונלי)</Label>
                    <Input
                        id="business-vat"
                        placeholder="מספר תאגיד / ת.ז"
                        value={vatNumber}
                        onChange={(e) => setVatNumber(e.target.value)}
                        className="h-12 text-base rounded-xl"
                        dir="rtl"
                    />
                </div>

                {error && (
                    <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
                        {error}
                    </div>
                )}
            </div>

            <div className="pt-4 flex justify-center">
                <Button
                    onClick={handleContinue}
                    disabled={!isComplete || isPending || isSaving}
                    className="w-full max-w-sm h-12 text-base rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                >
                    {isSaving || isPending ? "שומר..." : "המשך לשלב הבא"}
                </Button>
            </div>
        </div>
    );
}
