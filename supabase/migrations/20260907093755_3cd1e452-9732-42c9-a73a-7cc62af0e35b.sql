-- ROLES ---------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('admin', 'technician', 'submitter');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'technician')
  )
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "self submitter role" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'submitter');
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PROFILES ------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  department text NOT NULL DEFAULT '',
  room text NOT NULL DEFAULT '',
  workstation text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own or staff reads all" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "admins manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- first person to sign up can claim admin
CREATE OR REPLACE FUNCTION public.claim_initial_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT count(*) INTO existing FROM public.user_roles WHERE role = 'admin';
  IF existing > 0 THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'technician')
    ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

-- TICKETS -------------------------------------------------------------
CREATE SEQUENCE public.ticket_ref_seq START 4181;

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  priority text NOT NULL DEFAULT 'Medium',
  status text NOT NULL DEFAULT 'New',
  submitter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitter_name text NOT NULL,
  submitter_email text NOT NULL,
  department text NOT NULL DEFAULT '',
  room text NOT NULL DEFAULT '',
  workstation text NOT NULL DEFAULT '',
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_name text,
  resolution_notes text,
  resolved_at timestamptz,
  reopened_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tickets_status_check CHECK (status IN ('New', 'In Progress', 'Pending', 'Resolved')),
  CONSTRAINT tickets_priority_check CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  CONSTRAINT tickets_title_len CHECK (char_length(title) BETWEEN 6 AND 120),
  CONSTRAINT tickets_desc_len CHECK (char_length(description) BETWEEN 20 AND 2000)
);
CREATE INDEX tickets_status_idx ON public.tickets (status);
CREATE INDEX tickets_submitter_idx ON public.tickets (submitter_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own or staff read tickets" ON public.tickets FOR SELECT TO authenticated
  USING (submitter_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "submit own tickets" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (submitter_id = auth.uid());
CREATE POLICY "staff update tickets" ON public.tickets FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "admins delete tickets" ON public.tickets FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_ticket_ref()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ref IS NULL OR NEW.ref = '' THEN
    NEW.ref := 'RC-' || nextval('public.ticket_ref_seq');
  END IF;
  RETURN NEW;
END;
$$;
ALTER TABLE public.tickets ALTER COLUMN ref DROP NOT NULL;
CREATE TRIGGER tickets_set_ref BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_ref();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
CREATE TRIGGER tickets_touch BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- TIMELINE NOTES ------------------------------------------------------
CREATE TABLE public.ticket_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  visibility text NOT NULL DEFAULT 'public',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notes_visibility_check CHECK (visibility IN ('public', 'internal')),
  CONSTRAINT notes_body_len CHECK (char_length(body) BETWEEN 1 AND 2000)
);
CREATE INDEX ticket_notes_ticket_idx ON public.ticket_notes (ticket_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_notes TO authenticated;
GRANT ALL ON public.ticket_notes TO service_role;
ALTER TABLE public.ticket_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read allowed notes" ON public.ticket_notes FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR (visibility = 'public' AND EXISTS (
      SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.submitter_id = auth.uid()
    ))
  );
CREATE POLICY "staff write notes" ON public.ticket_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND author_id = auth.uid());
CREATE POLICY "submitter public reply" ON public.ticket_notes FOR INSERT TO authenticated
  WITH CHECK (
    visibility = 'public' AND author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.submitter_id = auth.uid())
  );

-- AUDIT LOG -----------------------------------------------------------
CREATE TABLE public.ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  label text NOT NULL,
  actor_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_events_ticket_idx ON public.ticket_events (ticket_id);
GRANT SELECT ON public.ticket_events TO authenticated;
GRANT ALL ON public.ticket_events TO service_role;
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read allowed events" ON public.ticket_events FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.submitter_id = auth.uid())
  );

-- ATTACHMENTS ---------------------------------------------------------
CREATE TABLE public.ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  note_id uuid REFERENCES public.ticket_notes(id) ON DELETE CASCADE,
  path text NOT NULL,
  file_name text NOT NULL DEFAULT 'screenshot.png',
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_attachments_ticket_idx ON public.ticket_attachments (ticket_id);
GRANT SELECT, INSERT, DELETE ON public.ticket_attachments TO authenticated;
GRANT ALL ON public.ticket_attachments TO service_role;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read allowed attachments" ON public.ticket_attachments FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.submitter_id = auth.uid())
  );
CREATE POLICY "attach to allowed ticket" ON public.ticket_attachments FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      public.is_staff(auth.uid())
      OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.submitter_id = auth.uid())
    )
  );

-- NOTIFICATIONS -------------------------------------------------------
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  ticket_ref text,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "mark own notifications read" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- AUTOMATIC HISTORY + NOTIFICATIONS -----------------------------------
CREATE OR REPLACE FUNCTION public.log_ticket_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.ticket_events (ticket_id, label, actor_id, actor_name)
  VALUES (NEW.id, 'Ticket submitted via self-service portal', NEW.submitter_id, NEW.submitter_name);
  RETURN NEW;
