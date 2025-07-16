const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getOne } = require('../config/database');

// ========================================
// MIDDLEWARE DE AUTENTICACIÓN
// ========================================

/**
 * Verificar token JWT
 */
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Token de acceso requerido'
            });
        }
        
        const token = authHeader.substring(7); // Remover 'Bearer '
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token inválido'
            });
        }
        
        // Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verificar si el usuario existe en la base de datos
        const admin = await getOne(
            'SELECT id, username, email, full_name, role, is_active FROM admins WHERE id = ? AND is_active = 1',
            [decoded.id]
        );
        
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no encontrado o inactivo'
            });
        }
        
        // Agregar información del usuario al request
        req.user = {
            id: admin.id,
            username: admin.username,
            email: admin.email,
            fullName: admin.full_name,
            role: admin.role
        };
        
        next();
        
    } catch (error) {
        console.error('Error verificando token:', error);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expirado'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido'
            });
        }
        
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * Verificar roles específicos
 */
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Autenticación requerida'
            });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado. Permisos insuficientes.'
            });
        }
        
        next();
    };
};

/**
 * Verificar si es super admin
 */
const requireSuperAdmin = (req, res, next) => {
    return requireRole(['super_admin'])(req, res, next);
};

/**
 * Verificar si es admin o super admin
 */
const requireAdmin = (req, res, next) => {
    return requireRole(['admin', 'super_admin'])(req, res, next);
};

/**
 * Middleware opcional de autenticación
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }
        
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const admin = await getOne(
            'SELECT id, username, email, full_name, role, is_active FROM admins WHERE id = ? AND is_active = 1',
            [decoded.id]
        );
        
        if (admin) {
            req.user = {
                id: admin.id,
                username: admin.username,
                email: admin.email,
                fullName: admin.full_name,
                role: admin.role
            };
        }
        
        next();
        
    } catch (error) {
        // Si hay error, continuar sin autenticación
        next();
    }
};

// ========================================
// FUNCIONES DE AUTENTICACIÓN
// ========================================

/**
 * Generar token JWT
 */
const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
};

/**
 * Verificar contraseña
 */
const verifyPassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

/**
 * Hashear contraseña
 */
const hashPassword = async (password) => {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
};

/**
 * Validar fortaleza de contraseña
 */
const validatePasswordStrength = (password) => {
    const errors = [];
    
    if (password.length < 8) {
        errors.push('La contraseña debe tener al menos 8 caracteres');
    }
    
    if (!/[A-Z]/.test(password)) {
        errors.push('La contraseña debe contener al menos una letra mayúscula');
    }
    
    if (!/[a-z]/.test(password)) {
        errors.push('La contraseña debe contener al menos una letra minúscula');
    }
    
    if (!/\d/.test(password)) {
        errors.push('La contraseña debe contener al menos un número');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('La contraseña debe contener al menos un carácter especial');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validar email
 */
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Sanitizar datos de entrada
 */
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    
    return input
        .trim()
        .replace(/[<>]/g, '') // Remover < y >
        .replace(/javascript:/gi, '') // Remover javascript:
        .replace(/on\w+=/gi, ''); // Remover event handlers
};

/**
 * Rate limiting para intentos de login
 */
const loginAttempts = new Map();

const checkLoginAttempts = (ip) => {
    const attempts = loginAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutos
    
    // Resetear si han pasado 15 minutos
    if (now - attempts.firstAttempt > windowMs) {
        attempts.count = 0;
        attempts.firstAttempt = now;
    }
    
    return attempts;
};

const incrementLoginAttempts = (ip) => {
    const attempts = checkLoginAttempts(ip);
    attempts.count++;
    loginAttempts.set(ip, attempts);
    
    // Limpiar después de 15 minutos
    setTimeout(() => {
        loginAttempts.delete(ip);
    }, 15 * 60 * 1000);
};

const isLoginBlocked = (ip) => {
    const attempts = checkLoginAttempts(ip);
    return attempts.count >= 5; // Máximo 5 intentos
};

// ========================================
// MIDDLEWARE DE SEGURIDAD
// ========================================

/**
 * Middleware para prevenir ataques de fuerza bruta
 */
const bruteForceProtection = (req, res, next) => {
    const ip = req.ip;
    
    if (isLoginBlocked(ip)) {
        return res.status(429).json({
            success: false,
            message: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.'
        });
    }
    
    next();
};

/**
 * Middleware para validar datos de entrada
 */
const validateInput = (schema) => {
    return (req, res, next) => {
        try {
            const { error } = schema.validate(req.body);
            
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Datos de entrada inválidos',
                    errors: error.details.map(detail => detail.message)
                });
            }
            
            next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error validando datos de entrada'
            });
        }
    };
};

/**
 * Middleware para sanitizar datos
 */
const sanitizeData = (req, res, next) => {
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeInput(req.body[key]);
            }
        });
    }
    
    next();
};

// ========================================
// FUNCIONES DE UTILIDAD
// ========================================

/**
 * Obtener información del usuario actual
 */
const getCurrentUser = (req) => {
    return req.user || null;
};

/**
 * Verificar si el usuario tiene permisos para un recurso
 */
const canAccessResource = (user, resourceOwnerId) => {
    if (!user) return false;
    
    // Super admin puede acceder a todo
    if (user.role === 'super_admin') return true;
    
    // Admin puede acceder a recursos que no son de super admin
    if (user.role === 'admin') {
        // Aquí puedes agregar lógica específica
        return true;
    }
    
    // Usuario solo puede acceder a sus propios recursos
    return user.id === resourceOwnerId;
};

/**
 * Log de actividad
 */
const logActivity = async (userId, action, details = {}) => {
    try {
        const { insert } = require('../config/database');
        await insert(
            'INSERT INTO admin_activity_logs (admin_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
            [userId, action, JSON.stringify(details), details.ip || 'unknown']
        );
    } catch (error) {
        console.error('Error logging activity:', error);
    }
};

module.exports = {
    // Middleware
    verifyToken,
    requireRole,
    requireSuperAdmin,
    requireAdmin,
    optionalAuth,
    bruteForceProtection,
    validateInput,
    sanitizeData,
    
    // Funciones de autenticación
    generateToken,
    verifyPassword,
    hashPassword,
    validatePasswordStrength,
    validateEmail,
    
    // Funciones de seguridad
    checkLoginAttempts,
    incrementLoginAttempts,
    isLoginBlocked,
    
    // Utilidades
    getCurrentUser,
    canAccessResource,
    logActivity
}; 