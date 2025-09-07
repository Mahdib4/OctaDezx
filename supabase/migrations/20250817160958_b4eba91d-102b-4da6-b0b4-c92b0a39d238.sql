-- Allow anyone to view chat sessions for the business they belong to
CREATE POLICY "Anyone can view chat sessions for public businesses"
ON public.chat_sessions
FOR SELECT
USING (business_id IN (SELECT id FROM public.businesses WHERE is_active = true));