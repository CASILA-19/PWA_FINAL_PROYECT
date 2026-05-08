document.getElementById('registroForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btnRegistrar = document.getElementById('btnRegistrar');
    btnRegistrar.disabled = true;
    btnRegistrar.textContent = 'Registrando...';
    
    try {
        const nombres = document.getElementById('nombres').value.trim();
        const apellidos = document.getElementById('apellidos').value.trim();
        const tipo_documento = document.getElementById('tipo_documento').value;
        const documento = document.getElementById('documento').value.trim();
        const direccion = document.getElementById('direccion').value.trim();
        const telefono = document.getElementById('telefono').value.trim();
        const ciudad = document.getElementById('ciudad').value.trim();
        const usuario = document.getElementById('usuario').value.trim();
        const contrasena = document.getElementById('contrasena').value;
        const confirmarContrasena = document.getElementById('confirmarContrasena').value;
        
        // Validaciones
        if (contrasena !== confirmarContrasena) {
            throw new Error('Las contraseñas no coinciden');
        }
        
        if (contrasena.length < 6) {
            throw new Error('La contraseña debe tener al menos 6 caracteres');
        }
        
        if (usuario.length < 4) {
            throw new Error('El usuario debe tener al menos 4 caracteres');
        }
        
        const data = await apiRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                nombres,
                apellidos,
                tipo_documento,
                documento,
                direccion,
                telefono,
                ciudad,
                usuario,
                password: contrasena,
                rol: 'ENCUESTADOR'
            })
        });
        
        mostrarExito('Registro exitoso. Redirigiendo al login...');
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        
    } catch (error) {
        mostrarError(error.message || 'Error al registrarse');
        btnRegistrar.disabled = false;
        btnRegistrar.textContent = 'Registrarse';
    }
});

function mostrarError(mensaje) {
    const alertaAnterior = document.querySelector('.alert');
    if (alertaAnterior) alertaAnterior.remove();
    
    const alerta = document.createElement('div');
    alerta.className = 'alert alert-danger alert-dismissible fade show';
    alerta.innerHTML = `${mensaje}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    
    const formulario = document.getElementById('registroForm');
    formulario.insertBefore(alerta, formulario.firstChild);
}

function mostrarExito(mensaje) {
    const alertaAnterior = document.querySelector('.alert');
    if (alertaAnterior) alertaAnterior.remove();
    
    const alerta = document.createElement('div');
    alerta.className = 'alert alert-success alert-dismissible fade show';
    alerta.innerHTML = `${mensaje}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    
    const formulario = document.getElementById('registroForm');
    formulario.insertBefore(alerta, formulario.firstChild);
}
