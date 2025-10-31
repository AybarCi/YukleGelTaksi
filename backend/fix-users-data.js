const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  user: 'sa',
  password: 'Ca090353--',
  database: 'yuklegeltaksidb',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function fixUsersData() {
  try {
    const pool = await sql.connect(config);
    
    console.log('Users tablosundaki hatalı kayıtlar kontrol ediliyor...');
    
    // Önce mevcut hatalı kayıtları listele
    const problematicUsers = await pool.request().query(`
      SELECT id, phone_number, first_name, last_name, email
      FROM users 
      WHERE first_name = 'Kullanıcı' 
         OR last_name LIKE '+90%' 
         OR last_name LIKE '05%'
         OR (first_name = '' AND last_name != '')
      ORDER BY id
    `);
    
    console.log(`Toplam ${problematicUsers.recordset.length} hatalı kayıt bulundu:`);
    console.table(problematicUsers.recordset);
    
    if (problematicUsers.recordset.length > 0) {
      console.log('\nHatalı kayıtlar düzeltiliyor...');
      
      // first_name alanında 'Kullanıcı' yazan kayıtları düzelt
      const fixFirstName = await pool.request().query(`
        UPDATE users 
        SET first_name = '', updated_at = GETDATE()
        WHERE first_name = 'Kullanıcı'
      `);
      
      console.log(`${fixFirstName.rowsAffected[0]} kayıtta first_name düzeltildi.`);
      
      // last_name alanında telefon numarası olan kayıtları düzelt
      const fixLastName = await pool.request().query(`
        UPDATE users 
        SET last_name = '', updated_at = GETDATE()
        WHERE last_name LIKE '+90%' OR last_name LIKE '05%'
      `);
      
      console.log(`${fixLastName.rowsAffected[0]} kayıtta last_name düzeltildi.`);
      
      // Düzeltme sonrası durumu kontrol et
      const afterFix = await pool.request().query(`
        SELECT COUNT(*) as total_users,
               SUM(CASE WHEN first_name = '' THEN 1 ELSE 0 END) as empty_first_name,
               SUM(CASE WHEN last_name = '' THEN 1 ELSE 0 END) as empty_last_name,
               SUM(CASE WHEN first_name = 'Kullanıcı' THEN 1 ELSE 0 END) as kullanici_first_name,
               SUM(CASE WHEN last_name LIKE '+90%' OR last_name LIKE '05%' THEN 1 ELSE 0 END) as phone_in_lastname
        FROM users
      `);
      
      console.log('\nDüzeltme sonrası durum:');
      console.table(afterFix.recordset);
      
      console.log('\n✅ Users tablosu başarıyla temizlendi!');
    } else {
      console.log('✅ Hiç hatalı kayıt bulunamadı.');
    }
    
    await pool.close();
  } catch (error) {
    console.error('❌ Hata:', error);
  }
}

fixUsersData();