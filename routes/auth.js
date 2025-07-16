const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getOne, insert, update, getMany } = require('../config/database');
const { 
    verifyToken, 
    generateToken, 
    verifyPassword, 
    hashPassword, 
    validatePasswordStrength,
    validateEmail,
    sanitizeInput,
    bruteForceProtection,
    incrementLoginAttempts,
    isLoginBlocked,
    logActivity,
    requireSuperAdmin
} = require('../middleware/auth');

const router = express.Router();

// ========================================
// RUTAS DE AUTENTICACIÓN
// ========================================

// Login de administrador
router.post('/login', bruteForceProtection, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Validaciones básicas
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Usuario y contraseña son requeridos'
            });
        }
        
        // Sanitizar entrada
        const sanitizedUsername = sanitizeInput(username);
        const sanitizedPassword = sanitizeInput(password);
        
        // Verificar si la IP está bloqueada
        if (isLoginBlocked(req.ip)) {
            return res.status(429).json({
                success: false,
                message: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.'
            });
        }
        
        // Buscar administrador
        const admin = await getOne(`
            SELECT id, username, email, password, full_name, role, is_active, last_login
            FROM admins 
            WHERE username = ? OR email = ?
        `, [sanitizedUsername, sanitizedUsername]);
        
        if (!admin) {
            incrementLoginAttempts(req.ip);
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }
        
        // Verificar si el usuario está activo
        if (!admin.is_active) {
            incrementLoginAttempts(req.ip);
            return res.status(401).json({
                success: false,
                message: 'Cuenta desactivada'
            });
        }
        
        // Verificar contraseña
        const isValidPassword = await verifyPassword(sanitizedPassword, admin.password);
        
        if (!isValidPassword) {
            incrementLoginAttempts(req.ip);
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }
        
        // Actualizar último login
        await update('UPDATE admins SET last_login = NOW() WHERE id = ?', [admin.id]);
        
        // Generar token JWT
        const token = generateToken({
            id: admin.id,
            username: admin.username,
            email: admin.email,
            role: admin.role
        });
        
        // Log de actividad
        await logActivity(admin.id, 'admin_login', {
            ip: req.ip,
            user_agent: req.get('User-Agent')
        });
        
        res.json({
            success: true,
            message: 'Login exitoso',
            data: {
                token,
                user: {
                    id: admin.id,
                    username: admin.username,
                    email: admin.email,
                    fullName: admin.full_name,
                    role: admin.role
                }
            }
        });
        
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Verificar token
router.get('/verify', verifyToken, async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Token válido',
            data: {
                user: req.user
            }
        });
        
    } catch (error) {
        console.error('Error verificando token:', error);
        res.status(500).json({
            success: false,
            message: 'Error verificando token'
        });
    }
});

// Logout
router.post('/logout', verifyToken, async (req, res) => {
    try {
        // Log de actividad
        await logActivity(req.user.id, 'admin_logout', {
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Logout exitoso'
        });
        
    } catch (error) {
        console.error('Error en logout:', error);
        res.status(500).json({
            success: false,
            message: 'Error en logout'
        });
    }
});

// ========================================
// RUTAS DE GESTIÓN DE USUARIOS
// ========================================

// Obtener perfil del usuario actual
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const admin = await getOne(`
            SELECT id, username, email, full_name, role, is_active, last_login, created_at
            FROM admins 
            WHERE id = ?
        `, [req.user.id]);
        
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }
        
        res.json({
            success: true,
            data: admin
        });
        
    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo perfil'
        });
    }
});

