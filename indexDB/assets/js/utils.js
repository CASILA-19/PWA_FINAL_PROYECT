/**
 * Utilidades para la PWA de Mascotas
 * Funciones para UUID y encriptación
 */

/**
 * Genera un UUID v4 válido
 * @returns {string} UUID v4
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Encripta una contraseña usando SHA-256
 * @param {string} password - Contraseña a encriptar
 * @returns {Promise<string>} Hash SHA-256 en hexadecimal
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Genera un token JWT simulado
 * @param {object} payload - Datos del usuario
 * @returns {string} Token simulado
 */
function generateSimpleJWT(payload) {
    const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const payloadEncoded = btoa(JSON.stringify({
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
    }));
    return `${header}.${payloadEncoded}.signature`;
}

/**
 * Decodifica un token JWT simulado
 * @param {string} token - Token a decodificar
 * @returns {object|null} Payload del token o null si es inválido
 */
function decodeSimpleJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const payload = JSON.parse(atob(parts[1]));
        
        // Verificar si el token ha expirado
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        
        return payload;
    } catch (error) {
        return null;
    }
}

/**
 * Verifica si hay una sesión activa
 * @returns {object|null} Datos del usuario o null
 */
function getCurrentUser() {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    
    return decodeSimpleJWT(token);
}

/**
 * Cierra la sesión actual
 */
function logout() {
    localStorage.removeItem('authToken');
    window.location.href = '/login.html';
}