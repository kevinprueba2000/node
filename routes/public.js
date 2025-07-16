const express = require('express');
const path = require('path');
const { getMany, getOne } = require('../config/database');

const router = express.Router();

// ========================================
// RUTAS PRINCIPALES
// ========================================

// Página de inicio
router.get('/', async (req, res) => {
    try {
        // Obtener categorías para el menú
        const categories = await getMany(`
            SELECT c.*, COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
            WHERE c.is_active = 1
            GROUP BY c.id
            ORDER BY c.sort_order ASC
            LIMIT 6
        `);
        
        // Obtener productos destacados
        const featuredProducts = await getMany(`
            SELECT p.*, c.name as category_name, c.slug as category_slug,
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1 AND p.is_featured = 1
            ORDER BY p.sort_order ASC, p.created_at DESC
            LIMIT 8
        `);
        
        // Obtener configuración del sitio
        const siteConfig = await getMany('SELECT setting_key, setting_value FROM site_settings');
        const config = {};
        siteConfig.forEach(setting => {
            config[setting.setting_key] = setting.setting_value;
        });
        
        res.render('index', {
            categories,
            featuredProducts,
            config,
            title: config.site_name || 'AlquimiaTechnologic',
            description: config.site_description || 'Productos y servicios de alta calidad'
        });
        
    } catch (error) {
        console.error('Error cargando página de inicio:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// Página de productos
router.get('/productos', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 12,
            category,
            search,
            min_price,
            max_price,
            sort = 'created_at',
            order = 'DESC'
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
        
        const totalResult = await getOne(countQuery, countParams);
        const total = totalResult.total;
        
        // Obtener categorías para filtros
        const categories = await getMany(`
            SELECT c.*, COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
            WHERE c.is_active = 1
            GROUP BY c.id
            ORDER BY c.sort_order ASC
        `);
        
        // Obtener configuración
        const siteConfig = await getMany('SELECT setting_key, setting_value FROM site_settings');
        const config = {};
        siteConfig.forEach(setting => {
            config[setting.setting_key] = setting.setting_value;
        });
        
        res.render('productos', {
            products,
            categories,
            config,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            },
            filters: {
                category,
                search,
                min_price,
                max_price,
                sort,
                order
            },
            title: 'Productos - ' + (config.site_name || 'AlquimiaTechnologic')
        });
        
    } catch (error) {
        console.error('Error cargando productos:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// Página de categoría
router.get('/categoria/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { page = 1, limit = 12, sort = 'created_at', order = 'DESC' } = req.query;
        
        // Obtener información de la categoría
        const category = await getOne(`
            SELECT c.*, COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
            WHERE c.slug = ? AND c.is_active = 1
            GROUP BY c.id
        `, [slug]);
        
        if (!category) {
            return res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
        }
        
        // Obtener productos de la categoría
        let query = `
            SELECT p.*, c.name as category_name, c.slug as category_slug,
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1 AND c.slug = ?
        `;
        
        const params = [slug];
        
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
        
        // Contar total
        const totalResult = await getOne(`
            SELECT COUNT(*) as total
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1 AND c.slug = ?
        `, [slug]);
        
        const total = totalResult.total;
        
        // Obtener configuración
        const siteConfig = await getMany('SELECT setting_key, setting_value FROM site_settings');
        const config = {};
        siteConfig.forEach(setting => {
            config[setting.setting_key] = setting.setting_value;
        });
        
        res.render('categoria', {
            category,
            products,
            config,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            },
            filters: { sort, order },
            title: `${category.name} - ${config.site_name || 'AlquimiaTechnologic'}`
        });
        
    } catch (error) {
        console.error('Error cargando categoría:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// Página de producto individual
router.get('/producto/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        // Obtener producto
        const product = await getOne(`
            SELECT p.*, c.name as category_name, c.slug as category_slug
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.slug = ? AND p.is_active = 1
        `, [slug]);
        
        if (!product) {
            return res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
        }
        
        // Obtener imágenes del producto
        const images = await getMany(`
            SELECT * FROM product_images 
            WHERE product_id = ? 
            ORDER BY is_primary DESC, sort_order ASC
        `, [product.id]);
        
        // Obtener productos relacionados
        const relatedProducts = await getMany(`
            SELECT p.*, c.name as category_name, c.slug as category_slug,
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.category_id = ? AND p.id != ? AND p.is_active = 1
            ORDER BY p.is_featured DESC, RAND()
            LIMIT 4
        `, [product.category_id, product.id]);
        
        // Obtener configuración
        const siteConfig = await getMany('SELECT setting_key, setting_value FROM site_settings');
        const config = {};
        siteConfig.forEach(setting => {
            config[setting.setting_key] = setting.setting_value;
        });
        
        res.render('producto', {
            product: {
                ...product,
                images
            },
            relatedProducts,
            config,
            title: `${product.name} - ${config.site_name || 'AlquimiaTechnologic'}`
        });
        
    } catch (error) {
        console.error('Error cargando producto:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// ========================================
// PÁGINAS ESTÁTICAS
// ========================================

// Página Acerca de
router.get('/acerca-de', async (req, res) => {
    try {
        const page = await getOne('SELECT * FROM pages WHERE slug = ? AND is_active = 1', ['acerca-de']);
        
        if (!page) {
            return res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
        }
        
        const siteConfig = await getMany('SELECT setting_key, setting_value FROM site_settings');
        const config = {};
        siteConfig.forEach(setting => {
            config[setting.setting_key] = setting.setting_value;
        });
        
        res.render('acerca-de', {
            page,
            config,
            title: `${page.title} - ${config.site_name || 'AlquimiaTechnologic'}`
        });
        
    } catch (error) {
        console.error('Error cargando página Acerca de:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// Página de contacto
router.get('/contacto', async (req, res) => {
    try {
        const siteConfig = await getMany('SELECT setting_key, setting_value FROM site_settings');
        const config = {};
        siteConfig.forEach(setting => {
            config[setting.setting_key] = setting.setting_value;
        });
        
        res.render('contacto', {
            config,
            title: `Contacto - ${config.site_name || 'AlquimiaTechnologic'}`
        });
        
    } catch (error) {
        console.error('Error cargando página de contacto:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// Página de términos y condiciones
router.get('/terminos-condiciones', async (req, res) => {
    try {
        const page = await getOne('SELECT * FROM pages WHERE slug = ? AND is_active = 1', ['terminos-condiciones']);
        
        if (!page) {
            return res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
        }
        
        const siteConfig = await getMany('SELECT setting_key, setting_value FROM site_settings');
        const config = {};
        siteConfig.forEach(setting => {
            config[setting.setting_key] = setting.setting_value;
        });
        
        res.render('terminos', {
            page,
            config,
            title: `${page.title} - ${config.site_name || 'AlquimiaTechnologic'}`
        });
        
    } catch (error) {
        console.error('Error cargando términos y condiciones:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// Página de política de privacidad
router.get('/politica-privacidad', async (req, res) => {
    try {
        const page = await getOne('SELECT * FROM pages WHERE slug = ? AND is_active = 1', ['politica-privacidad']);
        
        if (!page) {
            return res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
        }
        
        const siteConfig = await getMany('SELECT setting_key, setting_value FROM site_settings');
        const config = {};
        siteConfig.forEach(setting => {
            config[setting.setting_key] = setting.setting_value;
        });
        
        res.render('politica', {
            page,
            config,
            title: `${page.title} - ${config.site_name || 'AlquimiaTechnologic'}`
        });
        
    } catch (error) {
        console.error('Error cargando política de privacidad:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// ========================================
// RUTAS DE CARRITO
// ========================================

// Página del carrito
router.get('/carrito', async (req, res) => {
    try {
        const siteConfig = await getMany('SELECT setting_key, setting_value FROM site_settings');
        const config = {};
        siteConfig.forEach(setting => {
            config[setting.setting_key] = setting.setting_value;
        });
        
        res.render('carrito', {
            config,
            title: `Carrito - ${config.site_name || 'AlquimiaTechnologic'}`
        });
        
    } catch (error) {
        console.error('Error cargando carrito:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// ========================================
// RUTAS DE BÚSQUEDA
// ========================================

// Página de resultados de búsqueda
router.get('/buscar', async (req, res) => {
    try {
        const { q, category, min_price, max_price, page = 1, limit = 12 } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.redirect('/productos');
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
            WHERE p.is_active = 1 AND (
                p.name LIKE ? OR 
                p.description LIKE ? OR 
                p.short_description LIKE ? OR
                c.name LIKE ?
            )
        `;
        
        const countParams = [searchTerm, searchTerm, searchTerm, searchTerm];
        
        if (category) {
            countQuery += ' AND c.slug = ?';
            countParams.push(category);
        }
        
        if (min_price) {
            countQuery += ' AND p.price >= ?';
            countParams.push(parseFloat(min_price));
        }
        
        if (max_price) {
            countQuery += ' AND p.price <= ?';
            countParams.push(parseFloat(max_price));
        }
        
        const totalResult = await getOne(countQuery, countParams);
        const total = totalResult.total;
        
        // Obtener categorías para filtros
        const categories = await getMany(`
            SELECT c.*, COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
            WHERE c.is_active = 1
            GROUP BY c.id
            ORDER BY c.sort_order ASC
        `);
        
        // Obtener configuración
        const siteConfig = await getMany('SELECT setting_key, setting_value FROM site_settings');
        const config = {};
        siteConfig.forEach(setting => {
            config[setting.setting_key] = setting.setting_value;
        });
        
        res.render('busqueda', {
            products,
            categories,
            config,
            searchQuery: q,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            },
            filters: {
                category,
                min_price,
                max_price
            },
            title: `Búsqueda: ${q} - ${config.site_name || 'AlquimiaTechnologic'}`
        });
        
    } catch (error) {
        console.error('Error en búsqueda:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// ========================================
// RUTAS DE ERROR
// ========================================

// Página 404
router.get('/404', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

// Manejar rutas no encontradas
router.use('*', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

module.exports = router; 