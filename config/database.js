const mysql = require('mysql2/promise');
require('dotenv').config({ path: './config.env' });

// ========================================
// CONFIGURACIÓN DE CONEXIÓN
// ========================================

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'alquimia_technologic_store',
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4',
    timezone: '+00:00',
    // Configuración de pool
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
    // Configuración de SSL (para producción)
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
};

// ========================================
// POOL DE CONEXIONES
// ========================================

let pool;

const createPool = () => {
    try {
        pool = mysql.createPool(dbConfig);
        
        // Configurar eventos del pool
        pool.on('connection', (connection) => {
            console.log('🔗 Nueva conexión establecida con la base de datos');
            
            // Configurar timezone
            connection.query('SET time_zone = "+00:00"');
            
            // Configurar charset
            connection.query('SET NAMES utf8mb4');
        });
        
        pool.on('error', (err) => {
            console.error('❌ Error en el pool de conexiones:', err);
        });
        
        pool.on('acquire', (connection) => {
            console.log('📥 Conexión adquirida del pool');
        });
        
        pool.on('release', (connection) => {
            console.log('📤 Conexión liberada al pool');
        });
        
        return pool;
        
    } catch (error) {
        console.error('❌ Error creando pool de conexiones:', error);
        throw error;
    }
};

// ========================================
// FUNCIONES DE CONEXIÓN
// ========================================

/**
 * Obtener conexión del pool
 */
const getConnection = async () => {
    try {
        if (!pool) {
            pool = createPool();
        }
        return await pool.getConnection();
    } catch (error) {
        console.error('❌ Error obteniendo conexión:', error);
        throw error;
    }
};

/**
 * Probar conexión a la base de datos
 */
const testConnection = async () => {
    try {
        const connection = await getConnection();
        await connection.ping();
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Error probando conexión:', error);
        return false;
    }
};

// ========================================
// FUNCIONES DE CONSULTA
// ========================================

/**
 * Ejecutar consulta con parámetros
 */
