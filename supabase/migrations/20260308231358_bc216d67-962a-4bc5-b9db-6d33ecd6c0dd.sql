
-- Create earnings table
CREATE TABLE public.earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(appointment_id)
);

-- Enable RLS
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can view earnings" ON public.earnings FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert earnings" ON public.earnings FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update earnings" ON public.earnings FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete earnings" ON public.earnings FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
