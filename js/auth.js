// auth.js - Autenticación JWT

// Funciones de validación
function soloNumeros(valor) {
    return /^\d+$/.test(valor);
}

function validarDocumento(documento) {
    if (!documento) {
        return { valido: false, mensaje: 'El documento es requerido' };
    }
    if (!soloNumeros(documento)) {
        return { valido: false, mensaje: 'El documento solo debe contener números' };
    }
    if (documento.length < 5 || documento.length > 15) {
        return { valido: false, mensaje: 'El documento debe tener entre 5 y 15 dígitos' };
    }
    return { valido: true };
}

function validarTelefono(telefono) {
    if (!telefono) {
        return { valido: false, mensaje: 'El teléfono es requerido' };
    }
    if (!soloNumeros(telefono)) {
        return { valido: false, mensaje: 'El teléfono solo debe contener números' };
    }
    if (telefono.length < 7 || telefono.length > 15) {
        return { valido: false, mensaje: 'El teléfono debe tener entre 7 y 15 dígitos' };
    }
    return { valido: true };
}

function validarNombres(nombres) {
    if (!nombres) {
        return { valido: false, mensaje: 'Los nombres son requeridos' };
    }
    if (nombres.length < 2) {
        return { valido: false, mensaje: 'Los nombres deben tener al menos 2 caracteres' };
    }
    return { valido: true };
}

function validarApellidos(apellidos) {
    if (!apellidos) {
        return { valido: false, mensaje: 'Los apellidos son requeridos' };
    }
    if (apellidos.length < 2) {
        return { valido: false, mensaje: 'Los apellidos deben tener al menos 2 caracteres' };
    }
    return { valido: true };
}

function validarUsuario(usuario) {
    if (!usuario) {
        return { valido: false, mensaje: 'El usuario es requerido' };
    }
    if (usuario.length < 3) {
        return { valido: false, mensaje: 'El usuario debe tener al menos 3 caracteres' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(usuario)) {
        return { valido: false, mensaje: 'El usuario solo puede contener letras, números y guiones bajos' };
    }
    return { valido: true };
}

function validarContrasena(contrasena) {
    if (!contrasena) {
        return { valido: false, mensaje: 'La contraseña es requerida' };
    }
    if (contrasena.length < 6) {
        return { valido: false, mensaje: 'La contraseña debe tener al menos 6 caracteres' };
    }
    return { valido: true };
}

function togglePasswordVisibility(inputId, buttonId) {
    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);
    
    if (input.type === 'password') {
        input.type = 'text';
        button.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        input.type = 'password';
        button.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registroForm = document.getElementById('registroForm');
    
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registroForm) registroForm.addEventListener('submit', handleRegistro);
    
    // Agregar validación en tiempo real para campos numéricos
    const regDocumento = document.getElementById('regDocumento');
    const regTelefono = document.getElementById('regTelefono');
    const regCiudad = document.getElementById('regCiudad');
    const regCiudadManual = document.getElementById('regCiudadManual');
    
    if (regDocumento) {
        regDocumento.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^\d]/g, '');
        });
    }
    
    if (regTelefono) {
        regTelefono.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^\d]/g, '');
        });
    }
    
    // Manejar cambio de ciudad
    if (regCiudad) {
        regCiudad.addEventListener('change', (e) => {
            if (e.target.value === 'OTRA') {
                regCiudadManual.style.display = 'block';
                regCiudadManual.required = true;
            } else {
                regCiudadManual.style.display = 'none';
                regCiudadManual.required = false;
                regCiudadManual.value = '';
            }
        });
    }
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
    
    // Obtener ciudad (de select o input manual)
    const ciudadSelect = document.getElementById('regCiudad').value;
    let ciudad = '';
    if (ciudadSelect === 'OTRA') {
        ciudad = document.getElementById('regCiudadManual').value.trim();
    } else {
        ciudad = ciudadSelect;
    }
    
    const usuario = document.getElementById('regUsuario').value.trim();
    const contrasena = document.getElementById('regContrasena').value.trim();
    
    // Validar todos los campos
    const validaciones = [
        validarNombres(nombres),
        validarApellidos(apellidos),
        validarDocumento(documento),
        validarTelefono(telefono),
        validarUsuario(usuario),
        validarContrasena(contrasena)
    ];
    
    // Validar que ciudad no esté vacía
    if (!ciudad) {
        mostrarMensaje('Por favor selecciona o digita una ciudad', 'danger');
        return;
    }
    
    if (!direccion) {
        mostrarMensaje('La dirección es requerida', 'danger');
        return;
    }
    
    // Verificar si hay errores de validación
    for (let validacion of validaciones) {
        if (!validacion.valido) {
            mostrarMensaje(validacion.mensaje, 'danger');
            return;
        }
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
