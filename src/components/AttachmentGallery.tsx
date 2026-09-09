import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/attachments";
import type { TicketAttachment } from "@/lib/tickets";

/** Renders private ticket screenshots through short-lived signed links. */
export function AttachmentGallery({ items }: { items: TicketAttachment[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let live = true;
    void (async () => {
      const entries = await Promise.all(
        items.map(async (a) => [a.id, (await signedUrl(a.path)) ?? ""] as const),
      );
      if (live) setUrls(Object.fromEntries(entries));
    })();
    return () => {
      live = false;
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((a) => {
        const url = urls[a.id];
        return url ? (
          <a key={a.id} href={url} target="_blank" rel="noreferrer" title={a.fileName}>
            <img
              src={url}
              alt={a.fileName}
              className="size-24 rounded-xl border border-border object-cover transition-opacity hover:opacity-80"
            />
          </a>
        ) : (
          <div key={a.id} className="size-24 animate-pulse rounded-xl bg-muted" />
        );
      })}
    </div>
  );
}
