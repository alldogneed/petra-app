"use client";

import { MessagesPanel } from "@/components/messages/messages-panel";

export default function MessagesPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="page-title">הודעות</h1>
      </div>
      <MessagesPanel />
    </div>
  );
}
