-- EJECUTA ESTO EN TU SQL EDITOR DE SUPABASE PARA ARREGLAR TODOS LOS "CANDADOS"

-- 1. Borrar políticas contradictorias si existen (opcional pero recomendado)
-- DROP POLICY IF EXISTS "Permitir actualizar productos a todos" ON public.products;

-- 2. Asegurar permiso de ACTUALIZACIÓN (UPDATE)
CREATE POLICY "Permiso de UPDATE para productos" 
ON public.products 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- 3. Asegurar permiso de INSERCIÓN (INSERT) 
-- (Obligatorio para que el comando UPSERT pueda funcionar correctamente)
CREATE POLICY "Permiso de INSERT para productos" 
ON public.products 
FOR INSERT 
WITH CHECK (true);

-- 4. Asegurar permiso de BORRADO (DELETE)
CREATE POLICY "Permiso de DELETE para productos" 
ON public.products 
FOR DELETE 
USING (true);

-- 5. Asegurar permiso de LECTURA (SELECT)
CREATE POLICY "Permiso de SELECT para productos" 
ON public.products 
FOR SELECT 
USING (true);
