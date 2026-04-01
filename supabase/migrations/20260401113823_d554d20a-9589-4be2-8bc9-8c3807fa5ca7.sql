
CREATE POLICY "Authenticated users can view appointment times for availability"
ON public.appointments
FOR SELECT
TO authenticated
USING (true);
