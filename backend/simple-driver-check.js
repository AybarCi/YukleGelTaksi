const sql = require('mssql');

const config = {
  server: 'localhost',
  user: 'sa',
  password: 'Ca090353--',
  database: 'yuklegeltaksidb',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function checkDrivers() {
  try {
    await sql.connect(config);
    console.log('Veritabanına bağlandı');
    
    const result = await sql.query`
      SELECT 
        u.phone_number,
        u.first_name,
        u.last_name,
        d.is_approved,
        d.is_active,
        d.created_at
      FROM drivers d 
      INNER JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
    `;
    
    console.log('\nSürücü Durumları:');
    console.log('================');
    
    if (result.recordset.length === 0) {
      console.log('Hiç sürücü kaydı bulunamadı.');
    } else {
      result.recordset.forEach((driver, index) => {
        console.log(`${index + 1}. ${driver.first_name || 'N/A'} ${driver.last_name || 'N/A'}`);
        console.log(`   Telefon: ${driver.phone_number}`);
        console.log(`   Onaylandı: ${driver.is_approved ? 'Evet' : 'Hayır'}`);
        console.log(`   Aktif: ${driver.is_active ? 'Evet' : 'Hayır'}`);
        console.log(`   Kayıt Tarihi: ${new Date(driver.created_at).toLocaleString('tr-TR')}`);
        console.log('   ---');
      });
    }
    
  } catch (error) {
    console.error('Hata:', error.message);
  } finally {
    await sql.close();
  }
}

checkDrivers();
