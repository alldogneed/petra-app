"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface StepCompletionProps {
    onComplete: () => void;
}

export default function StepCompletion({ onComplete }: StepCompletionProps) {
    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 text-center py-8">
            <div className="flex justify-center">
                <div className="rounded-full bg-green-100 p-3">
                    <CheckCircle2 className="h-16 w-16 text-green-600" />
                </div>
            </div>

            <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight">הכל מוכן! 🎉</h1>
                <p className="text-gray-500 text-lg max-w-md mx-auto">
                    סיימנו את ההגדרות הראשוניות. עכשיו אפשר להתחיל לנהל את העסק בצורה חכמה ויעילה יותר.
                </p>
            </div>

            <div className="pt-8 flex justify-center">
                <Button
                    onClick={onComplete}
                    className="w-full max-w-sm h-14 text-lg rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium shadow-lg shadow-green-600/20"
                >
                    בואו נתחיל
                </Button>
            </div>
        </div>
    );
}
