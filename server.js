const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Configuración de entorno
require('dotenv').config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ========================================
// CONFIGURACIÓN DE SEGURIDAD Y MIDDLEWARE
// ========================================

// Helmet para seguridad
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// CORS configurado
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requests por IP
    message: {
        error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo en 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // máximo 5 intentos de login
    message: {
        error: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.'
    }
});

app.use('/api/auth', authLimiter);
app.use('/api/', limiter);

// Compresión
app.use(compression());

// Logging
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const accessLogStream = fs.createWriteStream(
    path.join(logDir, 'access.log'),
    { flags: 'a' }
);

app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev'));

// ========================================
// CONFIGURACIÓN DE EXPRESS
// ========================================

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true,
    lastModified: true
}));

// ========================================
// CONEXIÓN A BASE DE DATOS
// ========================================

const db = require('./config/database');

// Verificar conexión a la base de datos
async function testDatabaseConnection() {
    try {
        await db.query('SELECT 1');
        console.log('✅ Conexión a la base de datos establecida correctamente');
    } catch (error) {
        console.error('❌ Error conectando a la base de datos:', error.message);
        process.exit(1);
    }
}

// ========================================
// RUTAS
// ========================================

// Rutas de autenticación
app.use('/api/auth', require('./routes/auth'));

// Rutas de la API
app.use('/api', require('./routes/api'));

// Rutas públicas
app.use('/', require('./routes/public'));

// Rutas de administración
app.use('/admin', require('./routes/admin'));

// ========================================
// MANEJO DE ERRORES
// ========================================

// Middleware para manejar rutas no encontradas
app.use((req, res, next) => {
    if (req.accepts('html')) {
        res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
        return;
    }
    
    if (req.accepts('json')) {
        res.status(404).json({ 
            success: false, 
            message: 'Ruta no encontrada',
            path: req.path 
        });
        return;
    }
    
    res.status(404).type('txt').send('Ruta no encontrada');
});

// Middleware de manejo de errores global
app.use((error, req, res, next) => {
    console.error('Error:', error);
    
    // Log del error
    const errorLog = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        error: error.message,
        stack: error.stack
    };
    
    fs.appendFileSync(
        path.join(logDir, 'error.log'),
        JSON.stringify(errorLog) + '\n'
    );
    
    // Respuesta al cliente
    if (NODE_ENV === 'production') {
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    } else {
        res.status(500).json({
            success: false,
            message: error.message,
            stack: error.stack
        });
    }
});

// ========================================
// FUNCIONES DE UTILIDAD
// ========================================

// Función para limpiar logs antiguos
function cleanupOldLogs() {
    const logFiles = ['access.log', 'error.log'];
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 días
    
    logFiles.forEach(filename => {
        const filePath = path.join(logDir, filename);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (Date.now() - stats.mtime.getTime() > maxAge) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Log antiguo eliminado: ${filename}`);
            }
        }
    });
}

// Función para verificar salud del sistema
function healthCheck() {
    return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: NODE_ENV
    };
}

// ========================================
// RUTAS DE SISTEMA
// ========================================

// Health check endpoint
app.get('/health', (req, res) => {
    res.json(healthCheck());
});

// ========================================
// INICIALIZACIÓN DEL SERVIDOR
// ========================================

async function startServer() {
    try {
        // Verificar conexión a la base de datos
        await testDatabaseConnection();
        
        // Crear servidor HTTP
        const server = http.createServer(app);
        
        // Configurar timeouts
        server.timeout = 30000; // 30 segundos
        server.keepAliveTimeout = 65000; // 65 segundos
        server.headersTimeout = 66000; // 66 segundos
        
        // Iniciar servidor
        server.listen(PORT, () => {
            console.log('\n🚀 Servidor iniciado exitosamente');
            console.log(`📍 URL: http://localhost:${PORT}`);
            console.log(`🌍 Entorno: ${NODE_ENV}`);
            console.log(`📊 Panel Admin: http://localhost:${PORT}/admin`);
            console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
            console.log('──────────────────────────────────────────────────\n');
        });
        
        // Manejo de errores del servidor
        server.on('error', (error) => {
            console.error('❌ Error del servidor:', error);
            process.exit(1);
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
            server.close(() => {
                console.log('✅ Servidor cerrado correctamente');
                process.exit(0);
            });
        });
        
        process.on('SIGINT', () => {
            console.log('🛑 Recibida señal SIGINT, cerrando servidor...');
            server.close(() => {
                console.log('✅ Servidor cerrado correctamente');
                process.exit(0);
            });
        });
        
        // Limpiar logs antiguos cada día
        setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);
        
    } catch (error) {
        console.error('❌ Error iniciando servidor:', error);
        process.exit(1);
    }
}

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Excepción no capturada:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
    process.exit(1);
});

// Iniciar servidor
startServer();

module.exports = app; 