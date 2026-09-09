import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { MAX_ATTACHMENT_BYTES } from "@/lib/attachments";

/**
 * Screenshot picker: click to browse, or paste (Ctrl/Cmd+V) anywhere in the
 * surrounding form area to attach an image straight from the clipboard.
 */
export function ScreenshotInput({
  files,
  onChange,
  label = "Attach screenshots",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function add(incoming: File[]) {
    const images = incoming.filter((f) => f.type.startsWith("image/"));
    if (images.length !== incoming.length) setError("Only image files can be attached.");
    const sized = images.filter((f) => f.size <= MAX_ATTACHMENT_BYTES);
    if (sized.length !== images.length) setError("Each image must be 10 MB or smaller.");
    if (sized.length) {
      setError("");
      onChange([...files, ...sized].slice(0, 5));
    }
  }

  useEffect(() => {
    const node = wrapRef.current?.closest("form") ?? wrapRef.current;
    if (!node) return;
    const onPaste = (e: Event) => {
      const items = (e as ClipboardEvent).clipboardData?.items;
      if (!items) return;
      const pasted: File[] = [];
      for (const item of items) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) pasted.push(f);
        }
      }
      if (pasted.length) {
        e.preventDefault();
        add(pasted);
      }
    };
    node.addEventListener("paste", onPaste);
    return () => node.removeEventListener("paste", onPaste);
  });

  return (
    <div ref={wrapRef} className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-full border border-dashed border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
      >
        <ImagePlus className="size-4" /> {label} — or paste with Ctrl/Cmd + V
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          add(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="relative">
              <img
                src={previews[i]}
                alt={f.name}
                className="size-20 rounded-xl border border-border object-cover"
              />
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full bg-foreground text-card"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