END;
$$;
CREATE TRIGGER tickets_log_insert AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_insert();

CREATE OR REPLACE FUNCTION public.log_ticket_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    INSERT INTO public.ticket_events (ticket_id, label, actor_id)
    VALUES (NEW.id, COALESCE('Assigned to ' || NEW.assignee_name, 'Unassigned'), auth.uid());
    IF NEW.assignee_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, ticket_id, ticket_ref, title, body)
      VALUES (NEW.assignee_id, NEW.id, NEW.ref, 'Ticket assigned to you', NEW.title);
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.ticket_events (ticket_id, label, actor_id)
    VALUES (NEW.id, 'Status changed to ' || NEW.status, auth.uid());
    IF NEW.submitter_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, ticket_id, ticket_ref, title, body)
      VALUES (
        NEW.submitter_id, NEW.id, NEW.ref,
        CASE WHEN NEW.status = 'Resolved' THEN 'Your ticket was resolved'
             ELSE 'Ticket status: ' || NEW.status END,
        NEW.title
      );
    END IF;
  END IF;

  IF NEW.status = 'Resolved' AND OLD.status <> 'Resolved' THEN
    INSERT INTO public.ticket_events (ticket_id, label, actor_id)
    VALUES (NEW.id, 'Resolved — archived and submitter notified', auth.uid());
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER tickets_log_update AFTER UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_update();

CREATE OR REPLACE FUNCTION public.log_note_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tickets;
BEGIN
  SELECT * INTO t FROM public.tickets WHERE id = NEW.ticket_id;
  INSERT INTO public.ticket_events (ticket_id, label, actor_id, actor_name)
  VALUES (
    NEW.ticket_id,
    CASE WHEN NEW.visibility = 'internal' THEN 'Internal note added by ' || NEW.author_name
         ELSE 'Public update from ' || NEW.author_name END,
    NEW.author_id, NEW.author_name
  );
  IF NEW.visibility = 'public' THEN
    IF t.submitter_id IS NOT NULL AND t.submitter_id <> COALESCE(NEW.author_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, ticket_id, ticket_ref, title, body)
      VALUES (t.submitter_id, t.id, t.ref, 'New update on your ticket', NEW.body);
    END IF;
    IF t.assignee_id IS NOT NULL AND t.assignee_id <> COALESCE(NEW.author_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, ticket_id, ticket_ref, title, body)
      VALUES (t.assignee_id, t.id, t.ref, 'Submitter replied on a ticket', NEW.body);
    END IF;
  END IF;
  UPDATE public.tickets SET updated_at = now() WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ticket_notes_log AFTER INSERT ON public.ticket_notes
  FOR EACH ROW EXECUTE FUNCTION public.log_note_insert();

