// Verificar si ya hay sesión activa
document.addEventListener('DOMContentLoaded', () => {
    if (isAuthenticated()) {
        window.location.href = '../../index.html';
    }
});

// Manejar el formulario de login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btnLogin = document.getElementById('btnLogin');
    btnLogin.disabled = true;
    btnLogin.textContent = 'Iniciando...';
    
    try {
        const usuario = document.getElementById('usuario').value.trim();
        const contrasena = document.getElementById('contrasena').value;
        
        const data = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ usuario: usuario, password: contrasena })
        });
        
        // Guardar token y usuario
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        mostrarExito(data.message);
        
        setTimeout(() => {
            window.location.href = '../../index.html';
        }, 1000);
        
    } catch (error) {
        mostrarError(error.message || 'Error al iniciar sesión');
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = 'Iniciar Sesión';
    }
});

function mostrarError(mensaje) {
    const alertaAnterior = document.querySelector('.alert');
    if (alertaAnterior) alertaAnterior.remove();
    
    const alerta = document.createElement('div');
    alerta.className = 'alert alert-danger alert-dismissible fade show';
    alerta.innerHTML = `${mensaje}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    
    const formulario = document.getElementById('loginForm');
    formulario.insertBefore(alerta, formulario.firstChild);
}

function mostrarExito(mensaje) {
    const alertaAnterior = document.querySelector('.alert');
    if (alertaAnterior) alertaAnterior.remove();
    
    const alerta = document.createElement('div');
    alerta.className = 'alert alert-success alert-dismissible fade show';
    alerta.innerHTML = `${mensaje}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    
    const formulario = document.getElementById('loginForm');
    formulario.insertBefore(alerta, formulario.firstChild);
}
