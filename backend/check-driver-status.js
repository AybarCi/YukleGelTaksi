const DatabaseConnection = require('./config/database');

async function checkDriverStatus() {
  try {
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();
    
    console.log('🔍 Checking all drivers status...');
    
    const result = await pool.request().query(`
      SELECT 
        d.id,
        d.user_id,
        d.is_active,
        d.is_available,
        d.is_approved,
        u.current_latitude,
        u.current_longitude,
        u.last_location_update,
        ABS(DATEDIFF(minute, u.last_location_update, GETDATE())) as minutes_since_update,
        d.vehicle_type_id,
        d.vehicle_plate
      FROM drivers d
      LEFT JOIN users u ON d.user_id = u.id
      ORDER BY d.id
    `);
    
    console.log('📊 Driver Status Report:');
    console.log('========================');
    
    result.recordset.forEach(driver => {
      console.log(`Driver ID: ${driver.id} (User ID: ${driver.user_id})`);
      console.log(`  Active: ${driver.is_active}`);
      console.log(`  Available: ${driver.is_available}`);
      console.log(`  Approved: ${driver.is_approved}`);
      console.log(`  Location: ${driver.current_latitude ? driver.current_latitude + ', ' + driver.current_longitude : 'No location'}`);
      console.log(`  Last Update: ${driver.last_location_update || 'Never'}`);
      console.log(`  Minutes Since Update: ${driver.minutes_since_update || 'N/A'}`);
      console.log(`  Vehicle Plate: ${driver.vehicle_plate || 'N/A'}`);
      console.log('  ---');
    });
    
    await db.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkDriverStatus();