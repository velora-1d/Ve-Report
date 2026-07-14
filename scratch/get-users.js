import fs from 'fs';
import pg from 'pg';

const { Client } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/ve_report';

async function getUsers() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // Fetch profiles
    const profilesRes = await client.query('SELECT * FROM public.profiles');
    console.log('--- PROFILES ---');
    console.table(profilesRes.rows);
    
    // Fetch user roles
    const rolesRes = await client.query('SELECT * FROM public.user_roles');
    console.log('--- USER ROLES ---');
    console.table(rolesRes.rows);
    
  } catch (err) {
    console.error('Error fetching users:', err);
  } finally {
    await client.end();
  }
}

getUsers();
