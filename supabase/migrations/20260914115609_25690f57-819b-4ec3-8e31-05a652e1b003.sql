-- 1. Reply + soft-delete columns
ALTER TABLE public.booking_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.booking_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE public.business_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.business_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- 2. Update policies (booking_messages had none: read receipts + soft delete)
DROP POLICY IF EXISTS "Booking participants update" ON public.booking_messages;
CREATE POLICY "Booking participants update" ON public.booking_messages
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_messages.booking_id
      AND (auth.uid() = b.angler_id
        OR (b.business_id IS NOT NULL AND public.is_business_member(b.business_id, auth.uid(), 'staff'::business_member_role)))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_messages.booking_id
      AND (auth.uid() = b.angler_id
        OR (b.business_id IS NOT NULL AND public.is_business_member(b.business_id, auth.uid(), 'staff'::business_member_role)))
  ));

DROP POLICY IF EXISTS "Authors soft delete" ON public.business_messages;
CREATE POLICY "Authors soft delete" ON public.business_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- 3. Reactions on booking (trip) messages
CREATE TABLE IF NOT EXISTS public.booking_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.booking_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS booking_message_reactions_message_idx ON public.booking_message_reactions(message_id);

GRANT SELECT, INSERT, DELETE ON public.booking_message_reactions TO authenticated;
GRANT ALL ON public.booking_message_reactions TO service_role;
ALTER TABLE public.booking_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read reactions" ON public.booking_message_reactions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.booking_messages m
    JOIN public.bookings b ON b.id = m.booking_id
    WHERE m.id = booking_message_reactions.message_id
      AND (auth.uid() = b.angler_id
        OR (b.business_id IS NOT NULL AND public.is_business_member(b.business_id, auth.uid(), 'staff'::business_member_role)))
  ));

CREATE POLICY "Participants add reactions" ON public.booking_message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.booking_messages m
    JOIN public.bookings b ON b.id = m.booking_id
    WHERE m.id = booking_message_reactions.message_id
      AND (auth.uid() = b.angler_id
        OR (b.business_id IS NOT NULL AND public.is_business_member(b.business_id, auth.uid(), 'staff'::business_member_role)))
  ));

CREATE POLICY "Owners remove reactions" ON public.booking_message_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Reactions on direct business messages
CREATE TABLE IF NOT EXISTS public.business_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.business_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS business_message_reactions_message_idx ON public.business_message_reactions(message_id);

GRANT SELECT, INSERT, DELETE ON public.business_message_reactions TO authenticated;
GRANT ALL ON public.business_message_reactions TO service_role;
ALTER TABLE public.business_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read reactions" ON public.business_message_reactions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.business_messages m
    JOIN public.business_conversations c ON c.id = m.conversation_id
    WHERE m.id = business_message_reactions.message_id
      AND (auth.uid() = c.angler_id
        OR public.is_business_member(c.business_id, auth.uid(), 'staff'::business_member_role))
  ));

CREATE POLICY "Participants add reactions" ON public.business_message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.business_messages m
    JOIN public.business_conversations c ON c.id = m.conversation_id
    WHERE m.id = business_message_reactions.message_id
      AND (auth.uid() = c.angler_id
        OR public.is_business_member(c.business_id, auth.uid(), 'staff'::business_member_role))
  ));

CREATE POLICY "Owners remove reactions" ON public.business_message_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.business_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.business_message_reactions;
