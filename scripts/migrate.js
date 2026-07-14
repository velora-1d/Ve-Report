import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/ve_report';
const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

async function runMigrations() {
  console.log('Connecting to PostgreSQL database...');
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected successfully. Initializing mock Supabase roles & schemas...');
    
    // Set up local PostgreSQL compatibility for Supabase
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role;
        END IF;
      END
      $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        raw_user_meta_data JSONB
      );
      
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      AS $$
        SELECT null::uuid;
      $$;

      CREATE OR REPLACE FUNCTION auth.role()
      RETURNS VARCHAR
      LANGUAGE sql
      STABLE
      AS $$
        SELECT 'authenticated'::varchar;
      $$;
      
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        run_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    
    // Read migrations directory
    if (!fs.existsSync(migrationsDir)) {
      console.error(`Migrations directory not found at: ${migrationsDir}`);
      process.exit(1);
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort lexicographically (by timestamp prefix)
      
    console.log(`Found ${files.length} migration file(s).`);
    
    for (const file of files) {
      // Check if migration has already been executed
      const checkRes = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
      
      if (checkRes.rowCount > 0) {
        console.log(`Migration ${file} is already applied. Skipping.`);
        continue;
      }
      
      console.log(`Applying migration: ${file}...`);
      const sqlPath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
      
      try {
        await client.query('BEGIN');
        
        // Execute SQL contents
        await client.query(sqlContent);
        
        // Record migration
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        
        await client.query('COMMIT');
        console.log(`Successfully applied migration: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Failed to apply migration: ${file}. Transaction rolled back.`);
        throw err;
      }
    }
    
    console.log('All migrations completed successfully.');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
