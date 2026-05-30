-- Add client management fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS permanent_notes text,
  ADD COLUMN IF NOT EXISTS visit_frequency_days integer;

-- Allow admins to update profiles (for editing client info)
CREATE POLICY "Admins can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to create appointments for any client (manual booking)
CREATE POLICY "Admins can insert appointments"
  ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));