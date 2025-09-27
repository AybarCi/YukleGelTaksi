const DatabaseConnection = require('./config/database');

async function fixDriver28Timestamp() {
  let db;
  
  try {
    console.log('🔍 Driver 28\'in timestamp\'ini düzeltiliyor...');
    
    db = DatabaseConnection.getInstance();
    const connection = await db.connect();
    
    // Önce mevcut durumu kontrol et
    const checkQuery = `
      SELECT 
        id,
        last_location_update,
        GETDATE() as [current_time],
        DATEDIFF(minute, last_location_update, GETDATE()) as minutes_diff
      FROM users 
      WHERE id = 28 AND user_type = 'driver'
    `;
    
    const checkResult = await connection.request().query(checkQuery);
    
    if (checkResult.recordset.length === 0) {
      console.log('❌ Driver 28 bulunamadı!');
      return;
    }
    
    const driver = checkResult.recordset[0];
    console.log('📊 Mevcut durum:');
    console.log(`   Driver ID: ${driver.id}`);
    console.log(`   Last Location Update: ${driver.last_location_update}`);
    console.log(`   Current Time: ${driver.current_time}`);
    console.log(`   Minutes Diff: ${driver.minutes_diff}`);
    
    // Timestamp'i şu anki zamana güncelle
    const updateQuery = `
      UPDATE users 
      SET last_location_update = GETDATE()
      WHERE id = 28 AND user_type = 'driver'
    `;
    
    await connection.request().query(updateQuery);
    console.log('✅ Driver 28\'in last_location_update zamanı güncellendi!');
    
    // Güncellenmiş durumu kontrol et
    const verifyResult = await connection.request().query(checkQuery);
    const updatedDriver = verifyResult.recordset[0];
    
    console.log('📊 Güncellenmiş durum:');
    console.log(`   Last Location Update: ${updatedDriver.last_location_update}`);
    console.log(`   Current Time: ${updatedDriver.current_time}`);
    console.log(`   Minutes Diff: ${updatedDriver.minutes_diff}`);
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    if (db) {
      await db.disconnect();
    }
  }
}

fixDriver28Timestamp();