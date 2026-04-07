const { execSync } = require('child_process');

try {
  execSync('npx vercel env add VITE_SUPABASE_URL production,preview,development', { input: 'https://ikagbmbvsehdvbmspfwn.supabase.co', stdio: ['pipe', 'inherit', 'inherit'] });
  console.log('URL added');
} catch (e) { console.error('Error adding URL'); }

try {
  execSync('npx vercel env add VITE_SUPABASE_ANON_KEY production,preview,development', { input: 'sb_publishable_vAsF5VdMJ5xFYQ-CdetqIw_fldKtmxs', stdio: ['pipe', 'inherit', 'inherit'] });
  console.log('KEY added');
} catch (e) { console.error('Error adding KEY'); }
