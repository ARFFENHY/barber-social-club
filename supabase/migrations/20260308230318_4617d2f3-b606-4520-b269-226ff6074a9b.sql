
-- Allow authenticated users to insert notifications (for notifying admins)
CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow admins to delete notifications
CREATE POLICY "Admins can delete notifications"
ON public.notifications FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
