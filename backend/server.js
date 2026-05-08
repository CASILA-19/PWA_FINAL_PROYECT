require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.MASCOTAS_PORT || 3303;
const JWT_SECRET = process.env.JWT_SECRET || 'mi_secreto_super_seguro_2024';

// Configuración de PostgreSQL
const pool = new Pool({
    host: process.env.MASCOTAS_POSTGRES_HOST || 'postgres',
    port: process.env.MASCOTAS_POSTGRES_PORT || 5432,
    user: process.env.MASCOTAS_POSTGRES_USER || 'root',
    password: process.env.MASCOTAS_POSTGRES_PASSWORD || '1q2w3e4r5,',
    database: process.env.MASCOTAS_POSTGRES_DB || 'mascotasdb'
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
};

// ============================================
// RUTAS DE AUTENTICACIÓN
// ============================================

// POST /api/auth/register - Registrar nuevo usuario
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nombres, apellidos, tipo_documento, documento, direccion, telefono, ciudad, usuario, password, rol } = req.body;
        
        if (!nombres || !apellidos || !documento || !usuario || !password) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        
        const userExists = await pool.query(
            'SELECT id FROM usuario WHERE usuario = $1 OR documento = $2',
            [usuario, documento]
        );
        
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'El usuario o documento ya están registrados' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await pool.query(
            `INSERT INTO usuario (nombres, apellidos, "tipo documento", documento, dirección, teléfono, ciudad, usuario, contrasena, rol) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
             RETURNING id, nombres, apellidos, documento, rol, usuario`,
            [nombres, apellidos, tipo_documento, documento, direccion, telefono, ciudad, usuario, hashedPassword, rol || 'ENCUESTADOR']
        );
        
        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
});

// POST /api/auth/login - Iniciar sesión
app.post('/api/auth/login', async (req, res) => {
    try {
        const { usuario, password } = req.body;

        if (!usuario || !password) {
            return res.status(400).json({ error: 'Nombre de Usuario y contraseña son requeridos' });
        }

        // Buscar usuario por email o usuario
        const result = await pool.query(
            'SELECT id, nombres, apellidos, documento, rol, usuario, contrasena FROM usuario WHERE usuario = $1 OR usuario = $1',
            [usuario]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = result.rows[0];

        // Verificar contraseña
        const validPassword = await bcrypt.compare(password, user.contrasena);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Generar JWT
        const token = jwt.sign(
            { id: user.id, rol: user.rol },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: `Login exitoso, bienvenido ${user.usuario}`,
            token,
            user: {
                id: user.id,
                nombre: user.nombres,
                Apellido: user.apellidos,
                documento: user.documento,
                rol: user.rol
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

// ============================================
// RUTAS DE DUEÑOS
// ============================================

// GET /api/duenos - Obtener todos los dueños
app.get('/api/duenos', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, nombres, apellidos, tipo_documento, documento, direccion, telefono, ciudad FROM dueno ORDER BY nombres'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener dueños:', error);
        res.status(500).json({ error: 'Error al obtener dueños' });
    }
});

// GET /api/duenos/:id - Obtener un dueño por ID
app.get('/api/duenos/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT id, nombres, apellidos, tipo_documento, documento, direccion, telefono, ciudad FROM dueno WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Dueño no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener dueño:', error);
        res.status(500).json({ error: 'Error al obtener dueño' });
    }
});

// POST /api/duenos - Crear nuevo dueño
app.post('/api/duenos', authenticateToken, async (req, res) => {
    try {
        const { nombres, apellidos, tipo_documento, documento, dirección, teléfono, ciudad } = req.body;

        if (!nombres || !apellidos || !documento) {
            return res.status(400).json({ error: 'Nombres, apellidos y documento son requeridos' });
        }

        const result = await pool.query(
            'INSERT INTO dueno (nombres, apellidos, tipo_documento, documento, direccion, telefono, ciudad) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, nombres, apellidos, tipo_documento, documento, direccion, telefono, ciudad',
            [nombres, apellidos, tipo_documento, documento, dirección, teléfono, ciudad]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al crear dueño:', error);
        res.status(500).json({ error: 'Error al crear dueño' });
    }
});

// PUT /api/duenos/:id - Actualizar dueño
app.put('/api/duenos/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombres, apellidos, tipo_documento, documento, direccion, telefono, ciudad } = req.body;

        const result = await pool.query(
            `UPDATE dueno 
             SET nombres = $1, apellidos = $2, tipo_documento = $3, documento = $4, 
                 direccion = $5, telefono = $6, ciudad = $7 
             WHERE id = $8 
             RETURNING id, nombres, apellidos, tipo_documento, documento, direccion, telefono, ciudad`,
            [nombres, apellidos, tipo_documento, documento, direccion, telefono, ciudad, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Dueño no encontrado o no tienes permiso' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al actualizar dueño:', error);
        res.status(500).json({ error: 'Error al actualizar dueño' });
    }
});

