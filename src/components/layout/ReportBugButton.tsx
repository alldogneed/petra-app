"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { LifeBuoy, X, Send } from "lucide-react";
import { toast } from "sonner";
import { usePathname } from "next/navigation";

interface FormState {
  title: string;
  description: string;
}

export function ReportBugButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ title: "", description: "" });
  const pathname = usePathname();

  const mutation = useMutation({
    mutationFn: async (data: FormState) => {
      const autoTitle = data.description.slice(0, 60).trim() || "פנייה מהאפליקציה";
      const res = await fetch("/api/support/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: autoTitle, description: data.description, pageUrl: pathname }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "שגיאה");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("הפנייה נשלחה — נחזור אליך בהקדם 🙏");
      setOpen(false);
      setForm({ title: "", description: "" });
    },
    onError: (err: Error) => {
      toast.error(err.message || "שגיאה בשליחת הפנייה");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    mutation.mutate(form);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all duration-150 text-xs font-medium"
        title="דווח על תקלה"
      >
        <LifeBuoy className="w-4 h-4 flex-shrink-0" />
        <span>תקלה?</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                  <LifeBuoy className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">דיווח על בעיה</h2>
                  <p className="text-xs text-slate-500">נשמח לעזור — נחזור אליך בהקדם</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="label block mb-1.5">תאר את הבעיה</label>
                <textarea
                  className="input w-full resize-none"
                  rows={5}
                  placeholder="תאר מה קרה, מה ניסית לעשות, ומה הייתה השגיאה..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  autoFocus
                  minLength={10}
                  maxLength={1000}
                />
              </div>

              <div className="bg-slate-50 rounded-xl px-3 py-2 text-xs text-slate-500">
                <span className="font-medium">דף:</span>{" "}
                <span dir="ltr">{pathname}</span>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary flex-1 justify-center"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending || form.description.trim().length < 10}
                  className="btn-primary flex-1 justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {mutation.isPending ? "שולח..." : "שלח פנייה"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
