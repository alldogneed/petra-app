"use client";

import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { ASSISTANT_VIDEOS } from "@/lib/assistant/catalog.generated";
import { resolveAssistantScreen } from "@/lib/assistant/screens";

/**
 * Renders a Petra AI answer: paragraphs, lists, **bold** and links.
 * Built from React nodes only (no HTML injection). A link becomes clickable only
 * when it points at a known Petra screen or a known tutorial video — anything
 * else the model writes stays plain text.
 */

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function renderInline(text: string, onNavigate: () => void): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    last = index + match[0].length;

    if (match[1] !== undefined) {
      nodes.push(<strong key={key++} className="font-semibold">{match[1]}</strong>);
      continue;
    }
    const label = match[2];
    const href = match[3];
    const video = href.startsWith("video:") ? ASSISTANT_VIDEOS[href.slice(6)] : undefined;
    if (video) {
      nodes.push(
        <a
          key={key++}
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700"
        >
          <PlayCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
          {label} ({video.durationLabel})
        </a>
      );
    } else if (resolveAssistantScreen(href)) {
      nodes.push(
        <Link
          key={key++}
          href={href}
          onClick={onNavigate}
          className="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700"
        >
          {label}
        </Link>
      );
    } else {
      nodes.push(label);
    }
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ol" | "ul"; items: string[] };

function toBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    const last = blocks[blocks.length - 1];
    if (!line) {
      // blank line ends the current paragraph
      if (last?.kind === "p") blocks.push({ kind: "p", lines: [] });
      continue;
    }
    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (ordered || bullet) {
      const kind = ordered ? "ol" : "ul";
      const item = (ordered ?? bullet)![1];
      if (last?.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else if (last?.kind === "p") {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "p", lines: [line] });
    }
  }
  return blocks.filter((b) => (b.kind === "p" ? b.lines.length > 0 : b.items.length > 0));
}

export function AssistantMarkdown({ content, onNavigate }: { content: string; onNavigate: () => void }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {toBlocks(content).map((block, i) => {
        if (block.kind === "p") {
          return (
            <p key={i}>
              {block.lines.map((line, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {renderInline(line, onNavigate)}
                </Fragment>
              ))}
            </p>
          );
        }
        const List = block.kind === "ol" ? "ol" : "ul";
        return (
          <List key={i} className={block.kind === "ol" ? "list-decimal pr-5 space-y-1" : "list-disc pr-5 space-y-1"}>
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item, onNavigate)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
