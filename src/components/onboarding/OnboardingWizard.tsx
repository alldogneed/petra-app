"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

const STEPS = [
    { id: 0, label: "היכרות" },
    { id: 1, label: "פרטי עסק" },
    { id: 2, label: "שירות ראשון" },
    { id: 3, label: "לקוח ראשון" },
    { id: 4, label: "סיום" },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
    return (
        <div className="mb-8 w-full">
            {/* Mobile text indicator */}
            <p className="sm:hidden text-center text-sm text-gray-500 mb-4">
                שלב {currentStep + 1} מתוך {STEPS.length}:{" "}
                <span className="font-bold text-blue-600">{STEPS[currentStep]?.label}</span>
            </p>

            {/* Stepper container */}
            <div className="flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto pb-2">
                {STEPS.map((step, i) => {
                    const isCompleted = i < currentStep;
                    const isActive = i === currentStep;

                    return (
                        <div key={step.id} className="flex items-center shrink-0">
                            <div
                                className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full text-sm sm:text-base font-bold transition-all duration-300 ${isCompleted
                                    ? "bg-green-500 text-white shadow-md shadow-green-500/20"
                                    : isActive
                                        ? "bg-blue-600 text-white ring-4 ring-blue-50 shadow-md shadow-blue-600/20"
                                        : "bg-gray-100 text-gray-400 border border-gray-200"
                                    }`}
                            >
                                {isCompleted ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : i + 1}
                            </div>

                            <span
                                className={`hidden sm:block mr-2 ml-2 sm:mr-3 sm:ml-3 text-sm font-medium transition-colors ${isActive
                                    ? "text-blue-700 font-bold"
                                    : isCompleted
                                        ? "text-gray-700"
                                        : "text-gray-400"
                                    }`}
                            >
                                {step.label}
                            </span>

                            {/* Connecting line */}
                            {i < STEPS.length - 1 && (
                                <div
                                    className={`w-4 sm:w-8 lg:w-12 h-[2px] rounded-full transition-colors duration-300 ${isCompleted ? "bg-green-400" : "bg-gray-200"
                                        }`}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

import StepWelcomeProfile from "./StepWelcomeProfile";
import StepBusinessDetails from "./StepBusinessDetails";
import StepFirstService from "./StepFirstService";
import StepFirstClient from "./StepFirstClient";
import StepCompletion from "./StepCompletion";

export default function OnboardingWizard() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [currentStep, setCurrentStep] = useState<number>(0);

    // Fetch current progress
    const { data, isLoading } = useQuery({
        queryKey: ["onboarding"],
        queryFn: async () => {
            const res = await fetch("/api/onboarding");
            if (!res.ok) throw new Error("Failed to fetch onboarding state");
            return res.json();
        },
    });

    useEffect(() => {
        if (data?.progress) {
            // If user has completed onboarding, redirect them
            if (data.progress.completedAt) {
                router.push("/dashboard");
            } else {
                // Set the UI step to the database step
                setCurrentStep(data.progress.currentStep);
            }
        }
    }, [data, router]);

    // Mutation to save progress/profile
    const updateProgress = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed to update progress");
            return res.json();
        },
        onSuccess: (newData) => {
            queryClient.setQueryData(["onboarding"], newData);
        },
    });

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const handleNext = async (stepData: any = {}) => {
        const nextStep = currentStep + 1;
        await updateProgress.mutateAsync({
            ...stepData,
            currentStep: nextStep,
        });
        setCurrentStep(nextStep);
    };

    const handleSkip = async () => {
        const nextStep = currentStep + 1;
        await updateProgress.mutateAsync({
            skipped: true,
            currentStep: nextStep,
        });
        setCurrentStep(nextStep);
    };

    const handleComplete = async () => {
        await updateProgress.mutateAsync({
            currentStep: 4,
        });
        router.push("/");
    };

    const renderStep = () => {
        switch (currentStep) {
            case 0:
                return (
                    <StepWelcomeProfile
                        initialData={data?.profile}
                        onNext={handleNext}
                        isPending={updateProgress.isPending}
                    />
                );
            case 1:
                return (
                    <StepBusinessDetails
                        onNext={handleNext}
                        isPending={updateProgress.isPending}
                    />
                );
            case 2:
                return (
                    <StepFirstService
                        onNext={handleNext}
                        onSkip={handleSkip}
                        isPending={updateProgress.isPending}
                    />
                );
            case 3:
                return (
                    <StepFirstClient
                        onNext={handleNext}
                        onSkip={handleSkip}
                        isPending={updateProgress.isPending}
                        businessId={data?.progress?.businessId} // Need this for customer creation
                    />
                );
            case 4:
                return <StepCompletion onComplete={handleComplete} />;
            default:
                return null;
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto px-4">
            <StepIndicator currentStep={currentStep} />

            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-10 max-w-2xl mx-auto">
                {renderStep()}
            </div>
        </div>
    );
}
