import Link from "next/link";
import { ShieldX } from "lucide-react";

export const metadata = { title: "403 Forbidden — Petra" };

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
            <ShieldX className="w-9 h-9 text-red-500" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">403</h1>
        <p className="text-lg font-semibold text-slate-700 mb-2">Access Denied</p>
        <p className="text-sm text-slate-500 mb-8">
          You don&apos;t have permission to access this resource. If you believe this is an error,
          contact your administrator.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/login"
            className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Switch Account
          </Link>
        </div>
      </div>
    </div>
  );
}