// Actualizar perfil
router.put('/profile', verifyToken, async (req, res) => {
    try {
        const { full_name, email } = req.body;
        
        // Validaciones
        if (!full_name || full_name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'El nombre completo debe tener al menos 2 caracteres'
            });
        }
        
        if (email && !validateEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Email inválido'
            });
        }
        
        // Verificar si el email ya existe (excluyendo el usuario actual)
        if (email) {
            const existingAdmin = await getOne(
                'SELECT id FROM admins WHERE email = ? AND id != ?',
                [email, req.user.id]
            );
            
            if (existingAdmin) {
                return res.status(400).json({
                    success: false,
                    message: 'El email ya está en uso'
                });
            }
        }
        
        // Actualizar perfil
        const updateFields = [];
        const updateValues = [];
        
        if (full_name) {
            updateFields.push('full_name = ?');
            updateValues.push(sanitizeInput(full_name));
        }
        
        if (email) {
            updateFields.push('email = ?');
            updateValues.push(sanitizeInput(email));
        }
        
        if (updateFields.length > 0) {
            updateValues.push(req.user.id);
            await update(`UPDATE admins SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
        }
        
        // Log de actividad
        await logActivity(req.user.id, 'profile_updated', {
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Perfil actualizado exitosamente'
        });
        
    } catch (error) {
        console.error('Error actualizando perfil:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando perfil'
        });
    }
});

// Cambiar contraseña
router.put('/change-password', verifyToken, async (req, res) => {
    try {
        const { current_password, new_password, confirm_password } = req.body;
        
        // Validaciones
        if (!current_password || !new_password || !confirm_password) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son requeridos'
            });
        }
        
        if (new_password !== confirm_password) {
            return res.status(400).json({
                success: false,
                message: 'Las contraseñas no coinciden'
            });
        }
        
        // Obtener usuario actual
        const admin = await getOne('SELECT password FROM admins WHERE id = ?', [req.user.id]);
        
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }
        
        // Verificar contraseña actual
        const isValidCurrentPassword = await verifyPassword(current_password, admin.password);
        
        if (!isValidCurrentPassword) {
            return res.status(400).json({
                success: false,
                message: 'Contraseña actual incorrecta'
            });
        }
        
        // Validar fortaleza de la nueva contraseña
        const passwordValidation = validatePasswordStrength(new_password);
        
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'La nueva contraseña no cumple con los requisitos de seguridad',
                errors: passwordValidation.errors
            });
        }
        
        // Hashear nueva contraseña
        const hashedPassword = await hashPassword(new_password);
        
        // Actualizar contraseña
        await update('UPDATE admins SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);
        
        // Log de actividad
        await logActivity(req.user.id, 'password_changed', {
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Contraseña cambiada exitosamente'
        });
        
    } catch (error) {
        console.error('Error cambiando contraseña:', error);
        res.status(500).json({
            success: false,
            message: 'Error cambiando contraseña'
        });
    }
});

// ========================================
// RUTAS DE ADMINISTRACIÓN DE USUARIOS (SUPER ADMIN)
// ========================================

// Obtener todos los administradores
router.get('/admins', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        const admins = await getMany(`
            SELECT id, username, email, full_name, role, is_active, last_login, created_at
            FROM admins
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            data: admins
        });
        
    } catch (error) {
        console.error('Error obteniendo administradores:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo administradores'
        });
    }
});

// Crear nuevo administrador
router.post('/admins', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        const { username, email, password, full_name, role } = req.body;
        
        // Validaciones
        if (!username || !email || !password || !full_name) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son requeridos'
            });
        }
        
        if (username.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de usuario debe tener al menos 3 caracteres'
            });
        }
        
        if (!validateEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Email inválido'
            });
        }
        
        // Validar fortaleza de contraseña
        const passwordValidation = validatePasswordStrength(password);
        
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña no cumple con los requisitos de seguridad',
                errors: passwordValidation.errors
            });
        }
        
        // Verificar si el username ya existe
        const existingUsername = await getOne('SELECT id FROM admins WHERE username = ?', [username]);
        if (existingUsername) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de usuario ya existe'
            });
        }
        
        // Verificar si el email ya existe
        const existingEmail = await getOne('SELECT id FROM admins WHERE email = ?', [email]);
        if (existingEmail) {
            return res.status(400).json({
                success: false,
                message: 'El email ya existe'
            });
        }
        
        // Hashear contraseña
        const hashedPassword = await hashPassword(password);
        
        // Insertar nuevo administrador
        const adminId = await insert(`
            INSERT INTO admins (username, email, password, full_name, role)
            VALUES (?, ?, ?, ?, ?)
        `, [username, email, hashedPassword, full_name, role || 'admin']);
        
        // Log de actividad
        await logActivity(req.user.id, 'admin_created', {
            new_admin_id: adminId,
            new_admin_username: username,
            ip: req.ip
        });
        
        res.status(201).json({
            success: true,
            message: 'Administrador creado exitosamente',
            data: { id: adminId }
        });
        
    } catch (error) {
        console.error('Error creando administrador:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando administrador'
        });
    }
});

