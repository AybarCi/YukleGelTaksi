const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function addApprovalColumn() {
  // Veritabanı dosyasının yolu
  const dbPath = path.join(__dirname, 'database', 'yuklegeltaksi.db');

  try {
    // Veritabanına bağlan
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
  
  console.log('Veritabanına bağlanıldı:', dbPath);
  
    // Mevcut tablo yapısını kontrol et
    const tableInfo = await db.all("PRAGMA table_info(drivers)");
    console.log('Mevcut drivers tablosu sütunları:');
    tableInfo.forEach(col => {
      console.log(`- ${col.name}: ${col.type}`);
    });
    
    // is_approved sütununun var olup olmadığını kontrol et
    const hasApprovalColumn = tableInfo.some(col => col.name === 'is_approved');
    
    if (!hasApprovalColumn) {
      console.log('\nis_approved sütunu bulunamadı, ekleniyor...');
      
      // is_approved sütununu ekle
      await db.exec(`
        ALTER TABLE drivers 
        ADD COLUMN is_approved INTEGER DEFAULT 0;
      `);
      
      console.log('✅ is_approved sütunu başarıyla eklendi');
      
      // Mevcut sürücüleri güncelle - backoffice'ten eklenenler otomatik onaylı
      // user_id NULL olanlar backoffice'ten eklenmiş kabul edilir
      const updateResult = await db.run(`
        UPDATE drivers 
        SET is_approved = 1 
        WHERE user_id IS NULL
      `);
      
      console.log(`✅ ${updateResult.changes} backoffice sürücüsü otomatik onaylandı`);
      
    } else {
      console.log('✅ is_approved sütunu zaten mevcut');
    }
    
    // Güncellenmiş tablo yapısını göster
    const updatedTableInfo = await db.all("PRAGMA table_info(drivers)");
    console.log('\nGüncellenmiş drivers tablosu sütunları:');
    updatedTableInfo.forEach(col => {
      console.log(`- ${col.name}: ${col.type} ${col.dflt_value ? `(default: ${col.dflt_value})` : ''}`);
    });
    
    // Sürücü sayılarını göster
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_approved = 1 THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN is_approved = 0 THEN 1 ELSE 0 END) as pending
      FROM drivers
    `);
    
    console.log('\nSürücü İstatistikleri:');
    console.log(`- Toplam: ${stats.total}`);
    console.log(`- Onaylı: ${stats.approved}`);
    console.log(`- Beklemede: ${stats.pending}`);
    
    await db.close();
    console.log('\n✅ İşlem tamamlandı');
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  }
}

// Fonksiyonu çalıştır
addApprovalColumn();