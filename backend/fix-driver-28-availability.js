const DatabaseConnection = require('./config/database');

async function fixDriver28Availability() {
  const db = DatabaseConnection.getInstance();
  
  try {
    await db.connect();
    console.log('🔍 Checking driver 28 current status...');
    
    // Önce mevcut durumu kontrol et
    const currentStatus = await db.query(
      'SELECT id, user_id, is_active, is_available, is_approved FROM drivers WHERE id = @driverId',
      { driverId: 28 }
    );
    
    console.log('📊 Current driver 28 status:', currentStatus.recordset);
    
    if (!currentStatus.recordset || currentStatus.recordset.length === 0) {
      console.log('❌ Driver 28 not found in database');
      return;
    }
    
    console.log('📊 Driver 28 found:', currentStatus.recordset[0]);
    
    // is_available durumunu true yap
    const result = await db.query(
      'UPDATE drivers SET is_available = 1 WHERE id = @driverId',
      { driverId: 28 }
    );
    
    console.log('✅ Update result:', result);
    
    // Güncellenmiş durumu kontrol et
    const updatedStatus = await db.query(
      'SELECT id, user_id, is_active, is_available, is_approved FROM drivers WHERE id = @driverId',
      { driverId: 28 }
    );
    
    console.log('🔄 Updated driver 28 status:', updatedStatus.recordset[0]);
    
    console.log('✅ Driver 28 availability fixed successfully');
    await db.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error);
    await db.disconnect();
  }
}

fixDriver28Availability();