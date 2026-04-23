/**
 * Seeds the routes table from the static route definitions.
 * Run once after creating the routes table, then manage routes
 * via POST /api/admin/routes or directly in Supabase.
 *
 * Usage: npm run routes:seed
 */
import 'dotenv/config';
import supabase from './client.js';
import { ROUTES } from '../routes/routes.js';

const rows = ROUTES.map(({ id, name, shortName, description, location, center, zoom, color }) => ({
  id,
  name,
  short_name: shortName,
  description,
  location,
  center_lng: center[0],
  center_lat: center[1],
  zoom,
  color,
  active: true,
}));

const { error } = await supabase
  .from('routes')
  .upsert(rows, { onConflict: 'id' });

if (error) {
  console.error('❌ routes:seed failed:', error.message);
  process.exit(1);
}

console.log(`✅ Seeded ${rows.length} routes into the database`);
rows.forEach((r) => console.log(`   ${r.id} — ${r.name}`));
