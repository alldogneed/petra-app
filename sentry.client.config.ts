import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Show a dialog so users can describe what happened when an error occurs
  // Set to false to suppress the feedback dialog
  beforeSend(event) {
    // Don't send in development
    if (process.env.NODE_ENV === "development") return null;
    return event;
  },

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions (keep costs low)

  // Replay — capture 1% of sessions, 100% on errors
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and inputs (GDPR / privacy for Israeli users)
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Don't log errors in development
  debug: false,
});