// DELETE /api/duenos/:id - Eliminar dueño
app.delete('/api/duenos/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM dueno WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Dueño no encontrado' });
        }

        res.json({ message: 'Dueño eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar dueño:', error);
        res.status(500).json({ error: 'No se puede eliminar un dueño que tiene mascotas registradas' });
    }
});

// ============================================
// RUTAS DE MASCOTAS 
// ============================================

// Función auxiliar para calcular tamaño de Base64 en KB
const getBase64Size = (base64String) => {
    const stringLength = base64String.length - (base64String.indexOf(',') + 1);
    const sizeInBytes = (stringLength * (3 / 4));
    return sizeInBytes / 1024; // Retorna KB
};

// GET /api/mascotas - Obtener todas las mascotas (con info del dueño)
app.get('/api/mascotas', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT m.id, m.nombre, m.genero, m.edad, m.fotografia, m."idDueno", 
             d.nombres as nombre_dueno, d.apellidos as apellido_dueno 
             FROM mascota m 
             LEFT JOIN dueno d ON m."idDueno" = d.id 
             ORDER BY m.nombre`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener mascotas:', error);
        res.status(500).json({ error: 'Error al obtener mascotas' });
    }
});

// POST /api/mascotas - Crear nueva mascota con validación de imagen
app.post('/api/mascotas', authenticateToken, async (req, res) => {
    try {
        const { nombre, genero, edad, idDueno, fotografia } = req.body;

        if (!nombre || !genero || !idDueno) {
            return res.status(400).json({ error: 'Nombre, género e ID del dueño son requeridos' });
        }
        if (fotografia) {
            const sizeInKB = getBase64Size(fotografia);
            if (sizeInKB > 50) {
                return res.status(400).json({
                    error: `La fotografía es muy pesada (${sizeInKB.toFixed(2)} KB). El máximo permitido es 50 KB.`
                });
            }
        }
        const result = await pool.query(
            'INSERT INTO mascota (nombre, genero, edad, "idDueno", fotografia) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [nombre, genero, edad || 0, idDueno, fotografia]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al crear mascota:', error);
        res.status(500).json({ error: 'Error al crear mascota' });
    }
});

// PUT /api/mascotas/:id - Actualizar mascota
app.put('/api/mascotas/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, genero, edad, idDueno, fotografia } = req.body;
        if (fotografia) {
            const sizeInKB = getBase64Size(fotografia);
            if (sizeInKB > 50) {
                return res.status(400).json({ error: 'La fotografía excede los 50 KB permitidos.' });
            }
        }

        const result = await pool.query(
            `UPDATE mascota 
             SET nombre = $1, genero = $2, edad = $3, "idDueno" = $4, fotografia = $5 
             WHERE id = $6 RETURNING *`,
            [nombre, genero, edad, idDueno, fotografia, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al actualizar mascota:', error);
        res.status(500).json({ error: 'Error al actualizar mascota' });
    }
});

// DELETE /api/mascotas/:id - Eliminar mascota
app.delete('/api/mascotas/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM mascota WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada' });
        }
        res.json({ message: 'Mascota eliminada exitosamente' });
    } catch (error) {
        console.error('Error al eliminar mascota:', error);
        res.status(500).json({ error: 'Error al eliminar mascota' });
    }
});
// ============================================
// RUTAS DE CENSOS
// ============================================

// Función auxiliar para validar tamaño Base64 (Máximo 50 KB)
const validateImageSize = (base64) => {
    if (!base64) return true;
    const sizeInBytes = (base64.length * (3 / 4));
    return (sizeInBytes / 1024) <= 50; 
};

// GET /api/censos - Obtener censos (Filtrado por rol)
app.get('/api/censos', authenticateToken, async (req, res) => {
    try {
        let query;
        let params = [];

        // Query base con Joins para traer nombres legibles
        const baseQuery = `
            SELECT 
                c.id, c.fotografia, c.lat, c.lon, c."idProyecto", c.color, c.fecha_creacion,
                u.nombres as nombre_encuestador, 
                m.nombre as nombre_mascota,
                d.nombres as nombre_dueno
            FROM censo c
            LEFT JOIN usuario u ON c."idEncuestador" = u.id
            LEFT JOIN mascota m ON c."idMascota" = m.id
            LEFT JOIN dueno d ON c."idDueno" = d.id
        `;

        if (req.user.rol === 'ADMIN') {
            query = `${baseQuery} ORDER BY c.fecha_creacion DESC`;
        } else {
            query = `${baseQuery} WHERE c."idEncuestador" = $1 ORDER BY c.fecha_creacion DESC`;
            params = [req.user.id];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener censos:', error);
        res.status(500).json({ error: 'Error al obtener censos' });
    }
});

// POST /api/censos - Crear nuevo censo (Captura GPS, Foto, Proyecto y Color)
app.post('/api/censos', authenticateToken, async (req, res) => {
    try {
        const { idMascota, idDueno, fotografia, lat, lon, idProyecto, color } = req.body;
        if (!idMascota || !idDueno || !fotografia || !lat || !lon || !idProyecto || !color) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios para el censo' });
        }
        if (!validateImageSize(fotografia)) {
            return res.status(400).json({ error: 'La fotografía del censo excede los 50 KB permitidos.' });
        }
        const idEncuestador = req.user.id;

        const result = await pool.query(
            `INSERT INTO censo ("idMascota", "idDueno", "idEncuestador", fotografia, lat, lon, "idProyecto", color) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING *`,
            [idMascota, idDueno, idEncuestador, fotografia, lat, lon, idProyecto, color]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al crear censo:', error);
        res.status(500).json({ error: 'Error al crear censo' });
    }
});

// GET /api/censos/:id - Obtener detalle de un censo
app.get('/api/censos/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        let query = 'SELECT * FROM censo WHERE id = $1';
        let params = [id];

        // Si no es admin, solo puede ver sus propios registros
        if (req.user.rol !== 'ADMIN') {
            query += ' AND "idEncuestador" = $2';
            params.push(req.user.id);
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Censo no encontrado o no tiene permisos' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener censo:', error);
        res.status(500).json({ error: 'Error al obtener censo' });
    }
});

// DELETE /api/censos/:id - Eliminar censo (Protegido por rol)
app.delete('/api/censos/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        let query = 'DELETE FROM censo WHERE id = $1';
        let params = [id];

        if (req.user.rol !== 'ADMIN') {
            query += ' AND "idEncuestador" = $2';
            params.push(req.user.id);
        }

        query += ' RETURNING id';
        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Censo no encontrado o no autorizado para borrar' });
        }

        res.json({ message: 'Censo eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar censo:', error);
        res.status(500).json({ error: 'Error al eliminar censo' });
    }
});

// ============================================
// RUTAS DE GESTIÓN DE USUARIOS (Solo ADMIN)
// ============================================

// Middleware para verificar que el usuario es ADMIN
const isAdmin = (req, res, next) => {
    if (req.user.rol !== 'ADMIN') {
        return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }
    next();
};

// GET /api/usuarios - Listar todos los usuarios (Solo ADMIN)
app.get('/api/usuarios', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, nombres, apellidos, usuario, documento, rol FROM usuario ORDER BY nombres'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// PUT /api/usuarios/:id - Editar usuario (Solo ADMIN)
app.put('/api/usuarios/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombres, apellidos, usuario, documento, rol } = req.body;

        const result = await pool.query(
            'UPDATE usuario SET nombres = $1, apellidos = $2, usuario = $3, documento = $4, rol = $5 WHERE id = $6 RETURNING id, nombres, apellidos, usuario, documento, rol',
            [nombres, apellidos, usuario, documento, rol, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

// DELETE /api/usuarios/:id - Eliminar usuario (Solo ADMIN)
app.delete('/api/usuarios/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM usuario WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ message: 'Usuario eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

// GET /api/estadisticas - Estadísticas globales (Solo ADMIN)
app.get('/api/estadisticas', authenticateToken, isAdmin, async (req, res) => {
    try {
        const totalCensos = await pool.query('SELECT COUNT(*) as total FROM censo');
        const totalMascotas = await pool.query('SELECT COUNT(*) as total FROM mascota');
        const totalDuenos = await pool.query('SELECT COUNT(*) as total FROM dueno');
        const totalEncuestadores = await pool.query('SELECT COUNT(*) as total FROM usuario WHERE rol = $1', ['ENCUESTADOR']);
        const mascotasPorGenero = await pool.query('SELECT genero, COUNT(*) as cantidad FROM mascota GROUP BY genero');

        res.json({
            totalCensos: parseInt(totalCensos.rows[0].total),
            totalMascotas: parseInt(totalMascotas.rows[0].total),
            totalDuenos: parseInt(totalDuenos.rows[0].total),
            totalEncuestadores: parseInt(totalEncuestadores.rows[0].total),
            mascotasPorGenero: mascotasPorGenero.rows
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// ============================================
// RUTA DE SALUD
// ============================================

app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'API de Mascotas funcionando correctamente' });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Base de datos: ${process.env.MASCOTAS_POSTGRES_DB}`);
});

// Manejo de errores de conexión a la base de datos
pool.on('error', (err) => {
    console.error('Error inesperado en el pool de PostgreSQL:', err);
});
