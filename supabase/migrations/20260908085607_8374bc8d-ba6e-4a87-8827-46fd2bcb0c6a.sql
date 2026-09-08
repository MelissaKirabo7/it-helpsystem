CREATE POLICY "upload own ticket images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND owner = auth.uid()
  );

CREATE POLICY "read permitted ticket images" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND (
      owner = auth.uid()
      OR public.is_staff(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.ticket_attachments a
        JOIN public.tickets t ON t.id = a.ticket_id
        WHERE a.path = storage.objects.name AND t.submitter_id = auth.uid()
      )
    )
  );