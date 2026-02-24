import { formatCurrency } from "./utils";

export interface AnalyticsInsight {
  type: "warning" | "success" | "info";
  message: string;
}

interface OverviewData {
  revenue: number;
  collected: number;
  outstanding: number;
  bookingsCount: number;
  cancelRate: number;
  noShowRate: number;
  topService?: { name: string; revenue: number } | null;
  vsLastPeriod: {
    revenue?: number;
    collected?: number;
    bookingsCount?: number;
    cancelRate?: number;
  };
}

export function generateOverviewInsights(data: OverviewData): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];

  if (data.cancelRate > 0.2) {
    insights.push({
      type: "warning",
      message: `שיעור הביטולים עומד על ${(data.cancelRate * 100).toFixed(0)}% — גבוה מהמומלץ. שקול שליחת תזכורות אוטומטיות.`,
    });
  }

  if (
    data.vsLastPeriod.cancelRate !== undefined &&
    data.vsLastPeriod.cancelRate < -0.1 &&
    data.cancelRate <= 0.2
  ) {
    insights.push({
      type: "success",
      message: `שיעור הביטולים ירד ב-${Math.abs(data.vsLastPeriod.cancelRate * 100).toFixed(0)}% לעומת התקופה הקודמת — שיפור משמעותי!`,
    });
  }

  if (
    data.vsLastPeriod.revenue !== undefined &&
    data.vsLastPeriod.revenue > 0.2
  ) {
    insights.push({
      type: "success",
      message: `ההכנסות גדלו ב-${(data.vsLastPeriod.revenue * 100).toFixed(0)}% לעומת התקופה המקבילה.`,
    });
  }

  if (data.vsLastPeriod.bookingsCount !== undefined && data.vsLastPeriod.bookingsCount < -0.15) {
    insights.push({
      type: "warning",
      message: `מספר התורים ירד ב-${Math.abs(data.vsLastPeriod.bookingsCount * 100).toFixed(0)}% לעומת התקופה הקודמת.`,
    });
  }

  const totalBilled = data.collected + data.outstanding;
  if (data.outstanding > 0 && totalBilled > 0) {
    const pct = data.outstanding / totalBilled;
    if (pct > 0.3) {
      insights.push({
        type: "warning",
        message: `${(pct * 100).toFixed(0)}% מהסכומים עדיין לא גבויים (${formatCurrency(data.outstanding)}).`,
      });
    }
  }

  if (data.topService) {
    insights.push({
      type: "info",
      message: `השירות הרווחי ביותר בתקופה: "${data.topService.name}" עם הכנסה של ${formatCurrency(data.topService.revenue)}.`,
    });
  }

  if (data.noShowRate > 0.1) {
    insights.push({
      type: "warning",
      message: `שיעור אי-ההגעה עומד על ${(data.noShowRate * 100).toFixed(0)}% — שקול לאשר תורים בהודעה אוטומטית.`,
    });
  }

  return insights.slice(0, 2);
}

export function generateRevenueInsights(data: {
  collected: number;
  outstanding: number;
  avgTicket: number;
  vsLastPeriod: { collected?: number };
}): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];

  if (data.vsLastPeriod.collected !== undefined && data.vsLastPeriod.collected > 0.15) {
    insights.push({
      type: "success",
      message: `ההכנסות גדלו ב-${(data.vsLastPeriod.collected * 100).toFixed(0)}% לעומת התקופה הקודמת.`,
    });
  }

  const outstanding = data.outstanding;
  const total = data.collected + data.outstanding;
  if (outstanding > 0 && total > 0 && outstanding / total > 0.25) {
    insights.push({
      type: "warning",
      message: `${formatCurrency(outstanding)} ממתינים לגבייה — ${((outstanding / total) * 100).toFixed(0)}% מסך ההכנסה הצפויה.`,
    });
  }

  return insights.slice(0, 2);
}

export function generateCancellationInsights(data: {
  cancellations: number;
  noShows: number;
  estimatedLostRevenue: number;
  problematicService?: { name: string; count: number } | null;
}): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];

  if (data.estimatedLostRevenue > 0) {
    insights.push({
      type: "warning",
      message: `הביטולים ואי-ההגעות גרמו לאובדן הכנסה משוער של ${formatCurrency(data.estimatedLostRevenue)}.`,
    });
  }

  if (data.problematicService && data.problematicService.count >= 3) {
    insights.push({
      type: "info",
      message: `השירות עם הכי הרבה ביטולים: "${data.problematicService.name}" (${data.problematicService.count} ביטולים).`,
    });
  }

  return insights.slice(0, 2);
}
