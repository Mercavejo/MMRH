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
            name: 'AWS-1 (User with ref)',
            url: `postgresql://postgres.${ref}:${password}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`
        },
        {
            name: 'AWS-0 (User with ref)',
            url: `postgresql://postgres.${ref}:${password}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`
        },
        {
            name: 'AWS-1 (Options Param)',
            url: `postgresql://postgres:${password}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?options=project%3D${ref}`
        },
        {
            name: 'AWS-0 (Options Param)',
            url: `postgresql://postgres:${password}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?options=project%3D${ref}`
        }
    ];

    for (const v of variations) {
        const ok = await testConnection(v.name, v.url);
        if (ok) {
            console.log("\n>>> FOUND WORKING CONFIGURATION <<<");
            console.log(v.url);
            process.exit(0);
        }
    }
    
    console.log("\n>>> ALL ATTEMPTS FAILED <<<");
    process.exit(1);
}

run();