-- REOPEN WINDOW (5 days) ---------------------------------------------
CREATE OR REPLACE FUNCTION public.reopen_ticket(_ticket_id uuid, _reason text)
RETURNS public.tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tickets;
BEGIN
  SELECT * INTO t FROM public.tickets WHERE id = _ticket_id;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Ticket not found'; END IF;
  IF NOT (t.submitter_id = auth.uid() OR public.is_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF t.status <> 'Resolved' THEN RAISE EXCEPTION 'Ticket is not resolved'; END IF;
  IF t.resolved_at IS NULL OR t.resolved_at < now() - interval '5 days' THEN
    RAISE EXCEPTION 'The 5-day reopen window has closed';
  END IF;

  UPDATE public.tickets
     SET status = 'New', resolved_at = NULL, resolution_notes = NULL,
         reopened_count = reopened_count + 1, updated_at = now()
   WHERE id = _ticket_id
  RETURNING * INTO t;

  INSERT INTO public.ticket_events (ticket_id, label, actor_id)
  VALUES (_ticket_id, 'Reopened by submitter within the 5-day window', auth.uid());

  IF _reason IS NOT NULL AND char_length(trim(_reason)) > 0 THEN
    INSERT INTO public.ticket_notes (ticket_id, author_id, author_name, visibility, body)
    VALUES (_ticket_id, auth.uid(), COALESCE(t.submitter_name, 'Submitter'), 'public', trim(_reason));
  END IF;

  RETURN t;
END;
$$;

-- DEMO DATA -----------------------------------------------------------
INSERT INTO public.tickets
  (ref, title, description, category, priority, status, submitter_name, submitter_email, department, room, workstation, assignee_name, created_at, updated_at, resolved_at, resolution_notes)
VALUES
  ('RC-4172', 'Laptop will not power on after weekend', 'The ThinkPad at my desk shows no lights when plugged in. I tried a different wall socket and the dock, no change.', 'Hardware', 'Critical', 'New', 'Aisha Bello', 'aisha.bello@lokomax.com', 'Finance', 'Block B · Room 214', 'WS-FIN-214-07', NULL, now() - interval '5 hours', now() - interval '5 hours', NULL, NULL),
  ('RC-4173', 'Cannot reach shared drive from meeting room 3', 'Wi-Fi connects but the shared drive path times out. Wired port works fine.', 'Network/Wi-Fi', 'High', 'In Progress', 'Stephen John', 'stephen.john@lokomax.com', 'Sales', 'Block A · Meeting Room 3', 'WS-SAL-MR3-02', 'Daniel Okafor', now() - interval '9 hours', now() - interval '2 hours', NULL, NULL),
  ('RC-4174', 'Outlook keeps asking for password every hour', 'Prompted for credentials repeatedly since the password reset on Friday.', 'Access/Passwords', 'Medium', 'In Progress', 'Emily Cross', 'emily.cross@lokomax.com', 'HR', 'Block C · Room 110', 'WS-HR-110-01', 'Joy Ezechukwu', now() - interval '20 hours', now() - interval '6 hours', NULL, NULL),
  ('RC-4175', 'Finance floor printer jams on every duplex job', 'Paper jams at tray 2 whenever double-sided printing is selected.', 'Printing', 'Medium', 'Pending', 'James Liu', 'james.liu@lokomax.com', 'Finance', 'Block B · Print Bay', 'WS-FIN-PRN-01', 'Emily Carter', now() - interval '34 hours', now() - interval '8 hours', NULL, NULL),
  ('RC-4176', 'Second monitor not detected on new dock', 'HDMI monitor stays black after the dock swap. Displays show only one screen.', 'Peripherals', 'Low', 'New', 'Nkem Adeyemi', 'nkem.adeyemi@lokomax.com', 'Marketing', 'Block A · Room 305', 'WS-MKT-305-04', NULL, now() - interval '3 hours', now() - interval '3 hours', NULL, NULL),
  ('RC-4177', 'ERP client crashes when exporting to Excel', 'The export dialog closes the whole application. Reproducible on every report.', 'Software', 'High', 'New', 'Aisha Bello', 'aisha.bello@lokomax.com', 'Finance', 'Block B · Room 214', 'WS-FIN-214-07', NULL, now() - interval '11 hours', now() - interval '11 hours', NULL, NULL),
  ('RC-4168', 'VPN disconnects every few minutes from home', 'Tunnel drops roughly every five minutes on the corporate VPN profile.', 'Network/Wi-Fi', 'High', 'Resolved', 'Marta Silva', 'marta.silva@lokomax.com', 'Legal', 'Remote', 'WS-LEG-RMT-09', 'Daniel Okafor', now() - interval '52 hours', now() - interval '44 hours', now() - interval '44 hours', 'Replaced the expired device certificate and pinned the client to gateway cluster B. Tunnel stable for 6h under test.'),
  ('RC-4169', 'Keyboard keys sticking on reception workstation', 'Several keys need a hard press. Reception cannot type quickly during check-in.', 'Peripherals', 'Low', 'Resolved', 'Grace Mensah', 'grace.mensah@lokomax.com', 'Facilities', 'Ground · Reception', 'WS-FAC-REC-01', 'Emily Carter', now() - interval '70 hours', now() - interval '64 hours', now() - interval '64 hours', 'Swapped in a new USB keyboard from stock and logged the asset change.'),
  ('RC-4170', 'Shared mailbox access for new payroll analyst', 'Please grant the payroll shared mailbox access to the new analyst starting Monday.', 'Access/Passwords', 'Medium', 'Resolved', 'Stephen John', 'stephen.john@lokomax.com', 'Sales', 'Block A · Room 118', 'WS-SAL-118-03', 'Marko Doraslaw', now() - interval '96 hours', now() - interval '90 hours', now() - interval '90 hours', 'Added the account to the Payroll-Mailbox security group and verified send-as rights.'),
  ('RC-4171', 'Projector in training room shows no signal', 'The HDMI cable is connected but the projector reports no input from any laptop.', 'Hardware', 'Medium', 'Resolved', 'Grace Mensah', 'grace.mensah@lokomax.com', 'Facilities', 'Block A · Training Room', 'WS-FAC-TRN-02', 'Joy Ezechukwu', now() - interval '30 hours', now() - interval '20 hours', now() - interval '20 hours', 'Reseated the HDMI extender and updated the projector firmware.');

INSERT INTO public.ticket_notes (ticket_id, author_name, visibility, body, created_at)
SELECT id, 'Daniel Okafor', 'internal', 'Access switch port 14 flapping. Swapping patch lead and monitoring for 30 min.', now() - interval '2 hours'
FROM public.tickets WHERE ref = 'RC-4173';
INSERT INTO public.ticket_notes (ticket_id, author_name, visibility, body, created_at)
SELECT id, 'Daniel Okafor', 'public', 'We found a faulty network cable in that room — replacing it now, will confirm shortly.', now() - interval '2 hours'
FROM public.tickets WHERE ref = 'RC-4173';
INSERT INTO public.ticket_notes (ticket_id, author_name, visibility, body, created_at)
SELECT id, 'Emily Carter', 'internal', 'Fuser roller worn. Replacement part ordered, ETA Thursday. Ticket parked on Pending (Parts).', now() - interval '8 hours'
FROM public.tickets WHERE ref = 'RC-4175';