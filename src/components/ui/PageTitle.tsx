"use client";
import { useEffect } from "react";

export function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} | Petra`;
    return () => {
      document.title = "Petra";
    };
  }, [title]);
  return null;
}
