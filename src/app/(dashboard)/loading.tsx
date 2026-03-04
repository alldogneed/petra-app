export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 bg-slate-200 rounded-lg" />
        <div className="h-9 w-28 bg-slate-200 rounded-lg" />
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 bg-slate-200 rounded" />
              <div className="h-8 w-8 bg-slate-200 rounded-full" />
            </div>
            <div className="h-7 w-16 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      {/* Content rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
          <div className="h-5 w-32 bg-slate-200 rounded" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50">
              <div className="h-8 w-8 bg-slate-200 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-3/4 bg-slate-200 rounded" />
                <div className="h-3 w-1/2 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
          <div className="h-5 w-32 bg-slate-200 rounded" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50">
              <div className="h-2 w-2 bg-slate-200 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-2/3 bg-slate-200 rounded" />
                <div className="h-3 w-1/3 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
