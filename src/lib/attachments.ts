import { supabase } from "@/integrations/supabase/client";

export const ATTACHMENT_BUCKET = "ticket-attachments";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Uploads images to private storage and records them against a ticket / note. */
export async function uploadAttachments(
  files: File[],
  opts: { ticketId: string; noteId?: string | null; userId: string },
): Promise<void> {
  for (const file of files) {
    if (!file.type.startsWith("image/") || file.size > MAX_ATTACHMENT_BYTES) continue;
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${opts.userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;
    const { error } = await supabase.from("ticket_attachments").insert({
      ticket_id: opts.ticketId,
      note_id: opts.noteId ?? null,
      path,
      file_name: file.name || "screenshot.png",
      uploaded_by: opts.userId,
    });
    if (error) throw error;
  }
}

export async function signedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
