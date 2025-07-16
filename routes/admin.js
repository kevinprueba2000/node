const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getMany, getOne, insert, update, remove } = require('../config/database');
const { verifyToken, requireAdmin, requireSuperAdmin, sanitizeData, logActivity } = require('../middleware/auth');

const router = express.Router();

// ========================================
// CONFIGURACIÓN DE MULTER PARA ADMIN
// ========================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = 'uploads/';
        
        if (file.fieldname === 'product_image') {
            uploadPath += 'products/';
        } else if (file.fieldname === 'category_image') {
            uploadPath += 'categories/';
        } else {
            uploadPath += 'admin/';
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
// RUTAS DE AUTENTICACIÓN ADMIN
// ========================================

// Página de login
router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/login.html'));
});

// Página del dashboard
router.get('/dashboard', verifyToken, requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/dashboard.html'));
});

// ========================================
// RUTAS DE DASHBOARD
// ========================================

// Obtener estadísticas del dashboard
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
        
        // Productos con bajo stock
        const lowStockProducts = await getMany(`
            SELECT id, name, sku, stock_quantity
            FROM products 
            WHERE stock_quantity <= 10 AND manage_stock = 1 AND is_active = 1
            ORDER BY stock_quantity ASC
            LIMIT 5
        `);
        stats.low_stock_products = lowStockProducts;
        
        // Pedidos recientes
        const recentOrders = await getMany(`
            SELECT o.*, c.first_name, c.last_name, c.email
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            ORDER BY o.created_at DESC
            LIMIT 10
        `);
        stats.recent_orders = recentOrders;
        
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
// RUTAS DE PRODUCTOS (ADMIN)
// ========================================

// Obtener todos los productos para admin
router.get('/products', verifyToken, requireAdmin, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            category,
            search,
            status
        } = req.query;
        
        let query = `
            SELECT p.*, c.name as category_name, c.slug as category_slug,
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE 1=1
        `;
        
        const params = [];
        
        // Filtros
        if (category) {
            query += ' AND c.slug = ?';
            params.push(category);
        }
        
        if (search) {
            query += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        if (status === 'active') {
            query += ' AND p.is_active = 1';
        } else if (status === 'inactive') {
            query += ' AND p.is_active = 0';
        }
        
        query += ' ORDER BY p.created_at DESC';
        
        // Paginación
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const products = await getMany(query, params);
        
        // Contar total
        let countQuery = `
            SELECT COUNT(*) as total
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE 1=1
        `;
        
        const countParams = [];
        
        if (category) {
            countQuery += ' AND c.slug = ?';
            countParams.push(category);
        }
        
        if (search) {
            countQuery += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)';
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }
        
        if (status === 'active') {
            countQuery += ' AND p.is_active = 1';
        } else if (status === 'inactive') {
            countQuery += ' AND p.is_active = 0';
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

// Obtener producto por ID para admin
router.get('/products/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const product = await getOne(`
            SELECT p.*, c.name as category_name, c.slug as category_slug
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = ?
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

// Crear producto
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
        
        // Validaciones
        if (!name || !price) {
            return res.status(400).json({
                success: false,
                message: 'Nombre y precio son requeridos'
            });
        }
        
        // Crear slug único
        let slug = name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        
        // Verificar si el slug ya existe
        let counter = 1;
        let originalSlug = slug;
        while (await getOne('SELECT id FROM products WHERE slug = ?', [slug])) {
            slug = `${originalSlug}-${counter}`;
            counter++;
        }
        
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
                const isPrimary = i === 0;
                
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
        const existingProduct = await getOne('SELECT name FROM products WHERE id = ?', [id]);
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
            product_name: existingProduct.name,
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
// RUTAS DE CATEGORÍAS (ADMIN)
// ========================================

// Obtener todas las categorías para admin
router.get('/categories', verifyToken, requireAdmin, async (req, res) => {
    try {
        const categories = await getMany(`
            SELECT c.*, COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
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
        let slug = name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        
        // Verificar si el slug ya existe
        let counter = 1;
        let originalSlug = slug;
        while (await getOne('SELECT id FROM categories WHERE slug = ?', [slug])) {
            slug = `${originalSlug}-${counter}`;
            counter++;
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

// Actualizar categoría
router.put('/categories/:id', verifyToken, requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        // Verificar que la categoría existe
        const existingCategory = await getOne('SELECT name FROM categories WHERE id = ?', [id]);
        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }
        
        // Actualizar categoría
        const updateFields = [];
        const updateValues = [];
        
        Object.keys(updateData).forEach(key => {
            if (key !== 'id' && key !== 'image') {
                updateFields.push(`${key} = ?`);
                updateValues.push(updateData[key]);
            }
        });
        
        // Procesar imagen si se subió una nueva
        if (req.file) {
            updateFields.push('image = ?');
            updateValues.push(req.file.filename);
            
            // Eliminar imagen anterior si existe
            const oldCategory = await getOne('SELECT image FROM categories WHERE id = ?', [id]);
            if (oldCategory.image) {
                const oldImagePath = path.join('uploads', 'categories', oldCategory.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
        }
        
        if (updateFields.length > 0) {
            updateValues.push(id);
            await update(`UPDATE categories SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
        }
        
        // Log de actividad
        await logActivity(req.user.id, 'category_updated', {
            category_id: id,
            category_name: existingCategory.name,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Categoría actualizada exitosamente'
        });
        
    } catch (error) {
        console.error('Error actualizando categoría:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando categoría'
        });
    }
});

// Eliminar categoría
router.delete('/categories/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar que la categoría existe
        const category = await getOne('SELECT name, image FROM categories WHERE id = ?', [id]);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }
        
        // Verificar si hay productos en esta categoría
        const productsInCategory = await getOne('SELECT COUNT(*) as count FROM products WHERE category_id = ?', [id]);
        if (productsInCategory.count > 0) {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar una categoría que tiene productos'
            });
        }
        
        // Eliminar imagen si existe
        if (category.image) {
            const imagePath = path.join('uploads', 'categories', category.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        // Eliminar categoría
        await remove('DELETE FROM categories WHERE id = ?', [id]);
        
        // Log de actividad
        await logActivity(req.user.id, 'category_deleted', {
            category_id: id,
            category_name: category.name,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Categoría eliminada exitosamente'
        });
        
    } catch (error) {
        console.error('Error eliminando categoría:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando categoría'
        });
    }
});

