module.exports = {
    server: process.env.DB_SERVER || 'localhost',
    user: 'sa',
    // Lütfen Azure SQL Edge'i kurarken belirlediğiniz şifreyi buraya girin.
    password: 'Ca090353--',
    database: 'yuklegeltaksidb', // Veritabanı adını bu şekilde bırakabiliriz.
    options: {
        encrypt: false, // Yerel geliştirme için false
        trustServerCertificate: true // Yerel geliştirme için true
    }
};