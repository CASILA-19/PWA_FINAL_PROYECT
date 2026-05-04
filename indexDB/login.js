/**
 * Lógica para el login de usuarios
 */

let db;

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    db = new PouchDB('mascotasDB');
    
    // Verificar si ya hay una sesión activa
    const usuarioActual = getCurrentUser();
    if (usuarioActual) {
        window.location.href = '/index.html';
        return;
    }
    
    const formulario = document.getElementById('loginForm');
    formulario.addEventListener('submit', manejarLogin);
});

/**
 * Maneja el envío del formulario de login
 */
async function manejarLogin(event) {
    event.preventDefault();
    
    const btnLogin = document.getElementById('btnLogin');
    btnLogin.disabled = true;
    btnLogin.textContent = 'Iniciando...';
    
    try {
        const usuario = document.getElementById('usuario').value.trim();
        const contrasena = document.getElementById('contrasena').value;
        
        // Validar campos
        if (!usuario || !contrasena) {
            mostrarError('Por favor completa todos los campos');
            return;
        }
        
        // Encriptar contraseña para comparar
        const contrasenaHash = await hashPassword(contrasena);
        
        // Buscar usuario en PouchDB
        const usuarioEncontrado = await buscarUsuario(usuario, contrasenaHash);
        
        if (usuarioEncontrado) {
            // Generar token JWT simulado
            const token = generateSimpleJWT({
                id: usuarioEncontrado._id,
                usuario: usuarioEncontrado.usuario,
                nombres: usuarioEncontrado.nombres,
                apellidos: usuarioEncontrado.apellidos
            });
            
            // Guardar token en localStorage
            localStorage.setItem('authToken', token);
            
            // Mostrar éxito y redirigir
            mostrarExito('Login exitoso. Redirigiendo...');
            
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 1500);
            
        } else {
            mostrarError('Usuario o contraseña incorrectos');
        }
        
    } catch (error) {
        console.error('Error en el login:', error);
        mostrarError('Error al iniciar sesión. Intenta nuevamente.');
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = 'Iniciar Sesión';
    }
}

/**
 * Busca un usuario en PouchDB
 */
async function buscarUsuario(usuario, contrasenaHash) {
    try {
        const result = await db.allDocs({ include_docs: true });
        
        const usuarioEncontrado = result.rows.find(row => {
            const doc = row.doc;
            return doc.type === 'persona' && 
                   doc.usuario === usuario && 
                   doc.contrasena === contrasenaHash;
        });
        
        return usuarioEncontrado ? usuarioEncontrado.doc : null;
        
    } catch (error) {
        console.error('Error al buscar usuario:', error);
        return null;
    }
}

/**
 * Muestra un mensaje de error
 */
function mostrarError(mensaje) {
    // Remover alertas anteriores
    const alertaAnterior = document.querySelector('.alert');
    if (alertaAnterior) {
        alertaAnterior.remove();
    }
    
    const alerta = document.createElement('div');
    alerta.className = 'alert alert-danger alert-dismissible fade show';
    alerta.innerHTML = `
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const formulario = document.getElementById('loginForm');
    formulario.insertBefore(alerta, formulario.firstChild);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        if (alerta.parentNode) {
            alerta.remove();
        }
    }, 5000);
}

/**
 * Muestra un mensaje de éxito
 */
function mostrarExito(mensaje) {
    // Remover alertas anteriores
    const alertaAnterior = document.querySelector('.alert');
    if (alertaAnterior) {
        alertaAnterior.remove();
    }
    
    const alerta = document.createElement('div');
    alerta.className = 'alert alert-success alert-dismissible fade show';
    alerta.innerHTML = `
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const formulario = document.getElementById('loginForm');
    formulario.insertBefore(alerta, formulario.firstChild);
}