const query = async (sql, params = []) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute(sql, params);
        return rows;
    } catch (error) {
        console.error('❌ Error ejecutando consulta:', error);
        console.error('SQL:', sql);
        console.error('Params:', params);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

/**
 * Obtener múltiples registros
 */
const getMany = async (sql, params = []) => {
    try {
        return await query(sql, params);
    } catch (error) {
        console.error('❌ Error obteniendo múltiples registros:', error);
        throw error;
    }
};

/**
 * Obtener un solo registro
 */
const getOne = async (sql, params = []) => {
    try {
        const rows = await query(sql, params);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('❌ Error obteniendo un registro:', error);
        throw error;
    }
};

/**
 * Insertar registro y obtener ID
 */
const insert = async (sql, params = []) => {
    let connection;
    try {
        connection = await getConnection();
        const [result] = await connection.execute(sql, params);
        return result.insertId;
    } catch (error) {
        console.error('❌ Error insertando registro:', error);
        console.error('SQL:', sql);
        console.error('Params:', params);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

/**
 * Actualizar registros
 */
const update = async (sql, params = []) => {
    let connection;
    try {
        connection = await getConnection();
        const [result] = await connection.execute(sql, params);
        return result.affectedRows;
    } catch (error) {
        console.error('❌ Error actualizando registros:', error);
        console.error('SQL:', sql);
        console.error('Params:', params);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

/**
 * Eliminar registros
 */
const remove = async (sql, params = []) => {
    let connection;
    try {
        connection = await getConnection();
        const [result] = await connection.execute(sql, params);
        return result.affectedRows;
    } catch (error) {
        console.error('❌ Error eliminando registros:', error);
        console.error('SQL:', sql);
        console.error('Params:', params);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

/**
 * Ejecutar transacción
 */
const transaction = async (callback) => {
    let connection;
    try {
        connection = await getConnection();
        await connection.beginTransaction();
        
        const result = await callback(connection);
        
        await connection.commit();
        return result;
        
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('❌ Error en transacción:', error);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// ========================================
// FUNCIONES DE UTILIDAD
// ========================================

/**
 * Escapar valores para prevenir SQL injection
 */
const escape = (value) => {
    if (typeof value === 'string') {
        return value.replace(/'/g, "''");
    }
    return value;
};

/**
 * Construir cláusula WHERE dinámica
 */
const buildWhereClause = (conditions) => {
    if (!conditions || Object.keys(conditions).length === 0) {
        return { sql: '', params: [] };
    }
    
    const clauses = [];
    const params = [];
    
    Object.keys(conditions).forEach(key => {
        if (conditions[key] !== undefined && conditions[key] !== null) {
            clauses.push(`${key} = ?`);
            params.push(conditions[key]);
        }
    });
    
    return {
        sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
        params
    };
};

/**
 * Construir cláusula ORDER BY dinámica
 */
const buildOrderClause = (orderBy) => {
    if (!orderBy || Object.keys(orderBy).length === 0) {
        return '';
    }
    
    const clauses = [];
    
    Object.keys(orderBy).forEach(key => {
        const direction = orderBy[key].toUpperCase();
        if (direction === 'ASC' || direction === 'DESC') {
            clauses.push(`${key} ${direction}`);
        }
    });
    
    return clauses.length > 0 ? `ORDER BY ${clauses.join(', ')}` : '';
};

/**
 * Construir cláusula LIMIT
 */
const buildLimitClause = (limit, offset = 0) => {
    if (!limit) {
        return '';
    }
    
    let sql = `LIMIT ${parseInt(limit)}`;
    if (offset > 0) {
        sql += ` OFFSET ${parseInt(offset)}`;
    }
    
    return sql;
};

/**
 * Paginar resultados
 */
const paginate = async (sql, params = [], page = 1, limit = 20) => {
    try {
        const offset = (page - 1) * limit;
        
        // Consulta para obtener datos
        const dataSql = `${sql} ${buildLimitClause(limit, offset)}`;
        const data = await getMany(dataSql, params);
        
        // Consulta para contar total
        const countSql = `SELECT COUNT(*) as total FROM (${sql}) as count_table`;
        const countResult = await getOne(countSql, params);
        const total = countResult.total;
        
        return {
            data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        };
        
    } catch (error) {
        console.error('❌ Error en paginación:', error);
        throw error;
    }
};

/**
 * Buscar texto en múltiples columnas
 */
const searchInColumns = (searchTerm, columns) => {
    if (!searchTerm || !columns || columns.length === 0) {
        return { sql: '', params: [] };
    }
    
    const conditions = columns.map(column => `${column} LIKE ?`);
    const params = columns.map(() => `%${searchTerm}%`);
    
    return {
        sql: `(${conditions.join(' OR ')})`,
        params
    };
};

/**
 * Validar existencia de registro
 */
const exists = async (table, conditions) => {
    try {
        const whereClause = buildWhereClause(conditions);
        const sql = `SELECT 1 FROM ${table} ${whereClause.sql} LIMIT 1`;
        const result = await getOne(sql, whereClause.params);
        return !!result;
    } catch (error) {
        console.error('❌ Error verificando existencia:', error);
        throw error;
    }
};

/**
 * Obtener estadísticas de tabla
 */
const getTableStats = async (table) => {
    try {
        const sql = `SELECT COUNT(*) as total FROM ${table}`;
        const result = await getOne(sql);
        return result.total;
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        throw error;
    }
};

// ========================================
// FUNCIONES DE MANTENIMIENTO
// ========================================

/**
 * Limpiar conexiones inactivas
 */
const cleanupConnections = async () => {
    try {
        if (pool) {
            await pool.end();
            console.log('🧹 Conexiones limpiadas');
        }
    } catch (error) {
        console.error('❌ Error limpiando conexiones:', error);
    }
};

/**
 * Verificar salud de la base de datos
 */
const healthCheck = async () => {
    try {
        const connection = await getConnection();
        await connection.ping();
        connection.release();
        
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            pool: {
                total: pool ? pool.pool._allConnections.length : 0,
                idle: pool ? pool.pool._freeConnections.length : 0,
                active: pool ? pool.pool._allConnections.length - pool.pool._freeConnections.length : 0
            }
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        };
    }
};

// ========================================
// MANEJO DE SEÑALES
// ========================================

// Limpiar conexiones al cerrar la aplicación
process.on('SIGINT', async () => {
    console.log('🛑 Cerrando conexiones de base de datos...');
    await cleanupConnections();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Cerrando conexiones de base de datos...');
    await cleanupConnections();
    process.exit(0);
});

// ========================================
// EXPORTACIÓN
// ========================================

module.exports = {
    // Funciones de conexión
    getConnection,
    testConnection,
    
    // Funciones de consulta
    query,
    getMany,
    getOne,
    insert,
    update,
    remove,
    transaction,
    
    // Funciones de utilidad
    escape,
    buildWhereClause,
    buildOrderClause,
    buildLimitClause,
    paginate,
    searchInColumns,
    exists,
    getTableStats,
    
    // Funciones de mantenimiento
    cleanupConnections,
    healthCheck
}; 