"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

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
        <div className="w-full max-w-2xl mx-auto">
            {/* Progress Dots */}
            <div className="mb-8 flex justify-center gap-2">
                {[0, 1, 2, 3, 4].map((step) => (
                    <div
                        key={step}
                        className={`h-2.5 rounded-full transition-all duration-300 ${step === currentStep
                            ? "w-8 bg-blue-600"
                            : step < currentStep
                                ? "w-2.5 bg-blue-600"
                                : "w-2.5 bg-gray-200"
                            }`}
                    />
                ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                {renderStep()}
            </div>
        </div>
    );
}
