import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Don't send errors in development
  beforeSend(event) {
    if (process.env.NODE_ENV === "development") return null;
    return event;
  },

  // Performance — low sample rate to keep costs minimal
  tracesSampleRate: 0.05,

  debug: false,
});
