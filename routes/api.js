const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getMany, getOne, insert, update, remove } = require('../config/database');
const { verifyToken, requireAdmin, sanitizeData, logActivity } = require('../middleware/auth');

const router = express.Router();

// ========================================
// CONFIGURACIÓN DE MULTER PARA UPLOADS
// ========================================

// Crear directorios si no existen
const uploadDirs = ['uploads', 'uploads/products', 'uploads/categories', 'uploads/temp'];
uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configuración de multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = 'uploads/';
        
        if (file.fieldname === 'product_image') {
            uploadPath += 'products/';
        } else if (file.fieldname === 'category_image') {
            uploadPath += 'categories/';
        } else {
            uploadPath += 'temp/';
        }
        
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: fileFilter
});

// ========================================
// RUTAS DE PRODUCTOS
// ========================================

// Obtener todos los productos
router.get('/products', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            category,
            search,
            min_price,
            max_price,
            sort = 'created_at',
            order = 'DESC',
            featured
        } = req.query;
        
        let query = `
            SELECT p.*, c.name as category_name, c.slug as category_slug,
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1
        `;
        
        const params = [];
        
        // Filtros
        if (category) {
            query += ' AND c.slug = ?';
            params.push(category);
        }
        
        if (search) {
            query += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.short_description LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        if (min_price) {
            query += ' AND p.price >= ?';
            params.push(parseFloat(min_price));
        }
        
        if (max_price) {
            query += ' AND p.price <= ?';
            params.push(parseFloat(max_price));
        }
        
        if (featured === 'true') {
            query += ' AND p.is_featured = 1';
        }
        
        // Ordenamiento
        const allowedSorts = ['name', 'price', 'created_at', 'sort_order'];
        const allowedOrders = ['ASC', 'DESC'];
        
        const sortField = allowedSorts.includes(sort) ? sort : 'created_at';
        const sortOrder = allowedOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
        
        query += ` ORDER BY p.${sortField} ${sortOrder}`;
        
        // Paginación
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const products = await getMany(query, params);
        
        // Contar total para paginación
        let countQuery = `
            SELECT COUNT(*) as total
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1
        `;
        
        const countParams = [];
        
        if (category) {
            countQuery += ' AND c.slug = ?';
            countParams.push(category);
        }
        
        if (search) {
            countQuery += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.short_description LIKE ?)';
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }
        
        if (min_price) {
            countQuery += ' AND p.price >= ?';
            countParams.push(parseFloat(min_price));
        }
        
        if (max_price) {
            countQuery += ' AND p.price <= ?';
            countParams.push(parseFloat(max_price));
        }
        
        if (featured === 'true') {
            countQuery += ' AND p.is_featured = 1';
        }
        
        const totalResult = await getOne(countQuery, countParams);
        const total = totalResult.total;
        
        res.json({
            success: true,
            data: products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo productos:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo productos'
        });
    }
});

// Obtener producto por ID
router.get('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const product = await getOne(`
            SELECT p.*, c.name as category_name, c.slug as category_slug
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = ? AND p.is_active = 1
        `, [id]);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }
        
        // Obtener imágenes del producto
        const images = await getMany(`
            SELECT * FROM product_images 
            WHERE product_id = ? 
            ORDER BY is_primary DESC, sort_order ASC
        `, [id]);
        
        product.images = images;
        
        res.json({
            success: true,
            data: product
        });
        
    } catch (error) {
        console.error('Error obteniendo producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo producto'
        });
    }
});

// Crear producto (requiere autenticación)
router.post('/products', verifyToken, requireAdmin, upload.array('images', 5), async (req, res) => {
    try {
        const {
            name,
            description,
            short_description,
            category_id,
            price,
            compare_price,
            sku,
            stock_quantity,
            manage_stock,
            weight,
            dimensions,
            is_featured,
            meta_title,
            meta_description
        } = req.body;
        
        // Validaciones básicas
        if (!name || !price) {
            return res.status(400).json({
                success: false,
                message: 'Nombre y precio son requeridos'
            });
        }
        
        // Crear slug único
        const slug = name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        
        // Insertar producto
        const productId = await insert(`
            INSERT INTO products (
                name, slug, description, short_description, category_id,
                price, compare_price, sku, stock_quantity, manage_stock,
                weight, dimensions, is_featured, meta_title, meta_description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name, slug, description, short_description, category_id,
            price, compare_price, sku, stock_quantity, manage_stock,
            weight, dimensions, is_featured, meta_title, meta_description
        ]);
        
        // Procesar imágenes
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const isPrimary = i === 0; // Primera imagen es principal
                
                await insert(`
                    INSERT INTO product_images (product_id, image_url, is_primary, sort_order)
                    VALUES (?, ?, ?, ?)
                `, [productId, file.filename, isPrimary, i]);
            }
        }
        
        // Log de actividad
        await logActivity(req.user.id, 'product_created', {
            product_id: productId,
            product_name: name,
            ip: req.ip
        });
        
        res.status(201).json({
            success: true,
            message: 'Producto creado exitosamente',
            data: { id: productId }
        });
        
    } catch (error) {
        console.error('Error creando producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando producto'
        });
    }
});

