const postgres = require('postgres');

async function testConnection(name, url) {
    console.log(`Testing ${name}...`);
    const sql = postgres(url, { 
        ssl: 'require', 
        prepare: false,
        timeout: 5
    });
    try {
        const result = await sql`SELECT 1 as connected`;
        console.log(`[SUCCESS] ${name}:`, result);
        await sql.end();
        return true;
    } catch (err) {
        console.error(`[FAILURE] ${name}:`, err.message);
        await sql.end();
        return false;
    }
}

async function run() {
    const password = 'danzone1980!';
    const ref = 'axnbcicqpfcztvyibypk';
    
    const variations = [
        {
            name: 'DB NAME is Ref (aws-1)',
            url: `postgresql://postgres:${password}@aws-1-sa-east-1.pooler.supabase.com:5432/${ref}`
        },
        {
            name: 'DB NAME is Ref (aws-0)',
            url: `postgresql://postgres:${password}@aws-0-sa-east-1.pooler.supabase.com:5432/${ref}`
        },
        {
            name: 'Ref in DB name with params (aws-1)',
            url: `postgresql://postgres:${password}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?options=project%3D${ref}`
        }
    ];

    for (const v of variations) {
        await testConnection(v.name, v.url);
    }
}

run();
