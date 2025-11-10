// fix-check-constraint.js
// CK_orders_order_status constraint'ini günceller

const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Ca090353--',
  database: process.env.DB_NAME || 'yuklegeltaksidb',
  port: parseInt(process.env.DB_PORT || '1433'),
  options: { encrypt: false, trustServerCertificate: true },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

(async () => {
  try {
    console.log('🔗 DB bağlanıyor...');
    await sql.connect(config);
    console.log('✅ Bağlantı OK');

    // 1) Mevcut constraint adını al
    const { recordset } = await sql.query(`
      SELECT name
      FROM sys.check_constraints
      WHERE OBJECT_NAME(parent_object_id) = 'orders'
        AND name LIKE '%order_status%';
    `);
    const oldName = recordset[0]?.name;

    if (oldName) {
      await sql.query(`ALTER TABLE orders DROP CONSTRAINT [${oldName}];`);
      console.log(`🗑️  Eski constraint kaldırıldı: ${oldName}`);
    } else {
      console.log('ℹ️  Mevcut CHECK constraint yok, atlanıyor.');
    }

    // 2) Yeni constraint ekle (tüm güncel durumlar)
    await sql.query(`
      ALTER TABLE orders
      ADD CONSTRAINT CK_orders_order_status
      CHECK (order_status IN (
        'pending',
        'accepted',
        'pickup_started',
        'cargo_picked',
        'delivery_started',
        'delivered',
        'completed',
        'cancelled',
        'customer_price_approved',
        'customer_price_rejected',
        'customer_confirmation_timeout',
        'driver_navigating',
        'inspecting',
        'driver_accepted_awaiting_customer',
        'driver_going_to_pickup'
      ));
    `);
    console.log('✅ Yeni CHECK constraint eklendi.');

    // 3) Onay
    const { recordset: chk } = await sql.query(`
      SELECT definition
      FROM sys.check_constraints
      WHERE name = 'CK_orders_order_status';
    `);
    console.log('📜 Yeni tanım:', chk[0]?.definition);
  } catch (err) {
    console.error('❌ Hata:', err.message);
  } finally {
    await sql.close();
    console.log('🔌 DB bağlantısı kapatıldı.');
  }
})();