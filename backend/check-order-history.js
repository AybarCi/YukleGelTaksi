const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: 1433,
  database: 'yuklegeltaksidb',
  user: 'sa',
  password: 'Ca090353--',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function checkOrderHistory() {
  try {
    console.log('📋 Order Status History Kontrolü\n');
    await sql.connect(config);
    
    // Tablo yapısını kontrol et
    const tableCheck = await sql.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'order_status_history' 
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('📊 Order Status History Tablosu Yapısı:');
    tableCheck.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Son history kayıtlarını getir
    const recentHistory = await sql.query(`
      SELECT TOP 10 
        osh.id,
        osh.order_id,
        osh.old_status,
        osh.new_status,
        osh.changed_by_user_id,
        osh.changed_by_driver_id,
        osh.notes,
        osh.created_at,
        o.order_status as current_order_status
      FROM order_status_history osh
      LEFT JOIN orders o ON osh.order_id = o.id
      ORDER BY osh.created_at DESC
    `);
    
    console.log('\n🔄 Son 10 Order Status History Kaydı:');
    if (recentHistory.recordset.length === 0) {
      console.log('Henüz hiç history kaydı yok.');
    } else {
      recentHistory.recordset.forEach(record => {
        console.log(`Order #${record.order_id}: "${record.old_status}" -> "${record.new_status}" (Driver: ${record.changed_by_driver_id || 'NULL'}, User: ${record.changed_by_user_id || 'NULL'}) at ${record.created_at}`);
        console.log(`  Current status: ${record.current_order_status}`);
      });
    }
    
    // Özellikle customer_price_rejected durumlarını kontrol et
    const rejectedHistory = await sql.query(`
      SELECT 
        osh.order_id,
        osh.old_status,
        osh.new_status,
        osh.changed_by_driver_id,
        osh.created_at,
        o.order_status as current_order_status
      FROM order_status_history osh
      LEFT JOIN orders o ON osh.order_id = o.id
      WHERE osh.new_status IN ('customer_price_rejected', 'cancelled')
      ORDER BY osh.created_at DESC
    `);
    
    console.log('\n❌ Müşteri Reddi ve İptal Durumları:');
    if (rejectedHistory.recordset.length === 0) {
      console.log('Müşteri reddi veya iptal durumu bulunamadı.');
    } else {
      rejectedHistory.recordset.forEach(record => {
        console.log(`Order #${record.order_id}: "${record.old_status}" -> "${record.new_status}" (Driver: ${record.changed_by_driver_id || 'NULL'}) at ${record.created_at}`);
        console.log(`  Current status: ${record.current_order_status}`);
      });
    }
    
    await sql.close();
    console.log('\n✅ Kontrol tamamlandı!');
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  }
}

checkOrderHistory();