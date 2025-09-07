-- Add a policy to allow anyone to view active businesses for customer chat
CREATE POLICY "Anyone can view active businesses for customer chat"
ON public.businesses
FOR SELECT
USING (is_active = true);