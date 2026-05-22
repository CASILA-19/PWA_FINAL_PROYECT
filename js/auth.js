// auth.js - Autenticación JWT

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registroForm = document.getElementById('registroForm');
    
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registroForm) registroForm.addEventListener('submit', handleRegistro);
});

function mostrarLogin() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('registroSection').style.display = 'none';
    document.getElementById('mensaje').innerHTML = '';
}

function mostrarRegistro() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('registroSection').style.display = 'block';
    document.getElementById('mensaje').innerHTML = '';
}

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

async function handleRegistro(e) {
    e.preventDefault();
    
    const nombres = document.getElementById('regNombres').value.trim();
    const apellidos = document.getElementById('regApellidos').value.trim();
    const tipoDocumento = document.getElementById('regTipoDocumento').value;
    const documento = document.getElementById('regDocumento').value.trim();
    const direccion = document.getElementById('regDireccion').value.trim();
    const telefono = document.getElementById('regTelefono').value.trim();
    const ciudad = document.getElementById('regCiudad').value.trim();
    const usuario = document.getElementById('regUsuario').value.trim();
    const contrasena = document.getElementById('regContrasena').value.trim();
    
    if (!nombres || !apellidos || !documento || !usuario || !contrasena) {
        mostrarMensaje('Por favor completa todos los campos obligatorios', 'danger');
        return;
    }
    
    try {
        const persona = {
            nombres,
            apellidos,
            tipoDocumento,
            documento,
            direccion,
            telefono,
            ciudad,
            usuario,
            contrasena
        };
        
        const response = await fetch(`${ENV.API_URL}/api/v1/personas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(persona)
        });
        
        if (!response.ok) throw new Error('Error al registrar usuario');
        
        mostrarMensaje('Registro exitoso. Ahora puedes iniciar sesión.', 'success');
        
        setTimeout(() => {
            mostrarLogin();
        }, 2000);
        
    } catch (error) {
        console.error('Error de registro:', error);
        mostrarMensaje('Error: ' + error.message, 'danger');
    }
}

function mostrarMensaje(texto, tipo) {
    const mensaje = document.getElementById('mensaje');
    mensaje.innerHTML = `<div class="alert alert-${tipo}">${texto}</div>`;
}

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

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}