// Actualizar administrador
router.put('/admins/:id', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, full_name, role, is_active } = req.body;
        
        // Verificar que el administrador existe
        const existingAdmin = await getOne('SELECT username FROM admins WHERE id = ?', [id]);
        if (!existingAdmin) {
            return res.status(404).json({
                success: false,
                message: 'Administrador no encontrado'
            });
        }
        
        // Validaciones
        if (username && username.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de usuario debe tener al menos 3 caracteres'
            });
        }
        
        if (email && !validateEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Email inválido'
            });
        }
        
        // Verificar username único
        if (username) {
            const existingUsername = await getOne(
                'SELECT id FROM admins WHERE username = ? AND id != ?',
                [username, id]
            );
            if (existingUsername) {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre de usuario ya existe'
                });
            }
        }
        
        // Verificar email único
        if (email) {
            const existingEmail = await getOne(
                'SELECT id FROM admins WHERE email = ? AND id != ?',
                [email, id]
            );
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'El email ya existe'
                });
            }
        }
        
        // Actualizar administrador
        const updateFields = [];
        const updateValues = [];
        
        if (username) {
            updateFields.push('username = ?');
            updateValues.push(sanitizeInput(username));
        }
        
        if (email) {
            updateFields.push('email = ?');
            updateValues.push(sanitizeInput(email));
        }
        
        if (full_name) {
            updateFields.push('full_name = ?');
            updateValues.push(sanitizeInput(full_name));
        }
        
        if (role) {
            updateFields.push('role = ?');
            updateValues.push(role);
        }
        
        if (typeof is_active === 'boolean') {
            updateFields.push('is_active = ?');
            updateValues.push(is_active);
        }
        
        if (updateFields.length > 0) {
            updateValues.push(id);
            await update(`UPDATE admins SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
        }
        
        // Log de actividad
        await logActivity(req.user.id, 'admin_updated', {
            admin_id: id,
            admin_username: existingAdmin.username,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Administrador actualizado exitosamente'
        });
        
    } catch (error) {
        console.error('Error actualizando administrador:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando administrador'
        });
    }
});

// Eliminar administrador
router.delete('/admins/:id', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // No permitir eliminar el propio usuario
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'No puedes eliminar tu propia cuenta'
            });
        }
        
        // Verificar que el administrador existe
        const admin = await getOne('SELECT username FROM admins WHERE id = ?', [id]);
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Administrador no encontrado'
            });
        }
        
        // Eliminar administrador
        await update('DELETE FROM admins WHERE id = ?', [id]);
        
        // Log de actividad
        await logActivity(req.user.id, 'admin_deleted', {
            admin_id: id,
            admin_username: admin.username,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Administrador eliminado exitosamente'
        });
        
    } catch (error) {
        console.error('Error eliminando administrador:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando administrador'
        });
    }
});

// ========================================
// RUTAS DE RECUPERACIÓN DE CONTRASEÑA
// ========================================

// Solicitar reset de contraseña
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !validateEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Email válido es requerido'
            });
        }
        
        // Verificar si el email existe
        const admin = await getOne('SELECT id, username FROM admins WHERE email = ? AND is_active = 1', [email]);
        
        if (!admin) {
            // Por seguridad, no revelar si el email existe o no
            return res.json({
                success: true,
                message: 'Si el email existe, recibirás un enlace de recuperación'
            });
        }
        
        // Generar token de reset (expira en 1 hora)
        const resetToken = jwt.sign(
            { id: admin.id, type: 'password_reset' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        // Guardar token en la base de datos (en una tabla de reset tokens)
        await insert(`
            INSERT INTO password_reset_tokens (admin_id, token, expires_at)
            VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))
        `, [admin.id, resetToken]);
        
        // En un entorno real, aquí enviarías el email
        // Por ahora, solo logueamos el token
        console.log(`Reset token for ${email}: ${resetToken}`);
        
        res.json({
            success: true,
            message: 'Si el email existe, recibirás un enlace de recuperación'
        });
        
    } catch (error) {
        console.error('Error en forgot password:', error);
        res.status(500).json({
            success: false,
            message: 'Error procesando solicitud'
        });
    }
});

// Reset de contraseña
router.post('/reset-password', async (req, res) => {
    try {
        const { token, new_password, confirm_password } = req.body;
        
        if (!token || !new_password || !confirm_password) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son requeridos'
            });
        }
        
        if (new_password !== confirm_password) {
            return res.status(400).json({
                success: false,
                message: 'Las contraseñas no coinciden'
            });
        }
        
        // Validar fortaleza de contraseña
        const passwordValidation = validatePasswordStrength(new_password);
        
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña no cumple con los requisitos de seguridad',
                errors: passwordValidation.errors
            });
        }
        
        // Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (decoded.type !== 'password_reset') {
            return res.status(400).json({
                success: false,
                message: 'Token inválido'
            });
        }
        
        // Verificar que el token existe y no ha expirado
        const resetToken = await getOne(`
            SELECT admin_id FROM password_reset_tokens 
            WHERE token = ? AND expires_at > NOW() AND used = 0
        `, [token]);
        
        if (!resetToken) {
            return res.status(400).json({
                success: false,
                message: 'Token inválido o expirado'
            });
        }
        
        // Hashear nueva contraseña
        const hashedPassword = await hashPassword(new_password);
        
        // Actualizar contraseña
        await update('UPDATE admins SET password = ? WHERE id = ?', [hashedPassword, resetToken.admin_id]);
        
        // Marcar token como usado
        await update('UPDATE password_reset_tokens SET used = 1 WHERE token = ?', [token]);
        
        res.json({
            success: true,
            message: 'Contraseña actualizada exitosamente'
        });
        
    } catch (error) {
        console.error('Error en reset password:', error);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({
                success: false,
                message: 'Token expirado'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({
                success: false,
                message: 'Token inválido'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Error actualizando contraseña'
        });
    }
});

module.exports = router; 