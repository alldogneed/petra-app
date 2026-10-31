"use client";
import { useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";

export function PageTitle({ title }: { title: string }) {
  // Verticals phase 3: a "generic" business sees its own name in the tab (dogs → "Petra").
  const { user } = useAuth();
  const brand = user?.businessBranding?.name ?? "Petra";
  useEffect(() => {
    document.title = `${title} | ${brand}`;
    return () => {
      document.title = brand;
    };
  }, [title, brand]);
  return null;
}
