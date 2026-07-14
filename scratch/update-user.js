import pg from 'pg';
const { Client } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/ve_report';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query("UPDATE \"user\" SET role = 'developer' WHERE email = 'nawawimahinutsman@gmail.com'");
    console.log("UPDATE RESULT:", res.rowCount, "rows updated");
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
