-- Run this script in your Supabase SQL Editor to fix the silent UPDATE blocking bug

-- 1. Ensure RLS is enabled on the products table (it already is, but just in case)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 2. Create the missing UPDATE policy for the products table.
-- This allows any user of the app to modify existing products (like changing their category or price).
CREATE POLICY "Permitir actualizar productos a todos" 
ON public.products 
FOR UPDATE 
USING (true);

-- Optional: Do the same for events just in case it is missing there too
CREATE POLICY "Permitir actualizar eventos a todos" 
ON public.events 
FOR UPDATE 
USING (true);
