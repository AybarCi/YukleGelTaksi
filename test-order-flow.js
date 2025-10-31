const { Pool } = require('pg');

// PostgreSQL bağlantısı
const pool = new Pool({
  user: 'yuklegel_user',
  host: 'localhost',
  database: 'yuklegel_db',
  password: 'yuklegel_2024',
  port: 5432,
});

async function testOrderFlow() {
  try {
    console.log('📋 Sipariş akışı testi başlatılıyor...\n');
    
    // En son siparişleri getir
    const recentOrders = await pool.query(`
      SELECT id, status, customer_id, driver_id, created_at, updated_at 
      FROM orders 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('📝 Son 5 sipariş:');
    recentOrders.rows.forEach(order => {
      console.log(`   Sipariş #${order.id}: ${order.status} (Müşteri: ${order.customer_id}, Sürücü: ${order.driver_id || 'Yok'})`);
    });
    
    // Yeni durumları kontrol et
    const newStatuses = await pool.query(`
      SELECT id, status, customer_id, driver_id, created_at, updated_at 
      FROM orders 
      WHERE status IN ('customer_price_approved', 'customer_price_rejected', 'driver_navigating')
      ORDER BY updated_at DESC
    `);
    
    console.log('\n🔍 Yeni durumlarla siparişler:');
    if (newStatuses.rows.length === 0) {
      console.log('   Henüz yeni durumda sipariş bulunmuyor.');
    } else {
      newStatuses.rows.forEach(order => {
        console.log(`   Sipariş #${order.id}: ${order.status} (Müşteri: ${order.customer_id}, Sürücü: ${order.driver_id || 'Yok'})`);
      });
    }
    
    // Kabul edilmiş ama müşteri onayı bekleyen siparişler
    const acceptedOrders = await pool.query(`
      SELECT id, status, customer_id, driver_id, created_at, updated_at 
      FROM orders 
      WHERE status = 'accepted'
      ORDER BY updated_at DESC
    `);
    
    console.log('\n✅ Kabul edilmiş siparişler (müşteri onayı bekliyor):');
    if (acceptedOrders.rows.length === 0) {
      console.log('   Kabul edilmiş sipariş bulunmuyor.');
    } else {
      acceptedOrders.rows.forEach(order => {
        console.log(`   Sipariş #${order.id}: ${order.status} (Müşteri: ${order.customer_id}, Sürücü: ${order.driver_id || 'Yok'})`);
      });
    }
    
    // İnceleme durumundaki siparişler
    const inspectingOrders = await pool.query(`
      SELECT id, status, customer_id, driver_id, created_at, updated_at 
      FROM orders 
      WHERE status = 'inspecting'
      ORDER BY updated_at DESC
    `);
    
    console.log('\n🔍 İnceleniyor durumundaki siparişler:');
    if (inspectingOrders.rows.length === 0) {
      console.log('   İnceleniyor durumunda sipariş bulunmuyor.');
    } else {
      inspectingOrders.rows.forEach(order => {
        console.log(`   Sipariş #${order.id}: ${order.status} (Müşteri: ${order.customer_id}, Sürücü: ${order.driver_id || 'Yok'})`);
      });
    }
    
    console.log('\n📊 Durum istatistikleri:');
    const stats = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM orders 
      GROUP BY status 
      ORDER BY count DESC
    `);
    
    stats.rows.forEach(stat => {
      console.log(`   ${stat.status}: ${stat.count} sipariş`);
    });
    
    console.log('\n✅ Test tamamlandı!');
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

// Testi çalıştır
testOrderFlow();