// ========================================
// RUTAS DE PEDIDOS (ADMIN)
// ========================================

// Obtener todos los pedidos
router.get('/orders', verifyToken, requireAdmin, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            search
        } = req.query;
        
        let query = `
            SELECT o.*, c.first_name, c.last_name, c.email
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (status) {
            query += ' AND o.status = ?';
            params.push(status);
        }
        
        if (search) {
            query += ' AND (o.order_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        
        query += ' ORDER BY o.created_at DESC';
        
        // Paginación
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const orders = await getMany(query, params);
        
        // Contar total
        let countQuery = `
            SELECT COUNT(*) as total
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE 1=1
        `;
        
        const countParams = [];
        
        if (status) {
            countQuery += ' AND o.status = ?';
            countParams.push(status);
        }
        
        if (search) {
            countQuery += ' AND (o.order_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ?)';
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        
        const totalResult = await getOne(countQuery, countParams);
        const total = totalResult.total;
        
        res.json({
            success: true,
            data: orders,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo pedidos:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo pedidos'
        });
    }
});

// Obtener pedido por ID
router.get('/orders/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const order = await getOne(`
            SELECT o.*, c.first_name, c.last_name, c.email, c.phone
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE o.id = ?
        `, [id]);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Pedido no encontrado'
            });
        }
        
        // Obtener items del pedido
        const orderItems = await getMany(`
            SELECT oi.*, p.name as product_name, p.sku as product_sku
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `, [id]);
        
        order.items = orderItems;
        
        res.json({
            success: true,
            data: order
        });
        
    } catch (error) {
        console.error('Error obteniendo pedido:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo pedido'
        });
    }
});

// Actualizar estado del pedido
router.put('/orders/:id/status', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Estado inválido'
            });
        }
        
        // Verificar que el pedido existe
        const order = await getOne('SELECT order_number FROM orders WHERE id = ?', [id]);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Pedido no encontrado'
            });
        }
        
        // Actualizar estado
        await update('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
        
        // Log de actividad
        await logActivity(req.user.id, 'order_status_updated', {
            order_id: id,
            order_number: order.order_number,
            new_status: status,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Estado del pedido actualizado exitosamente'
        });
        
    } catch (error) {
        console.error('Error actualizando estado del pedido:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando estado del pedido'
        });
    }
});

// ========================================
// RUTAS DE CONFIGURACIÓN
// ========================================

// Obtener configuración del sitio
router.get('/settings', verifyToken, requireAdmin, async (req, res) => {
    try {
        const settings = await getMany('SELECT * FROM site_settings ORDER BY setting_key');
        
        res.json({
            success: true,
            data: settings
        });
        
    } catch (error) {
        console.error('Error obteniendo configuración:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo configuración'
        });
    }
});

// Actualizar configuración
router.put('/settings', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { settings } = req.body;
        
        if (!settings || !Array.isArray(settings)) {
            return res.status(400).json({
                success: false,
                message: 'Datos de configuración inválidos'
            });
        }
        
        // Actualizar cada configuración
        for (const setting of settings) {
            await update(
                'UPDATE site_settings SET setting_value = ? WHERE setting_key = ?',
                [setting.value, setting.key]
            );
        }
        
        // Log de actividad
        await logActivity(req.user.id, 'settings_updated', {
            settings_count: settings.length,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Configuración actualizada exitosamente'
        });
        
    } catch (error) {
        console.error('Error actualizando configuración:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando configuración'
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