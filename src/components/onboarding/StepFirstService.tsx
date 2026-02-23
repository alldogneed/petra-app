"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StepFirstServiceProps {
    onNext: () => void;
    onSkip: () => void;
    isPending: boolean;
}

export default function StepFirstService({ onNext, onSkip, isPending }: StepFirstServiceProps) {
    const [name, setName] = useState("");
    const [price, setPrice] = useState("");
    const [duration, setDuration] = useState("60");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    const handleContinue = async () => {
        setIsSaving(true);
        setError("");

        try {
            const res = await fetch("/api/onboarding/service", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    price: price ? parseFloat(price) : 0,
                    duration: parseInt(duration),
                    type: "כללי"
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to save service");
            }

            onNext();
        } catch (err: any) {
            setError(err.message || "שגיאה בשמירת השירות. אנא נסה שוב.");
        } finally {
            setIsSaving(false);
        }
    };

    const isComplete = name.trim().length > 0 && price.trim().length > 0;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">השירות הראשון שלך 🏷️</h1>
                <p className="text-gray-500 text-lg">
                    בוא נוסיף שירות אחד (אפשר לשנות או להוסיף עוד מאוחר יותר) כדי שנוכל להתחיל לקבוע פגישות
                </p>
            </div>

            <div className="space-y-6 max-w-sm mx-auto">
                <div className="space-y-2">
                    <Label htmlFor="service-name" className="text-base font-medium">שם השירות <span className="text-red-500">*</span></Label>
                    <Input
                        id="service-name"
                        placeholder="למשל: שיעור אילוף פרטי"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-12 text-base rounded-xl"
                        dir="rtl"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="service-price" className="text-base font-medium">מחיר (₪) <span className="text-red-500">*</span></Label>
                    <Input
                        id="service-price"
                        type="number"
                        placeholder="250"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="h-12 text-base rounded-xl"
                        dir="rtl"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="service-duration" className="text-base font-medium">אורך השירות (בדקות)</Label>
                    <Input
                        id="service-duration"
                        type="number"
                        placeholder="60"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
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

            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center items-center max-w-sm mx-auto">
                <Button
                    onClick={handleContinue}
                    disabled={!isComplete || isPending || isSaving}
                    className="w-full h-12 text-base rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                >
                    {isSaving || isPending ? "שומר..." : "שמור והמשך"}
                </Button>
                <Button
                    variant="outline"
                    onClick={onSkip}
                    disabled={isPending || isSaving}
                    className="w-full h-12 text-base rounded-xl text-gray-500 hover:text-gray-700"
                >
                    אפשר לדלג כרגע
                </Button>
            </div>
        </div>
    );
}
