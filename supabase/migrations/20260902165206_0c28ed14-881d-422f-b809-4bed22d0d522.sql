CREATE POLICY "Staff can view adjustment evidence"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'adjustment-evidence');

CREATE POLICY "Admins can upload adjustment evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'adjustment-evidence' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins can update adjustment evidence"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'adjustment-evidence' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins can delete adjustment evidence"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'adjustment-evidence' AND public.has_role(auth.uid(),'admin'));