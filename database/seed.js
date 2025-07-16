const mysql = require('mysql2/promise');
const path = require('path');
const { hashPassword } = require('../middleware/auth');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

async function seed() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    const adminPass = await hashPassword('password');
    await connection.execute(
      `INSERT INTO admins (username, email, password, full_name, role)
       VALUES ('admin', 'admin@example.com', ?, 'Administrador', 'super_admin')
       ON DUPLICATE KEY UPDATE id=id`,
      [adminPass]
    );

    const categories = [
      ['Software', 'software', 'Productos de software'],
      ['Aceites Esenciales', 'aceites-esenciales', 'Aceites esenciales de calidad']
    ];
    for (const [name, slug, desc] of categories) {
      await connection.execute(
        `INSERT INTO categories (name, slug, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE id=id`,
        [name, slug, desc]
      );
    }

    const [rows1] = await connection.execute('SELECT id FROM categories WHERE slug = ?', ['software']);
    const [rows2] = await connection.execute('SELECT id FROM categories WHERE slug = ?', ['aceites-esenciales']);
    const catSoftware = rows1[0].id;
    const catAceites = rows2[0].id;

    await connection.execute(
      `INSERT INTO products (category_id, name, slug, price, short_description, description, stock_quantity, is_active)
       VALUES (?, 'Antivirus Pro', 'antivirus-pro', 29.99, 'Protección completa', 'Software antivirus profesional', 100, 1)
       ON DUPLICATE KEY UPDATE id=id`,
      [catSoftware]
    );

    await connection.execute(
      `INSERT INTO products (category_id, name, slug, price, short_description, description, stock_quantity, is_active)
       VALUES (?, 'Aceite de Lavanda', 'aceite-lavanda', 9.99, 'Aceite esencial relajante', 'Aceite esencial 100% puro de lavanda', 50, 1)
       ON DUPLICATE KEY UPDATE id=id`,
      [catAceites]
    );

    await connection.execute(
      `INSERT INTO site_settings (setting_key, setting_value, setting_type)
       VALUES ('site_name', 'AlquimiaTechnologic', 'string')
       ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`
    );

    await connection.end();
    console.log('Database seeded successfully');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
