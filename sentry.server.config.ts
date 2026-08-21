import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Don't send errors in development
  beforeSend(event) {
    if (process.env.NODE_ENV === "development") return null;
    // Never ship MCP path tokens (/api/mcp/u/<token>) to Sentry
    if (event.request?.url) {
      event.request.url = event.request.url.replace(/petra_mcp_[0-9a-f]{64}/g, "petra_mcp_[redacted]");
    }
    return event;
  },

  // Performance — low sample rate to keep costs minimal
  tracesSampleRate: 0.05,

  debug: false,
});
