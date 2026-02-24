import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Users, PawPrint, Calendar } from "lucide-react";

export default async function TenantAdminDashboard({
  params,
}: {
  params: { businessId: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const bId = params.businessId;
  const now = new Date();
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalCustomers,
    totalPets,
    scheduledAppointments,
    completedLast30d,
    activeMembers,
  ] = await Promise.all([
    prisma.customer.count({ where: { businessId: bId } }),
    prisma.pet.count({ where: { customer: { businessId: bId } } }),
    prisma.appointment.count({ where: { businessId: bId, status: "scheduled" } }),
    prisma.appointment.count({
      where: { businessId: bId, status: "completed", date: { gte: last30d } },
    }),
    prisma.businessUser.count({ where: { businessId: bId, isActive: true } }),
  ]);

  const cards = [
    { title: "Customers", value: totalCustomers, icon: Users, color: "bg-blue-500" },
    { title: "Pets", value: totalPets, icon: PawPrint, color: "bg-green-500" },
    { title: "Upcoming Appointments", value: scheduledAppointments, icon: Calendar, color: "bg-orange-500" },
    { title: "Completed (30d)", value: completedLast30d, icon: Calendar, color: "bg-violet-500" },
    { title: "Team Members", value: activeMembers, icon: Users, color: "bg-pink-500" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Business Analytics</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className={`w-9 h-9 rounded-xl ${card.color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{card.value.toLocaleString()}</div>
              <div className="text-xs text-slate-400 mt-0.5">{card.title}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
