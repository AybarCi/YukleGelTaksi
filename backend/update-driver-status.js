const DatabaseConnection = require('./config/database');

async function updateDriverStatus() {
  const db = DatabaseConnection.getInstance();
  
  try {
    await db.connect();
    console.log('🔍 Checking current driver status...');
    
    // Önce mevcut durumu kontrol et
    const currentStatus = await db.query(
      'SELECT id, user_id, is_active, is_available FROM drivers WHERE user_id = @userId',
      { userId: 32 }
    );
    
    console.log('📊 Current driver status:', currentStatus[0]);
    
    if (!currentStatus[0]) {
      console.log('❌ Driver with user_id 32 not found in database');
      return;
    }
    
    // is_active ve is_available durumunu 1 yap
    const result = await db.run(
      'UPDATE drivers SET is_active = 1, is_available = 1 WHERE user_id = @userId',
      { userId: 32 }
    );
    
    console.log('✅ Update result:', result);
    
    // Güncellenmiş durumu kontrol et
    const updatedStatus = await db.query(
      'SELECT id, user_id, is_active, is_available FROM drivers WHERE user_id = @userId',
      { userId: 32 }
    );
    
    console.log('🔄 Updated driver status:', updatedStatus[0]);
    
    console.log('✅ Driver status updated successfully');
    await db.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    await db.disconnect();
    process.exit(1);
  }
}

updateDriverStatus();