const DatabaseConnection = require('./config/database');

async function updateImageUrls() {
  const db = DatabaseConnection.getInstance();
  const pool = await db.connect();

  try {
    // vehicle_types tablosunu güncelle
    console.log('vehicle_types tablosu güncelleniyor...');
    const vehicleResult = await pool.request()
      .query(`
        UPDATE vehicle_types 
        SET image_url = REPLACE(image_url, '/uploads/', '/api/files/')
        WHERE image_url LIKE '/uploads/%'
      `);
    console.log(`Vehicle types güncellendi: ${vehicleResult.rowsAffected} satır`);

    // cargo_types tablosunu güncelle
    console.log('cargo_types tablosu güncelleniyor...');
    const cargoResult = await pool.request()
      .query(`
        UPDATE cargo_types 
        SET image_url = REPLACE(image_url, '/uploads/', '/api/files/')
        WHERE image_url LIKE '/uploads/%'
      `);
    console.log(`Cargo types güncellendi: ${cargoResult.rowsAffected} satır`);

    // Güncellenmiş verileri kontrol et
    console.log('\nGüncellenmiş veriler:');
    
    const vehicleTypes = await pool.request()
      .query('SELECT id, name, image_url FROM vehicle_types WHERE image_url IS NOT NULL');
    
    console.log('Vehicle Types:');
    vehicleTypes.recordset.forEach(vt => {
      console.log(`- ${vt.name}: ${vt.image_url}`);
    });

    const cargoTypes = await pool.request()
      .query('SELECT id, name, image_url FROM cargo_types WHERE image_url IS NOT NULL');
    
    console.log('\nCargo Types:');
    cargoTypes.recordset.forEach(ct => {
      console.log(`- ${ct.name}: ${ct.image_url}`);
    });

  } catch (error) {
    console.error('Hata oluştu:', error);
  } finally {
    await pool.close();
  }
}

updateImageUrls();