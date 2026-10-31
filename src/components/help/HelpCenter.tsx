"use client";

import { useState, useMemo, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Users,
  Calendar,
  Hotel,
  HelpCircle,
  ChevronDown,
  LayoutDashboard,
  ListTodo,
  Target,
  MessageSquare,
  Settings,
  BarChart3,
  PawPrint,
  Shield,
  CalendarCheck,
  Wallet,
  Dog,
  Sparkles,
  Phone,
  Mail,
  Clock,
  LifeBuoy,
  Send,
  ImagePlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FaqItem {
  questionKey: string;
  answerKey: string;
}

interface FaqCategory {
  id: string;
  nameKey: string;
  icon: React.ElementType;
  items: FaqItem[];
}

const faqCategories: FaqCategory[] = [
  {
    id: "dashboard",
    nameKey: "help.helpCenter.faq.dashboard.name",
    icon: LayoutDashboard,
    items: [
      {
        questionKey: "help.helpCenter.faq.dashboard.items.whatIsShown.question",
        answerKey: "help.helpCenter.faq.dashboard.items.whatIsShown.answer",
      },
      {
        questionKey: "help.helpCenter.faq.dashboard.items.customize.question",
        answerKey: "help.helpCenter.faq.dashboard.items.customize.answer",
      },
      {
        questionKey: "help.helpCenter.faq.dashboard.items.alertsBar.question",
        answerKey: "help.helpCenter.faq.dashboard.items.alertsBar.answer",
      },
      {
        questionKey: "help.helpCenter.faq.dashboard.items.dailyFocus.question",
        answerKey: "help.helpCenter.faq.dashboard.items.dailyFocus.answer",
      },
      {
        questionKey: "help.helpCenter.faq.dashboard.items.quickSearch.question",
        answerKey: "help.helpCenter.faq.dashboard.items.quickSearch.answer",
      },
    ],
  },
  {
    id: "customers",
    nameKey: "help.helpCenter.faq.customers.name",
    icon: Users,
    items: [
      {
        questionKey: "help.helpCenter.faq.customers.items.addClient.question",
        answerKey: "help.helpCenter.faq.customers.items.addClient.answer",
      },
      {
        questionKey: "help.helpCenter.faq.customers.items.profile.question",
        answerKey: "help.helpCenter.faq.customers.items.profile.answer",
      },
      {
        questionKey: "help.helpCenter.faq.customers.items.findClient.question",
        answerKey: "help.helpCenter.faq.customers.items.findClient.answer",
      },
      {
        questionKey: "help.helpCenter.faq.customers.items.merge.question",
        answerKey: "help.helpCenter.faq.customers.items.merge.answer",
      },
      {
        questionKey: "help.helpCenter.faq.customers.items.bulkActions.question",
        answerKey: "help.helpCenter.faq.customers.items.bulkActions.answer",
      },
      {
        questionKey: "help.helpCenter.faq.customers.items.importExport.question",
        answerKey: "help.helpCenter.faq.customers.items.importExport.answer",
      },
    ],
  },
  {
    id: "pets",
    nameKey: "help.helpCenter.faq.pets.name",
    icon: PawPrint,
    items: [
      {
        questionKey: "help.helpCenter.faq.pets.items.addPet.question",
        answerKey: "help.helpCenter.faq.pets.items.addPet.answer",
      },
      {
        questionKey: "help.helpCenter.faq.pets.items.medicalInfo.question",
        answerKey: "help.helpCenter.faq.pets.items.medicalInfo.answer",
      },
      {
        questionKey: "help.helpCenter.faq.pets.items.behaviorProfile.question",
        answerKey: "help.helpCenter.faq.pets.items.behaviorProfile.answer",
      },
      {
        questionKey: "help.helpCenter.faq.pets.items.petsPage.question",
        answerKey: "help.helpCenter.faq.pets.items.petsPage.answer",
      },
      {
        questionKey: "help.helpCenter.faq.pets.items.weightTracking.question",
        answerKey: "help.helpCenter.faq.pets.items.weightTracking.answer",
      },
      {
        questionKey: "help.helpCenter.faq.pets.items.photos.question",
        answerKey: "help.helpCenter.faq.pets.items.photos.answer",
      },
      {
        questionKey: "help.helpCenter.faq.pets.items.careLog.question",
        answerKey: "help.helpCenter.faq.pets.items.careLog.answer",
      },
    ],
  },
  {
    id: "calendar",
    nameKey: "help.helpCenter.faq.calendar.name",
    icon: Calendar,
    items: [
      {
        questionKey: "help.helpCenter.faq.calendar.items.addAppointment.question",
        answerKey: "help.helpCenter.faq.calendar.items.addAppointment.answer",
      },
      {
        questionKey: "help.helpCenter.faq.calendar.items.views.question",
        answerKey: "help.helpCenter.faq.calendar.items.views.answer",
      },
      {
        questionKey: "help.helpCenter.faq.calendar.items.filterByType.question",
        answerKey: "help.helpCenter.faq.calendar.items.filterByType.answer",
      },
      {
        questionKey: "help.helpCenter.faq.calendar.items.categories.question",
        answerKey: "help.helpCenter.faq.calendar.items.categories.answer",
      },
      {
        questionKey: "help.helpCenter.faq.calendar.items.trainingTypes.question",
        answerKey: "help.helpCenter.faq.calendar.items.trainingTypes.answer",
      },
      {
        questionKey: "help.helpCenter.faq.calendar.items.googleColors.question",
        answerKey: "help.helpCenter.faq.calendar.items.googleColors.answer",
      },
      {
        questionKey: "help.helpCenter.faq.calendar.items.statuses.question",
        answerKey: "help.helpCenter.faq.calendar.items.statuses.answer",
      },
      {
        questionKey: "help.helpCenter.faq.calendar.items.whatsappReminders.question",
        answerKey: "help.helpCenter.faq.calendar.items.whatsappReminders.answer",
      },
      {
        questionKey: "help.helpCenter.faq.calendar.items.schedulingPage.question",
        answerKey: "help.helpCenter.faq.calendar.items.schedulingPage.answer",
      },
      {
        questionKey: "help.helpCenter.faq.calendar.items.tutorialVideo.question",
        answerKey: "help.helpCenter.faq.calendar.items.tutorialVideo.answer",
      },
    ],
  },
  {
    id: "tasks",
    nameKey: "help.helpCenter.faq.tasks.name",
    icon: ListTodo,
    items: [
      {
        questionKey: "help.helpCenter.faq.tasks.items.createTask.question",
        answerKey: "help.helpCenter.faq.tasks.items.createTask.answer",
      },
      {
        questionKey: "help.helpCenter.faq.tasks.items.categories.question",
        answerKey: "help.helpCenter.faq.tasks.items.categories.answer",
      },
      {
        questionKey: "help.helpCenter.faq.tasks.items.dueDateVsTime.question",
        answerKey: "help.helpCenter.faq.tasks.items.dueDateVsTime.answer",
      },
      {
        questionKey: "help.helpCenter.faq.tasks.items.markAndFilter.question",
        answerKey: "help.helpCenter.faq.tasks.items.markAndFilter.answer",
      },
    ],
  },
  {
    id: "leads",
    nameKey: "help.helpCenter.faq.leads.name",
    icon: Target,
    items: [
      {
        questionKey: "help.helpCenter.faq.leads.items.board.question",
        answerKey: "help.helpCenter.faq.leads.items.board.answer",
      },
      {
        questionKey: "help.helpCenter.faq.leads.items.dealValue.question",
        answerKey: "help.helpCenter.faq.leads.items.dealValue.answer",
      },
      {
        questionKey: "help.helpCenter.faq.leads.items.leadSource.question",
        answerKey: "help.helpCenter.faq.leads.items.leadSource.answer",
      },
      {
        questionKey: "help.helpCenter.faq.leads.items.salesReports.question",
        answerKey: "help.helpCenter.faq.leads.items.salesReports.answer",
      },
      {
        questionKey: "help.helpCenter.faq.leads.items.agingIndicator.question",
        answerKey: "help.helpCenter.faq.leads.items.agingIndicator.answer",
      },
      {
        questionKey: "help.helpCenter.faq.leads.items.createLead.question",
        answerKey: "help.helpCenter.faq.leads.items.createLead.answer",
      },
      {
        questionKey: "help.helpCenter.faq.leads.items.convert.question",
        answerKey: "help.helpCenter.faq.leads.items.convert.answer",
      },
      {
        questionKey: "help.helpCenter.faq.leads.items.callLog.question",
        answerKey: "help.helpCenter.faq.leads.items.callLog.answer",
      },
      {
        questionKey: "help.helpCenter.faq.leads.items.lost.question",
        answerKey: "help.helpCenter.faq.leads.items.lost.answer",
      },
    ],
  },
  {
    id: "bookings-online",
    nameKey: "help.helpCenter.faq.bookingsOnline.name",
    icon: CalendarCheck,
    items: [
      {
        questionKey: "help.helpCenter.faq.bookingsOnline.items.howItWorks.question",
        answerKey: "help.helpCenter.faq.bookingsOnline.items.howItWorks.answer",
      },
      {
        questionKey: "help.helpCenter.faq.bookingsOnline.items.approveDecline.question",
        answerKey: "help.helpCenter.faq.bookingsOnline.items.approveDecline.answer",
      },
      {
        questionKey: "help.helpCenter.faq.bookingsOnline.items.schedulingPage.question",
        answerKey: "help.helpCenter.faq.bookingsOnline.items.schedulingPage.answer",
      },
      {
        questionKey: "help.helpCenter.faq.bookingsOnline.items.intakeForms.question",
        answerKey: "help.helpCenter.faq.bookingsOnline.items.intakeForms.answer",
      },
    ],
  },
  {
    id: "boarding",
    nameKey: "help.helpCenter.faq.boarding.name",
    icon: Hotel,
    items: [
      {
        questionKey: "help.helpCenter.faq.boarding.items.rooms.question",
        answerKey: "help.helpCenter.faq.boarding.items.rooms.answer",
      },
      {
        questionKey: "help.helpCenter.faq.boarding.items.checkInOut.question",
        answerKey: "help.helpCenter.faq.boarding.items.checkInOut.answer",
      },
      {
        questionKey: "help.helpCenter.faq.boarding.items.lateBanner.question",
        answerKey: "help.helpCenter.faq.boarding.items.lateBanner.answer",
      },
      {
        questionKey: "help.helpCenter.faq.boarding.items.feedingBoard.question",
        answerKey: "help.helpCenter.faq.boarding.items.feedingBoard.answer",
      },
      {
        questionKey: "help.helpCenter.faq.boarding.items.medicationBoard.question",
        answerKey: "help.helpCenter.faq.boarding.items.medicationBoard.answer",
      },
      {
        questionKey: "help.helpCenter.faq.boarding.items.tabs.question",
        answerKey: "help.helpCenter.faq.boarding.items.tabs.answer",
      },
      {
        questionKey: "help.helpCenter.faq.boarding.items.yardMap.question",
        answerKey: "help.helpCenter.faq.boarding.items.yardMap.answer",
      },
    ],
  },
  {
    id: "training",
    nameKey: "help.helpCenter.faq.training.name",
    icon: Dog,
    items: [
      {
        questionKey: "help.helpCenter.faq.training.items.groupsVsPrograms.question",
        answerKey: "help.helpCenter.faq.training.items.groupsVsPrograms.answer",
      },
      {
        questionKey: "help.helpCenter.faq.training.items.createGroup.question",
        answerKey: "help.helpCenter.faq.training.items.createGroup.answer",
      },
      {
        questionKey: "help.helpCenter.faq.training.items.privateProgram.question",
        answerKey: "help.helpCenter.faq.training.items.privateProgram.answer",
      },
      {
        questionKey: "help.helpCenter.faq.training.items.attendance.question",
        answerKey: "help.helpCenter.faq.training.items.attendance.answer",
      },
    ],
  },
  {
    id: "service-dogs",
    nameKey: "help.helpCenter.faq.serviceDogs.name",
    icon: Shield,
    items: [
      {
        questionKey: "help.helpCenter.faq.serviceDogs.items.module.question",
        answerKey: "help.helpCenter.faq.serviceDogs.items.module.answer",
      },
      {
        questionKey: "help.helpCenter.faq.serviceDogs.items.dashboard.question",
        answerKey: "help.helpCenter.faq.serviceDogs.items.dashboard.answer",
      },
      {
        questionKey: "help.helpCenter.faq.serviceDogs.items.profileTabs.question",
        answerKey: "help.helpCenter.faq.serviceDogs.items.profileTabs.answer",
      },
      {
        questionKey: "help.helpCenter.faq.serviceDogs.items.phases.question",
        answerKey: "help.helpCenter.faq.serviceDogs.items.phases.answer",
      },
      {
        questionKey: "help.helpCenter.faq.serviceDogs.items.serviceTypes.question",
        answerKey: "help.helpCenter.faq.serviceDogs.items.serviceTypes.answer",
      },
      {
        questionKey: "help.helpCenter.faq.serviceDogs.items.location.question",
        answerKey: "help.helpCenter.faq.serviceDogs.items.location.answer",
      },
      {
        questionKey: "help.helpCenter.faq.serviceDogs.items.certificationTests.question",
        answerKey: "help.helpCenter.faq.serviceDogs.items.certificationTests.answer",
      },
      {
        questionKey: "help.helpCenter.faq.serviceDogs.items.trainingLog.question",
        answerKey: "help.helpCenter.faq.serviceDogs.items.trainingLog.answer",
      },
      {
        questionKey: "help.helpCenter.faq.serviceDogs.items.medicalProtocols.question",
        answerKey: "help.helpCenter.faq.serviceDogs.items.medicalProtocols.answer",
      },
      {
        questionKey: "help.helpCenter.faq.serviceDogs.items.digitalId.question",
        answerKey: "help.helpCenter.faq.serviceDogs.items.digitalId.answer",
      },
      {
        questionKey: "help.helpCenter.faq.serviceDogs.items.insurance.question",
        answerKey: "help.helpCenter.faq.serviceDogs.items.insurance.answer",
      },
      {
        questionKey: "help.helpCenter.faq.serviceDogs.items.recipients.question",
        answerKey: "help.helpCenter.faq.serviceDogs.items.recipients.answer",
      },
      {
        questionKey: "help.helpCenter.faq.serviceDogs.items.placement.question",
        answerKey: "help.helpCenter.faq.serviceDogs.items.placement.answer",
      },
      {
        questionKey: "help.helpCenter.faq.serviceDogs.items.import.question",
        answerKey: "help.helpCenter.faq.serviceDogs.items.import.answer",
      },
      {
        questionKey: "help.helpCenter.faq.serviceDogs.items.compliance.question",
        answerKey: "help.helpCenter.faq.serviceDogs.items.compliance.answer",
      },
      {
        questionKey: "help.helpCenter.faq.serviceDogs.items.reports.question",
        answerKey: "help.helpCenter.faq.serviceDogs.items.reports.answer",
      },
    ],
  },
  {
    id: "finance",
    nameKey: "help.helpCenter.faq.finance.name",
    icon: Wallet,
    items: [
      {
        questionKey: "help.helpCenter.faq.finance.items.payments.question",
        answerKey: "help.helpCenter.faq.finance.items.payments.answer",
      },
      {
        questionKey: "help.helpCenter.faq.finance.items.paymentRequest.question",
        answerKey: "help.helpCenter.faq.finance.items.paymentRequest.answer",
      },
      {
        questionKey: "help.helpCenter.faq.finance.items.priceList.question",
        answerKey: "help.helpCenter.faq.finance.items.priceList.answer",
      },
      {
        questionKey: "help.helpCenter.faq.finance.items.newOrder.question",
        answerKey: "help.helpCenter.faq.finance.items.newOrder.answer",
      },
      {
        questionKey: "help.helpCenter.faq.finance.items.boardingCalc.question",
        answerKey: "help.helpCenter.faq.finance.items.boardingCalc.answer",
      },
    ],
  },
  {
    id: "messages",
    nameKey: "help.helpCenter.faq.messages.name",
    icon: MessageSquare,
    items: [
      {
        questionKey: "help.helpCenter.faq.messages.items.notSending.question",
        answerKey: "help.helpCenter.faq.messages.items.notSending.answer",
      },
      {
        questionKey: "help.helpCenter.faq.messages.items.whySent.question",
        answerKey: "help.helpCenter.faq.messages.items.whySent.answer",
      },
      {
        questionKey: "help.helpCenter.faq.messages.items.createTemplate.question",
        answerKey: "help.helpCenter.faq.messages.items.createTemplate.answer",
      },
      {
        questionKey: "help.helpCenter.faq.messages.items.variables.question",
        answerKey: "help.helpCenter.faq.messages.items.variables.answer",
      },
      {
        questionKey: "help.helpCenter.faq.messages.items.whatsappReminders.question",
        answerKey: "help.helpCenter.faq.messages.items.whatsappReminders.answer",
      },
      {
        questionKey: "help.helpCenter.faq.messages.items.connectNumber.question",
        answerKey: "help.helpCenter.faq.messages.items.connectNumber.answer",
      },
      {
        questionKey: "help.helpCenter.faq.messages.items.automations.question",
        answerKey: "help.helpCenter.faq.messages.items.automations.answer",
      },
      {
        questionKey: "help.helpCenter.faq.messages.items.sendQueue.question",
        answerKey: "help.helpCenter.faq.messages.items.sendQueue.answer",
      },
      {
        questionKey: "help.helpCenter.faq.messages.items.whereSent.question",
        answerKey: "help.helpCenter.faq.messages.items.whereSent.answer",
      },
    ],
  },
  {
    id: "analytics",
    nameKey: "help.helpCenter.faq.analytics.name",
    icon: BarChart3,
    items: [
      {
        questionKey: "help.helpCenter.faq.analytics.items.whatsShown.question",
        answerKey: "help.helpCenter.faq.analytics.items.whatsShown.answer",
      },
      {
        questionKey: "help.helpCenter.faq.analytics.items.export.question",
        answerKey: "help.helpCenter.faq.analytics.items.export.answer",
      },
      {
        questionKey: "help.helpCenter.faq.analytics.items.import.question",
        answerKey: "help.helpCenter.faq.analytics.items.import.answer",
      },
    ],
  },
  {
    id: "settings",
    nameKey: "help.helpCenter.faq.settings.name",
    icon: Settings,
    items: [
      {
        questionKey: "help.helpCenter.faq.settings.items.whatCanManage.question",
        answerKey: "help.helpCenter.faq.settings.items.whatCanManage.answer",
      },
      {
        questionKey: "help.helpCenter.faq.settings.items.teamPermissions.question",
        answerKey: "help.helpCenter.faq.settings.items.teamPermissions.answer",
      },
      {
        questionKey: "help.helpCenter.faq.settings.items.businessAdmin.question",
        answerKey: "help.helpCenter.faq.settings.items.businessAdmin.answer",
      },
      {
        questionKey: "help.helpCenter.faq.settings.items.services.question",
        answerKey: "help.helpCenter.faq.settings.items.services.answer",
      },
      {
        questionKey: "help.helpCenter.faq.settings.items.googleCalendar.question",
        answerKey: "help.helpCenter.faq.settings.items.googleCalendar.answer",
      },
      {
        questionKey: "help.helpCenter.faq.settings.items.webhook.question",
        answerKey: "help.helpCenter.faq.settings.items.webhook.answer",
      },
    ],
  },
  {
    id: "general",
    nameKey: "help.helpCenter.faq.general.name",
    icon: HelpCircle,
    items: [
      {
        questionKey: "help.helpCenter.faq.general.items.firstLogin.question",
        answerKey: "help.helpCenter.faq.general.items.firstLogin.answer",
      },
      {
        questionKey: "help.helpCenter.faq.general.items.permissionLevels.question",
        answerKey: "help.helpCenter.faq.general.items.permissionLevels.answer",
      },
      {
        questionKey: "help.helpCenter.faq.general.items.pendingApprovals.question",
        answerKey: "help.helpCenter.faq.general.items.pendingApprovals.answer",
      },
      {
        questionKey: "help.helpCenter.faq.general.items.bottomBar.question",
        answerKey: "help.helpCenter.faq.general.items.bottomBar.answer",
      },
      {
        questionKey: "help.helpCenter.faq.general.items.tutorialVideos.question",
        answerKey: "help.helpCenter.faq.general.items.tutorialVideos.answer",
      },
      {
        questionKey: "help.helpCenter.faq.general.items.mobile.question",
        answerKey: "help.helpCenter.faq.general.items.mobile.answer",
      },
      {
        questionKey: "help.helpCenter.faq.general.items.session.question",
        answerKey: "help.helpCenter.faq.general.items.session.answer",
      },
      {
        questionKey: "help.helpCenter.faq.general.items.reportBug.question",
        answerKey: "help.helpCenter.faq.general.items.reportBug.answer",
      },
    ],
  },
];

const changelog = [
  {
    version: "v19.0",
    id: "v19",
    items: ["dashboard", "clientList", "clientCard", "clientMerge", "salesBoard", "salesAttribution", "reports", "businessAdmin", "permissions", "settings", "aiAssistant", "boardingServiceDogs", "mobile"],
  },
  {
    version: "v18.0",
    id: "v18",
    items: ["aiAssistant", "messagesMenu", "deliveryTracking", "quickPayment", "calendar", "stability"],
  },
  {
    version: "v17.0",
    id: "v17",
    items: ["messageControl", "salesAutomations", "contracts", "salesReports", "petsPage", "orders", "intakeForms", "navigation"],
  },
  {
    version: "v16.0",
    id: "v16",
    items: ["categoryFilter", "lenses", "trainingTypes", "taskFilter", "googleColors", "savedFilter", "thanks"],
  },
  {
    version: "v15.0",
    id: "v15",
    items: ["calendarSessions", "groupReminders", "weeklySeries", "metrics", "followUpTasks", "reschedule", "stability"],
  },
  {
    version: "v14.0",
    id: "v14",
    items: ["videoLibrary", "calendarVideo", "landingScreenshot", "mobileTutorials", "newBadges", "safariFix", "tryNow"],
  },
  {
    version: "v13.0",
    id: "v13",
    items: ["screenshot", "yardPrint", "raisingPhase", "certTests", "xlsxExport", "rejectedArchive", "ux"],
  },
  {
    version: "v12.0",
    id: "v12",
    items: ["import", "mobileBar", "performance", "nullFix"],
  },
  {
    version: "v11.0",
    id: "v11",
    items: ["levels", "pendingApprovals", "sensitiveFields", "doubleConfirm", "locationTracking"],
  },
  {
    version: "v10.0",
    id: "v10",
    items: ["reminders", "paymentRequest", "googleCalendar", "templates"],
  },
  {
    version: "v9.0",
    id: "v9",
    items: ["rememberMe", "placement", "dashboard", "lateBanner"],
  },
  {
    version: "v8.0",
    id: "v8",
    items: ["weight", "gallery", "careLog", "breeds", "export"],
  },
  {
    version: "v7.0",
    id: "v7",
    items: ["cloudApi", "dashboard", "security"],
  },
  {
    version: "v6.0",
    id: "v6",
    items: ["export", "dragDrop", "customStages"],
  },
  {
    version: "v5.0",
    id: "v5",
    items: ["tabs", "digitalId", "recipientsKanban", "placementStatuses"],
  },
];

function AccordionItem({ item }: { item: FaqItem }) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-petra-border last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3.5 px-4 text-start hover:bg-slate-50 transition-colors duration-150 gap-3"
      >
        <span className="text-sm font-medium text-petra-text leading-relaxed">
          {t(item.questionKey)}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-petra-muted flex-shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <p className="px-4 pb-4 text-sm text-petra-muted leading-relaxed">
          {t(item.answerKey)}
        </p>
      </div>
    </div>
  );
}

type Tab = "faq" | "changelog" | "contact";

interface HelpCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpCenter({ open, onOpenChange }: HelpCenterProps) {
  const t = useTranslations("help.helpCenter");
  const tr = useTranslations();
  const [activeTab, setActiveTab] = useState<Tab>("faq");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [bugDescription, setBugDescription] = useState("");
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  function handleScreenshotChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("bugReport.fileTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotBase64(reader.result as string);
      setScreenshotName(file.name);
    };
    reader.readAsDataURL(file);
  }

  const bugMutation = useMutation({
    mutationFn: async (description: string) => {
      const autoTitle = description.slice(0, 60).trim() || t("bugReport.defaultTitle");
      const res = await fetch("/api/support/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: autoTitle, description, pageUrl: pathname, screenshotBase64 }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? t("bugReport.errorGeneric"));
      }
      return res.json();
    },
    onSuccess: (data: { id?: string }) => {
      toast.success(t("bugReport.success"), {
        description: t("bugReport.successDescription"),
        action: data?.id
          ? { label: t("bugReport.viewTicket"), onClick: () => { onOpenChange(false); router.push(`/support?ticket=${data.id}`); } }
          : undefined,
      });
      setBugDescription("");
      setScreenshotBase64(null);
      setScreenshotName(null);
      if (screenshotInputRef.current) screenshotInputRef.current.value = "";
    },
    onError: (err: Error) => {
      toast.error(err.message || t("bugReport.sendError"));
    },
  });

  const filteredCategories = useMemo(() => {
    if (!search.trim() && !selectedCategory) return faqCategories;

    return faqCategories
      .filter((cat) => !selectedCategory || cat.id === selectedCategory)
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            !search.trim() ||
            tr(item.questionKey).includes(search) ||
            tr(item.answerKey).includes(search)
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [search, selectedCategory, tr]);

  const totalResults = filteredCategories.reduce(
    (acc, cat) => acc + cat.items.length,
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-0 border-b border-petra-border space-y-0">
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="text-xl font-bold text-petra-text">
              {t("title")}
            </DialogTitle>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-petra-border -mb-px">
            {(
              [
                { id: "faq" as Tab },
                { id: "changelog" as Tab },
                { id: "contact" as Tab },
              ] as { id: Tab }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-brand-500 text-brand-600"
                    : "border-transparent text-petra-muted hover:text-petra-text"
                )}
              >
                {t(`tabs.${tab.id}`)}
              </button>
            ))}
          </div>

          {/* FAQ search + category pills — only on FAQ tab */}
          {activeTab === "faq" && (
            <div className="pt-4 space-y-3 pb-4">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted" />
                <input
                  type="text"
                  placeholder={t("faqTab.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input ps-10"
                />
              </div>

              <div className="flex flex-nowrap overflow-x-auto scrollbar-hide sm:flex-wrap sm:overflow-visible gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={cn(
                    "badge flex-shrink-0 whitespace-nowrap transition-colors duration-150 cursor-pointer",
                    !selectedCategory
                      ? "bg-brand-50 text-brand-700 border border-brand-100"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {t("faqTab.all")}
                </button>
                {faqCategories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() =>
                        setSelectedCategory(
                          selectedCategory === cat.id ? null : cat.id
                        )
                      }
                      className={cn(
                        "badge flex-shrink-0 whitespace-nowrap gap-1.5 transition-colors duration-150 cursor-pointer",
                        selectedCategory === cat.id
                          ? "bg-brand-50 text-brand-700 border border-brand-100"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {tr(cat.nameKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-5">
          {/* FAQ Tab */}
          {activeTab === "faq" && (
            <>
              {filteredCategories.length === 0 ? (
                <div className="empty-state py-12">
                  <div className="empty-state-icon">
                    <Search className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-petra-text mb-1">
                    {t("faqTab.noResults")}
                  </p>
                  <p className="text-xs text-petra-muted">
                    {t("faqTab.tryOtherWords")}
                  </p>
                </div>
              ) : (
                filteredCategories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <div key={category.id} className="card overflow-hidden">
                      <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50/80 border-b border-petra-border">
                        <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5 text-brand-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-petra-text">
                          {tr(category.nameKey)}
                        </h3>
                        <span className="badge-neutral text-[10px] ms-auto">
                          {t("faqTab.questionsCount", { count: category.items.length })}
                        </span>
                      </div>

                      {category.items.map((item, idx) => (
                        <AccordionItem key={idx} item={item} />
                      ))}
                    </div>
                  );
                })
              )}

              {search.trim() && filteredCategories.length > 0 && (
                <p className="text-center text-xs text-petra-muted pt-2">
                  {t("faqTab.resultsFound", { count: totalResults })}
                </p>
              )}
            </>
          )}

          {/* Changelog Tab */}
          {activeTab === "changelog" && (
            <div className="space-y-4">
              {changelog.map((release) => (
                <div key={release.version} className="card overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/80 border-b border-petra-border">
                    <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-petra-text">
                          {t(`changelog.${release.id}.title`)}
                        </span>
                        <span className="badge bg-brand-50 text-brand-700 border border-brand-100 text-[10px]">
                          {release.version}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-petra-muted">{t(`changelog.${release.id}.date`)}</span>
                  </div>
                  <ul className="px-4 py-3 space-y-1.5">
                    {release.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-petra-muted">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                        {t(`changelog.${release.id}.items.${item}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Contact Tab */}
          {activeTab === "contact" && (
            <div className="space-y-4">
              <div className="card p-5 space-y-4">
                <h3 className="text-base font-semibold text-petra-text">
                  {t("contact.heading")}
                </h3>
                <div className="space-y-3">
                  <Link
                    href="/support"
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-orange-200 bg-orange-50/50 hover:bg-orange-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <LifeBuoy className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-petra-text">{t("contact.myTickets")}</p>
                      <p className="text-xs text-petra-muted">{t("contact.myTicketsDescription")}</p>
                    </div>
                  </Link>

                  <a
                    href="https://wa.me/972504828080"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl border border-petra-border hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-petra-text">WhatsApp</p>
                      <p className="text-xs text-petra-muted">050-482-8080</p>
                    </div>
                  </a>

                  <a
                    href="mailto:alldogneed@gmail.com"
                    className="flex items-center gap-3 p-3 rounded-xl border border-petra-border hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-petra-text">{t("contact.email")}</p>
                      <p className="text-xs text-petra-muted">alldogneed@gmail.com</p>
                    </div>
                  </a>
                </div>
              </div>

              <div className="card p-5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-petra-text mb-1">{t("contact.responseTime")}</p>
                  <p className="text-sm text-petra-muted">
                    {t("contact.whatsappResponse")}
                  </p>
                  <p className="text-sm text-petra-muted mt-1">
                    {t("contact.emailResponse")}
                  </p>
                </div>
              </div>

              {/* Bug report form */}
              <div className="card overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-3 bg-orange-50/80 border-b border-petra-border">
                  <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                    <LifeBuoy className="w-3.5 h-3.5 text-orange-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-petra-text">{t("bugReport.heading")}</h3>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (bugDescription.trim().length < 10) return;
                    bugMutation.mutate(bugDescription.trim());
                  }}
                  className="p-4 space-y-3"
                >
                  <textarea
                    className="input w-full resize-none text-sm"
                    rows={4}
                    placeholder={t("bugReport.placeholder")}
                    value={bugDescription}
                    onChange={(e) => setBugDescription(e.target.value)}
                    maxLength={1000}
                  />

                  {/* Screenshot upload */}
                  <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/60 px-4 py-3">
                    <p className="text-xs font-medium text-amber-800 mb-2">
                      {t("bugReport.screenshotHint")}
                    </p>
                    {screenshotBase64 ? (
                      <div className="flex items-center gap-2">
                        <img src={screenshotBase64} alt="screenshot preview" className="h-16 w-24 object-cover rounded-lg border border-amber-300 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-petra-text truncate">{screenshotName}</p>
                          <p className="text-[10px] text-green-600 mt-0.5">{t("bugReport.screenshotReady")}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setScreenshotBase64(null); setScreenshotName(null); if (screenshotInputRef.current) screenshotInputRef.current.value = ""; }}
                          className="w-6 h-6 rounded-full bg-red-100 text-red-500 hover:bg-red-200 flex items-center justify-center flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => screenshotInputRef.current?.click()}
                        className="flex items-center gap-2 text-xs text-amber-700 hover:text-amber-900 font-medium transition-colors"
                      >
                        <ImagePlus className="w-4 h-4" />
                        {t("bugReport.attachScreenshot")}
                      </button>
                    )}
                    <input
                      ref={screenshotInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleScreenshotChange}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-petra-muted">
                      {t("bugReport.footerNote")}
                    </p>
                    <button
                      type="submit"
                      disabled={bugMutation.isPending || bugDescription.trim().length < 10}
                      className="btn-primary gap-2 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {bugMutation.isPending ? t("bugReport.sending") : t("bugReport.send")}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
