-- Restrict public access to customer PII in chat_sessions
-- 1) Remove public SELECT policy that exposed customer names/emails
DROP POLICY IF EXISTS "Anyone can view chat sessions for public businesses" ON public.chat_sessions;

-- 2) Keep existing owner-only access in place (no change required):
--    "Business owners can view their chat sessions" (SELECT)
--    "Business owners can update their chat sessions" (UPDATE)
--    "Anyone can create chat sessions" (INSERT)

-- Note: No code changes required; customer chat creation and messaging remain unaffected.