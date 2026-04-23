/**
 * Supabase setup — prints the schema SQL to run once in the Supabase SQL editor,
 * then verifies the connection is working.
 */
import 'dotenv/config';
import supabase from './client.js';

const SCHEMA_SQL = `
-- Run this once in your Supabase project's SQL editor:
-- https://supabase.com/dashboard/project/_/sql

CREATE TABLE IF NOT EXISTS crowd_reports (
  id          SERIAL PRIMARY KEY,
  route_id    VARCHAR(50) NOT NULL,
  status      VARCHAR(10) NOT NULL CHECK (status IN ('empty', 'moderate', 'packed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crowd_reports_route_created
  ON crowd_reports (route_id, created_at DESC);

CREATE TABLE IF NOT EXISTS typical_crowds (
  route_id     VARCHAR(50)  NOT NULL,
  day_of_week  SMALLINT     NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour_of_day  SMALLINT     NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  status       VARCHAR(10)  NOT NULL CHECK (status IN ('empty', 'moderate', 'packed')),
  PRIMARY KEY (route_id, day_of_week, hour_of_day)
);
`;

console.log('\n📋 Copy and run this SQL in your Supabase SQL editor:');
console.log('   https://supabase.com/dashboard/project/_/sql\n');
console.log(SCHEMA_SQL);

console.log('Verifying connection...');
const { error } = await supabase.from('crowd_reports').select('id').limit(1);

const tablesMissing =
  error?.message?.includes("Could not find the table") ||
  error?.message?.includes("does not exist");

if (error && !tablesMissing) {
  console.error('❌ Connection failed:', error.message);
  process.exit(1);
} else if (tablesMissing) {
  console.log('⚠️  Tables not created yet.');
  console.log('   → Paste the SQL above into the Supabase SQL editor and click Run.');
  console.log('   → Then run: npm run db:seed');
} else {
  console.log('✅ Connected to Supabase successfully.');
  console.log('   Run npm run db:seed to load historical crowd data.');
}
