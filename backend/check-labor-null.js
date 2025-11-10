// check-labor-null.js
const DatabaseConnection = require('./config/database');

(async () => {
  const db = DatabaseConnection.getInstance();
  const pool = await db.connect();
  const result = await pool.request().query(`
    SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'labor_count'
  `);
  console.table(result.recordset);
  await pool.close();
})().catch(console.error);