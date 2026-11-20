// Export de la base SurfAI (toutes les tables utiles), des comptes et des fichiers stockés.
// Usage : node exporter.js DOSSIER_DE_SORTIE
// Lit les accès dans backend/.env. Ne modifie rien dans la base.
const path = require('path');
const fs = require('fs');
const BACKEND = path.join(__dirname, '..', 'backend');
require(path.join(BACKEND, 'node_modules', 'dotenv')).config({ path: path.join(BACKEND, '.env') });
const { createClient } = require(path.join(BACKEND, 'node_modules', '@supabase/supabase-js'));

const OUT = process.argv[2];
if (!OUT) { console.error('Dossier de sortie manquant'); process.exit(2); }
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) { console.error('Accès Supabase absents de backend/.env'); process.exit(2); }
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });

// Caches de prévisions : recalculés tout seuls, inutiles à sauvegarder
const IGNORER = new Set(['forecast_cache', 'weather_cache', 'tide_cache']);
const PAGE = 1000;

async function tables() {
  const r = await fetch(URL_ + '/rest/v1/', { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
  if (!r.ok) throw new Error('Liste des tables : HTTP ' + r.status);
  return Object.keys((await r.json()).definitions || {}).filter(t => !IGNORER.has(t)).sort();
}
async function exporterTable(nom) {
  const lignes = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await sb.from(nom).select('*').range(debut, debut + PAGE - 1);
    if (error) throw new Error(nom + ' : ' + error.message);
    lignes.push(...data);
    if (data.length < PAGE) break;
  }
  fs.writeFileSync(path.join(OUT, 'base', nom + '.json'), JSON.stringify(lignes, null, 1));
  return lignes.length;
}
async function exporterComptes() {
  const comptes = [];
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error('Comptes : ' + error.message);
    comptes.push(...data.users.map(u => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, provider: u.app_metadata && u.app_metadata.provider })));
    if (data.users.length < 200) break;
  }
  fs.writeFileSync(path.join(OUT, 'base', '_comptes.json'), JSON.stringify(comptes, null, 1));
  return comptes.length;
}
async function exporterBucket(bucket, prefixe = '') {
  let n = 0;
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await sb.storage.from(bucket).list(prefixe, { limit: 100, offset });
    if (error) throw new Error('Fichiers ' + bucket + '/' + prefixe + ' : ' + error.message);
    for (const f of data) {
      const chemin = prefixe ? prefixe + '/' + f.name : f.name;
      if (f.id === null) { n += await exporterBucket(bucket, chemin); continue; }   // dossier
      const { data: blob, error: e2 } = await sb.storage.from(bucket).download(chemin);
      if (e2) throw new Error('Téléchargement ' + chemin + ' : ' + e2.message);
      const cible = path.join(OUT, 'fichiers', bucket, chemin);
      fs.mkdirSync(path.dirname(cible), { recursive: true });
      fs.writeFileSync(cible, Buffer.from(await blob.arrayBuffer()));
      n++;
    }
    if (data.length < 100) break;
  }
  return n;
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'base'), { recursive: true });
  const manifeste = { date: new Date().toISOString(), tables: {}, comptes: 0, fichiers: {} };
  for (const t of await tables()) manifeste.tables[t] = await exporterTable(t);
  manifeste.comptes = await exporterComptes();
  const { data: buckets, error } = await sb.storage.listBuckets();
  if (error) throw new Error('Buckets : ' + error.message);
  for (const b of buckets) manifeste.fichiers[b.name] = await exporterBucket(b.name);
  fs.writeFileSync(path.join(OUT, 'MANIFESTE.json'), JSON.stringify(manifeste, null, 1));
  const total = Object.values(manifeste.tables).reduce((a, b) => a + b, 0);
  console.log('Export : ' + Object.keys(manifeste.tables).length + ' tables, ' + total + ' lignes, ' + manifeste.comptes + ' comptes, ' +
    Object.values(manifeste.fichiers).reduce((a, b) => a + b, 0) + ' fichiers');
  if (!manifeste.tables.spots || !manifeste.tables.sessions) throw new Error('Export anormal : spots ou sessions vides');
})().catch(e => { console.error('ÉCHEC export : ' + e.message); process.exit(1); });
