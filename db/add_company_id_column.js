/**
 * Migration: Add company_id column to media table
 * Run this on the VPS to fix the 500 error on media upload
 */
const mysql = require('mysql2/promise');

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'widowmaker',
        database: process.env.DB_DATABASE || 'cloud_master'
    });

    console.log('🔧 Adding company_id column to media table...');

    try {
        // Check if column exists
        const [cols] = await connection.execute(`
            SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'media'
            AND COLUMN_NAME = 'company_id'
        `);

        if (cols[0].cnt > 0) {
            console.log('ℹ️  company_id column already exists');
        } else {
            await connection.execute(`
                ALTER TABLE media
                ADD COLUMN company_id BIGINT NULL AFTER tenant_id
            `);
            console.log('✅ Added company_id column');
        }

        // Backfill: set company_id = 1 for existing records where NULL
        const [result] = await connection.execute(`
            UPDATE media SET company_id = 1 WHERE company_id IS NULL
        `);
        console.log(`✅ Backfilled ${result.affectedRows} existing records with company_id=1`);

        // Add index
        try {
            await connection.execute(`
                CREATE INDEX idx_media_tenant_company ON media(tenant_id, company_id)
            `);
            console.log('✅ Added index');
        } catch (e) {
            if (e.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  Index already exists');
            } else {
                throw e;
            }
        }

        // Verify
        const [rows] = await connection.execute('SELECT COUNT(*) as total FROM media');
        console.log(`📊 Total media records: ${rows[0].total}`);

        console.log('🎉 Migration complete!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    }

    await connection.end();
}

migrate();

