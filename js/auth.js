// auth.js - Autenticación JWT

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

async function handleLogin(e) {
    e.preventDefault();
    
    const usuario = document.getElementById('usuario').value.trim();
    const contrasena = document.getElementById('contrasena').value.trim();
    
    if (!usuario || !contrasena) {
        mostrarMensaje('Por favor completa todos los campos', 'danger');
        return;
    }
    
    try {
        const response = await fetch(`${ENV.API_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, contrasena })
        });
        
        if (!response.ok) throw new Error('Credenciales incorrectas');
        
        const data = await response.json();
        
        // Guardar token, tipo y expiración
        localStorage.setItem('jwt_token', data.token);
        localStorage.setItem('token_type', data.tipoToken || 'Bearer');
        localStorage.setItem('token_expires', Date.now() + (data.expiraEn * 1000));
        localStorage.setItem('usuario', usuario);
        
        mostrarMensaje('Login exitoso. Redirigiendo...', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
        
    } catch (error) {
        console.error('Error de login:', error);
        mostrarMensaje('Error: ' + error.message, 'danger');
    }
}

function mostrarMensaje(texto, tipo) {
    const mensaje = document.getElementById('mensaje');
    mensaje.innerHTML = `<div class="alert alert-${tipo}">${texto}</div>`;
}

// Verificar si ya está autenticado
function verificarAuth() {
    const token = localStorage.getItem('jwt_token');
    const expira = localStorage.getItem('token_expires');
    
    if (!token || (expira && Date.now() > parseInt(expira))) {
        if (!window.location.pathname.includes('login.html')) {
            localStorage.clear();
            window.location.href = 'login.html';
        }
    }
}

// Cerrar sesión
function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}
