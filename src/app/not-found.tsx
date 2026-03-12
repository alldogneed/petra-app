import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 p-6"
      dir="rtl"
      style={{ background: "linear-gradient(135deg, #FDF8F4 0%, #F9F3EC 100%)" }}
    >
      <div
        className="text-8xl font-bold"
        style={{ color: "#C4956A" }}
      >
        404
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-petra-text">הדף לא נמצא</h1>
        <p className="text-petra-muted max-w-xs">
          הדף שחיפשת לא קיים, הוסר, או שהקישור שגוי
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/dashboard"
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white text-center transition-colors"
          style={{ background: "#C4956A" }}
        >
          לדף הבית
        </Link>
        <Link
          href="/customers"
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-center border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          style={{ color: "#3D2E1F" }}
        >
          לרשימת הלקוחות
        </Link>
      </div>

      <p className="text-xs text-petra-muted mt-4">
        אם חשבת שהקישור תקין, צור קשר עם התמיכה
      </p>
    </div>
  );
}
