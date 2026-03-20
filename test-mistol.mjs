import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMistol() {
    console.log('Finding Mistol...');
    const { data: mistols, error: fErr } = await supabase.from('products').select('*').ilike('name', '%Mistol%');
    
    if (mistols && mistols.length > 0) {
        const mistol = mistols[0];
        console.log('Found Mistol:', mistol.id, 'Current Category:', mistol.category);
        
        console.log('Attempting to update category to ARTICULOS DE LIMPIEZA...');
        const { error: uErr } = await supabase.from('products').update({
            category: 'ARTICULOS DE LIMPIEZA'
        }).eq('id', mistol.id);
        
        if (uErr) {
            console.error('Update FAILED still:', uErr);
        } else {
            console.log('Update command sent successfully.');
            const { data: verif } = await supabase.from('products').select('*').eq('id', mistol.id);
            console.log('Verification state:', verif[0].category);
        }
    } else {
        console.log('Mistol not found in database.');
    }
}
fixMistol();
