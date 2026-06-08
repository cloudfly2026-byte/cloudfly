/**
 * Migration: Add company_id to media table
 *
 * This migration:
 * 1. Adds company_id column to media table if it doesn't exist
 * 2. Backfills company_id from the products' company via product_images relation
 * 3. For any remaining NULLs, sets a default based on tenant
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

    console.log('🔧 Starting migration: add company_id to media table');

    // Step 1: Add company_id column if it doesn't exist
    try {
        await connection.execute(`
            ALTER TABLE media
            ADD COLUMN company_id BIGINT NULL AFTER tenant_id
        `);
        console.log('✅ Added company_id column to media table');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('ℹ️  company_id column already exists, skipping');
        } else {
            throw e;
        }
    }

    // Step 2: Backfill company_id from product_images -> productos
    const [result1] = await connection.execute(`
        UPDATE media m
        INNER JOIN product_images pi ON m.id = pi.media_id
        INNER JOIN productos p ON pi.product_id = p.id
        SET m.company_id = p.company_id
        WHERE m.company_id IS NULL
    `);
    console.log(`✅ Backfilled company_id for ${result1.affectedRows} media records from product_images`);

    // Step 3: For any remaining NULLs, try to get company_id from companies table via tenant
    // (fallback: assign the first company of the tenant)
    const [result2] = await connection.execute(`
        UPDATE media m
        INNER JOIN companies c ON m.tenant_id = c.tenant_id
        SET m.company_id = c.id
        WHERE m.company_id IS NULL
        AND c.id = (
            SELECT MIN(c2.id) FROM companies c2 WHERE c2.tenant_id = m.tenant_id
        )
    `);
    console.log(`✅ Backfilled company_id for ${result2.affectedRows} remaining media records from companies`);

    // Step 4: Verify
    const [rows] = await connection.execute(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN company_id IS NULL THEN 1 ELSE 0 END) as null_company
        FROM media
    `);
    console.log(`📊 Media table: ${rows[0].total} total, ${rows[0].null_company} with null company_id`);

    // Step 5: Add index for performance
    try {
        await connection.execute(`
            CREATE INDEX idx_media_tenant_company ON media(tenant_id, company_id)
        `);
        console.log('✅ Added index idx_media_tenant_company');
    } catch (e) {
        if (e.code === 'ER_DUP_KEYNAME') {
            console.log('ℹ️  Index already exists, skipping');
        } else {
            console.warn('⚠️  Could not add index:', e.message);
        }
    }

    console.log('🎉 Migration complete!');
    await connection.end();
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});

