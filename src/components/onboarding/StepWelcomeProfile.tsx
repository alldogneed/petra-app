"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface StepWelcomeProfileProps {
    initialData: any;
    onNext: (data: any) => void;
    isPending: boolean;
}

export default function StepWelcomeProfile({ initialData, onNext, isPending }: StepWelcomeProfileProps) {
    const [businessType, setBusinessType] = useState(initialData?.businessType || "");
    const [activeClientsRange, setActiveClientsRange] = useState(initialData?.activeClientsRange || "");
    const [primaryGoal, setPrimaryGoal] = useState(initialData?.primaryGoal || "");

    const handleContinue = () => {
        onNext({
            businessType,
            activeClientsRange,
            primaryGoal,
        });
    };

    const isComplete = businessType && activeClientsRange && primaryGoal;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">ברוכים הבאים לפטרה! 👋</h1>
                <p className="text-gray-500 text-lg">
                    כדי שנוכל להתאים את המערכת בדיוק לצרכים שלך, נשמח להכיר אותך קצת יותר.
                </p>
            </div>

            <div className="space-y-6 max-w-sm mx-auto">
                <div className="space-y-2">
                    <Label className="text-base font-medium">מה סוג העסק שלך?</Label>
                    <Select value={businessType} onValueChange={setBusinessType} dir="rtl">
                        <SelectTrigger className="h-12 text-base rounded-xl">
                            <SelectValue placeholder="בחר סוג עסק..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="מאלף כלבים">מאלף כלבים</SelectItem>
                            <SelectItem value="פנסיון">פנסיון</SelectItem>
                            <SelectItem value="מספרה">מספרה</SelectItem>
                            <SelectItem value="משולב">משולב (אילוף, פנסיון, מספרה ועוד)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-base font-medium">כמה לקוחות פעילים יש לך בערך?</Label>
                    <div className="grid grid-cols-3 gap-3">
                        {["עד 20", "20-50", "50+"].map((range) => (
                            <button
                                key={range}
                                onClick={() => setActiveClientsRange(range)}
                                className={`flex h-12 items-center justify-center rounded-xl border-2 transition-all ${activeClientsRange === range
                                        ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                                        : "border-gray-200 hover:border-blue-200"
                                    }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-base font-medium">מה המטרה העיקרית שלך במערכת?</Label>
                    <Select value={primaryGoal} onValueChange={setPrimaryGoal} dir="rtl">
                        <SelectTrigger className="h-12 text-base rounded-xl">
                            <SelectValue placeholder="בחר מטרה עיקרית..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="סדר ביומן">לעשות סדר ביומן הפגישות</SelectItem>
                            <SelectItem value="ניהול לקוחות">לנהל טוב יותר לקוחות וכלבים</SelectItem>
                            <SelectItem value="לידים ומכירות">מעקב אחרי לידים ומכירות</SelectItem>
                            <SelectItem value="תזכורות אוטומטיות">שליחת תזכורות אוטומטיות (וואטסאפ)</SelectItem>
                            <SelectItem value="אחר">אחר</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="pt-4 flex justify-center">
                <Button
                    onClick={handleContinue}
                    disabled={!isComplete || isPending}
                    className="w-full max-w-sm h-12 text-base rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                >
                    {isPending ? "שומר..." : "המשך לשלב הבא"}
                </Button>
            </div>
        </div>
    );
}
