REVOKE EXECUTE ON FUNCTION public.set_ticket_ref() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_ticket_insert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_ticket_update() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_note_insert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_initial_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.reopen_ticket(uuid, text) FROM anon;