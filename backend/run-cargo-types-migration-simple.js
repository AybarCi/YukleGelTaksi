const DatabaseConnection = require('./config/database');

async function runCargoTypesMigration() {
  const db = DatabaseConnection.getInstance();
  
  try {
    console.log('Connecting to database...');
    await db.connect();
    
    console.log('Creating cargo_types table...');
    
    // Create table (SQL Server compatible)
    await db.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='cargo_types' AND xtype='U')
      BEGIN
        CREATE TABLE cargo_types (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(100) NOT NULL UNIQUE,
          description NVARCHAR(MAX),
          icon_url NVARCHAR(500),
          is_active BIT DEFAULT 1,
          sort_order INT DEFAULT 0,
          created_at DATETIME DEFAULT GETDATE(),
          updated_at DATETIME DEFAULT GETDATE()
        );
        
        -- Create indexes
        CREATE INDEX idx_cargo_types_active ON cargo_types(is_active);
        CREATE INDEX idx_cargo_types_sort_order ON cargo_types(sort_order);
        
        -- Insert default cargo types
        INSERT INTO cargo_types (name, description, sort_order) VALUES
          ('Mobilya', 'Mobilya ve ev eşyaları', 1),
          ('Beyaz Eşya', 'Beyaz eşya ve büyük ev aletleri', 2),
          ('Koli/Paket', 'Koli, paket ve küçük eşyalar', 3),
          ('Diğer', 'Diğer tüm yük türleri', 4);
          
        PRINT 'Cargo types table created successfully';
      END
      ELSE
      BEGIN
        PRINT 'Cargo types table already exists';
      END
    `);
    
    console.log('Creating update trigger...');
    
    // Create update trigger
    await db.query(`
      IF EXISTS (SELECT * FROM sysobjects WHERE name='update_cargo_types_updated_at' AND xtype='TR')
      BEGIN
        DROP TRIGGER update_cargo_types_updated_at;
      END
    `);
    
    await db.query(`
      CREATE TRIGGER update_cargo_types_updated_at
      ON cargo_types
      AFTER UPDATE
      AS
      BEGIN
        UPDATE cargo_types
        SET updated_at = GETDATE()
        FROM cargo_types ct
        INNER JOIN inserted i ON ct.id = i.id;
      END
    `);
    
    console.log('Cargo types migration completed successfully!');
    
    // Verify the table was created
    const result = await db.query('SELECT COUNT(*) as count FROM cargo_types');
    console.log(`Table contains ${result[0].count} cargo types`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await db.disconnect();
  }
}

// Run the migration
runCargoTypesMigration();