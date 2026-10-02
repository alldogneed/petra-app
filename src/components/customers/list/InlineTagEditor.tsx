"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Tag } from "lucide-react";
import { toast } from "sonner";
import { parseTags, type EnhancedCustomer } from "./types";

// ─── Inline Tag Editor ──────────────────────────────────────────

export function InlineTagEditor({ customer, presetTags }: { customer: EnhancedCustomer; presetTags: string[] }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tags = parseTags(customer.tags);

  const mutation = useMutation({
    mutationFn: (newTags: string[]) =>
      fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: JSON.stringify(newTags) }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: () => toast.error("שגיאה בעדכון התגיות. נסה שוב."),
  });

  const toggleTag = (tag: string) => {
    const newTags = tags.includes(tag)
      ? tags.filter((t) => t !== tag)
      : [...tags, tag];
    mutation.mutate(newTags);
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1 group/tags cursor-pointer"
        title="עריכת תגיות"
      >
        {tags.filter((t) => t !== "VIP").length > 0 ? (
          <div className="flex gap-1 flex-wrap">
            {tags
              .filter((t) => t !== "VIP")
              .slice(0, 3)
              .map((tag) => (
                <span
                  key={tag}
                  className="inline-flex px-1.5 py-0 rounded text-[10px] bg-[#F3EDE6] text-[#8B7355] font-medium group-hover/tags:bg-[#E8DFD5] transition-colors"
                >
                  {tag}
                </span>
              ))}
            {tags.filter((t) => t !== "VIP").length > 3 && (
              <span className="text-[10px] text-[#8B7355]">
                +{tags.filter((t) => t !== "VIP").length - 3}
              </span>
            )}
            <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover/tags:opacity-100 transition-opacity mr-0.5" />
          </div>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-slate-300 group-hover/tags:text-[#8B7355] transition-colors">
            <Tag className="w-3 h-3" />
            הוסף תגיות
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-lg border border-[#E8DFD5] p-2.5 z-50 min-w-[200px] animate-fade-in"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="text-[11px] font-semibold text-[#8B7355] mb-2 px-1">
            תגיות לקוח
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presetTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${tags.includes(tag)
                  ? tag === "VIP"
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-[#3D2E1F] text-white border-[#3D2E1F]"
                  : "bg-[#FAF7F3] text-[#8B7355] border-[#E8DFD5] hover:border-[#C4956A]"
                  }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