// Actualizar producto
router.put('/products/:id', verifyToken, requireAdmin, upload.array('images', 5), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        // Verificar que el producto existe
        const existingProduct = await getOne('SELECT id FROM products WHERE id = ?', [id]);
        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }
        
        // Actualizar producto
        const updateFields = [];
        const updateValues = [];
        
        Object.keys(updateData).forEach(key => {
            if (key !== 'id' && key !== 'images') {
                updateFields.push(`${key} = ?`);
                updateValues.push(updateData[key]);
            }
        });
        
        if (updateFields.length > 0) {
            updateValues.push(id);
            await update(`UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
        }
        
        // Procesar nuevas imágenes si las hay
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const isPrimary = i === 0;
                
                await insert(`
                    INSERT INTO product_images (product_id, image_url, is_primary, sort_order)
                    VALUES (?, ?, ?, ?)
                `, [id, file.filename, isPrimary, i]);
            }
        }
        
        // Log de actividad
        await logActivity(req.user.id, 'product_updated', {
            product_id: id,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Producto actualizado exitosamente'
        });
        
    } catch (error) {
        console.error('Error actualizando producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando producto'
        });
    }
});

// Eliminar producto
router.delete('/products/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar que el producto existe
        const product = await getOne('SELECT name FROM products WHERE id = ?', [id]);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }
        
        // Eliminar imágenes del producto
        const images = await getMany('SELECT image_url FROM product_images WHERE product_id = ?', [id]);
        images.forEach(img => {
            const imagePath = path.join('uploads', 'products', img.image_url);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        });
        
        // Eliminar registros de la base de datos
        await remove('DELETE FROM product_images WHERE product_id = ?', [id]);
        await remove('DELETE FROM products WHERE id = ?', [id]);
        
        // Log de actividad
        await logActivity(req.user.id, 'product_deleted', {
            product_id: id,
            product_name: product.name,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Producto eliminado exitosamente'
        });
        
    } catch (error) {
        console.error('Error eliminando producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando producto'
        });
    }
});

// ========================================
// RUTAS DE CATEGORÍAS
// ========================================

// Obtener todas las categorías
router.get('/categories', async (req, res) => {
    try {
        const categories = await getMany(`
            SELECT c.*, COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
            WHERE c.is_active = 1
            GROUP BY c.id
            ORDER BY c.sort_order ASC, c.name ASC
        `);
        
        res.json({
            success: true,
            data: categories
        });
        
    } catch (error) {
        console.error('Error obteniendo categorías:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo categorías'
        });
    }
});

// Obtener categoría por slug
router.get('/categories/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        const category = await getOne(`
            SELECT c.*, COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
            WHERE c.slug = ? AND c.is_active = 1
            GROUP BY c.id
        `, [slug]);
        
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }
        
        res.json({
            success: true,
            data: category
        });
        
    } catch (error) {
        console.error('Error obteniendo categoría:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo categoría'
        });
    }
});

// Crear categoría
router.post('/categories', verifyToken, requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const { name, description, sort_order } = req.body;
        
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Nombre de categoría es requerido'
            });
        }
        
        // Crear slug único
        const slug = name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        
        // Verificar si el slug ya existe
        const existingCategory = await getOne('SELECT id FROM categories WHERE slug = ?', [slug]);
        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe una categoría con ese nombre'
            });
        }
        
        const imageUrl = req.file ? req.file.filename : null;
        
        const categoryId = await insert(`
            INSERT INTO categories (name, slug, description, image, sort_order)
            VALUES (?, ?, ?, ?, ?)
        `, [name, slug, description, imageUrl, sort_order]);
        
        // Log de actividad
        await logActivity(req.user.id, 'category_created', {
            category_id: categoryId,
            category_name: name,
            ip: req.ip
        });
        
        res.status(201).json({
            success: true,
            message: 'Categoría creada exitosamente',
            data: { id: categoryId }
        });
        
    } catch (error) {
        console.error('Error creando categoría:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando categoría'
        });
    }
});

// ========================================
// RUTAS DE BÚSQUEDA
// ========================================

// Búsqueda avanzada
router.get('/search', async (req, res) => {
    try {
        const { q, category, min_price, max_price, limit = 20, offset = 0 } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'La búsqueda debe tener al menos 2 caracteres'
            });
        }
        
        let query = `
            SELECT p.*, c.name as category_name, c.slug as category_slug,
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1 AND (
                p.name LIKE ? OR 
                p.description LIKE ? OR 
                p.short_description LIKE ? OR
                c.name LIKE ?
            )
        `;
        
        const searchTerm = `%${q.trim()}%`;
        const params = [searchTerm, searchTerm, searchTerm, searchTerm];
        
        if (category) {
            query += ' AND c.slug = ?';
            params.push(category);
        }
        
        if (min_price) {
            query += ' AND p.price >= ?';
            params.push(parseFloat(min_price));
        }
        
        if (max_price) {
            query += ' AND p.price <= ?';
            params.push(parseFloat(max_price));
        }
        
        query += ' ORDER BY p.is_featured DESC, p.sort_order, p.created_at DESC';
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const products = await getMany(query, params);
        
        res.json({
            success: true,
            data: products,
            total: products.length,
            query: q
        });
        
    } catch (error) {
        console.error('Error en búsqueda:', error);
        res.status(500).json({
            success: false,
            message: 'Error en la búsqueda'
        });
    }
});

// ========================================
// RUTAS DE ESTADÍSTICAS
// ========================================

// Estadísticas del sitio
router.get('/stats', verifyToken, requireAdmin, async (req, res) => {
    try {
        const stats = {};
        
        // Total de productos
        const productsCount = await getOne('SELECT COUNT(*) as count FROM products WHERE is_active = 1');
        stats.products = productsCount.count;
        
        // Total de categorías
        const categoriesCount = await getOne('SELECT COUNT(*) as count FROM categories WHERE is_active = 1');
        stats.categories = categoriesCount.count;
        
        // Total de pedidos
        const ordersCount = await getOne('SELECT COUNT(*) as count FROM orders');
        stats.orders = ordersCount.count;
        
        // Total de clientes
        const customersCount = await getOne('SELECT COUNT(*) as count FROM customers');
        stats.customers = customersCount.count;
        
        // Ventas del mes
        const monthlySales = await getOne(`
            SELECT COALESCE(SUM(total_amount), 0) as total 
            FROM orders 
            WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())
            AND status NOT IN ('cancelled', 'refunded')
        `);
        stats.monthly_sales = monthlySales.total;
        
        // Productos más vendidos
        const topProducts = await getMany(`
            SELECT p.name, SUM(oi.quantity) as sold_quantity
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.status NOT IN ('cancelled', 'refunded')
            GROUP BY p.id, p.name
            ORDER BY sold_quantity DESC
            LIMIT 5
        `);
        stats.top_products = topProducts;
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas'
        });
    }
});

// ========================================
// RUTAS DE NEWSLETTER
// ========================================

// Suscribirse al newsletter
router.post('/newsletter', sanitizeData, async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !email.includes('@')) {
            return res.status(400).json({
                success: false,
                message: 'Email válido es requerido'
            });
        }
        
        // Verificar si ya existe
        const existing = await getOne('SELECT id FROM newsletter_subscribers WHERE email = ?', [email]);
        
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Este email ya está suscrito'
            });
        }
        
        // Insertar suscriptor
        await insert('INSERT INTO newsletter_subscribers (email) VALUES (?)', [email]);
        
        res.json({
            success: true,
            message: 'Suscripción exitosa'
        });
        
    } catch (error) {
        console.error('Error en suscripción:', error);
        res.status(500).json({
            success: false,
            message: 'Error en la suscripción'
        });
    }
});

// ========================================
// RUTAS DE CONFIGURACIÓN
// ========================================

// Obtener configuración del sitio
router.get('/config', async (req, res) => {
    try {
        const settings = await getMany('SELECT setting_key, setting_value, setting_type FROM site_settings');
        
        const config = {};
        settings.forEach(setting => {
            let value = setting.setting_value;
            
            if (setting.setting_type === 'number') {
                value = parseFloat(value);
            } else if (setting.setting_type === 'boolean') {
                value = value === 'true';
            } else if (setting.setting_type === 'json') {
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    value = value;
                }
            }
            
            config[setting.setting_key] = value;
        });
        
        res.json({
            success: true,
            data: config
        });
        
    } catch (error) {
        console.error('Error obteniendo configuración:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo configuración'
        });
    }
});

// ========================================
// MANEJO DE ERRORES DE MULTER
// ========================================

router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'El archivo es demasiado grande. Máximo 5MB.'
            });
        }
        
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Demasiados archivos. Máximo 5 imágenes.'
            });
        }
        
        return res.status(400).json({
            success: false,
            message: 'Error al subir archivo'
        });
    }
    
    if (error.message.includes('Solo se permiten imágenes')) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
    
    next(error);
});

module.exports = router; 