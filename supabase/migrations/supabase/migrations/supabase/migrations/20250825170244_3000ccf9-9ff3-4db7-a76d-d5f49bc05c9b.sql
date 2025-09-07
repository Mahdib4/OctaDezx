-- Security hardening migration
-- 1) Remove public access to sensitive tables
DROP POLICY IF EXISTS "Anyone can view active businesses for customer chat" ON public.businesses;
DROP POLICY IF EXISTS "Anyone can view messages in active sessions" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can view chat sessions for public businesses" ON public.chat_sessions;

-- 2) Create a safe, public RPC to fetch minimal business info for customer chat
CREATE OR REPLACE FUNCTION public.get_public_business(business_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.name, b.description
  FROM public.businesses b
  WHERE b.id = business_id
    AND b.is_active = true;
$$;

-- Restrict default PUBLIC privileges and grant explicit execute rights
REVOKE ALL ON FUNCTION public.get_public_business(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_business(uuid) TO anon, authenticated;

-- 3) Add owner-only SELECT policy for chat messages
CREATE POLICY "Business owners can view their chat messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_sessions s
    JOIN public.businesses b ON b.id = s.business_id
    WHERE s.id = chat_messages.session_id
      AND b.owner_id = auth.uid()
  )
);

-- Notes:
-- - chat_sessions already has owner-only SELECT/UPDATE and open INSERT to allow customers to start sessions.
-- - chat_messages keeps open INSERT so customers can post, but reading is now restricted to owners.
-- - Customers fetch only business name/description via the RPC above without exposing sensitive fields.
