/**
 * Lógica para el registro de dueños
 */

let db;

// Inicializar la base de datos al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    db = new PouchDB('mascotasDB');
    
    const formulario = document.getElementById('registroForm');
    formulario.addEventListener('submit', manejarRegistro);
});

/**
 * Maneja el envío del formulario de registro
 */
async function manejarRegistro(event) {
    event.preventDefault();
    
    const btnRegistrar = document.getElementById('btnRegistrar');
    btnRegistrar.disabled = true;
    btnRegistrar.textContent = 'Registrando...';
    
    try {
        // Obtener datos del formulario
        const formData = obtenerDatosFormulario();
        
        // Validar datos
        if (!validarDatos(formData)) {
            return;
        }
        
        // Verificar si el usuario ya existe
        const usuarioExiste = await verificarUsuarioExistente(formData.usuario, formData.documento);
        if (usuarioExiste) {
            mostrarError('El usuario o documento ya están registrados');
            return;
        }
        
        // Encriptar contraseña
        const contrasenaHash = await hashPassword(formData.contrasena);
        
        // Crear objeto persona
        const persona = {
            _id: generateUUID(),
            type: 'persona',
            syncStatus: 'pending_create',
            nombres: formData.nombres,
            apellidos: formData.apellidos,
            tipo_documento: formData.tipo_documento,
            documento: formData.documento,
            direccion: formData.direccion,
            telefono: formData.telefono,
            ciudad: formData.ciudad,
            usuario: formData.usuario,
            contrasena: contrasenaHash,
            fechaRegistro: new Date().toISOString()
        };
        
        // Guardar en PouchDB
        await db.put(persona);
        
        // Mostrar éxito y redirigir
        mostrarExito('Registro exitoso. Redirigiendo al login...');
        
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 2000);
        
    } catch (error) {
        console.error('Error en el registro:', error);
        mostrarError('Error al registrar. Intenta nuevamente.');
    } finally {
        btnRegistrar.disabled = false;
        btnRegistrar.textContent = 'Registrarse';
    }
}

/**
 * Obtiene los datos del formulario
 */
function obtenerDatosFormulario() {
    return {
        nombres: document.getElementById('nombres').value.trim(),
        apellidos: document.getElementById('apellidos').value.trim(),
        tipo_documento: document.getElementById('tipo_documento').value,
        documento: document.getElementById('documento').value.trim(),
        direccion: document.getElementById('direccion').value.trim(),
        telefono: document.getElementById('telefono').value.trim(),
        ciudad: document.getElementById('ciudad').value.trim(),
        usuario: document.getElementById('usuario').value.trim(),
        contrasena: document.getElementById('contrasena').value,
        confirmarContrasena: document.getElementById('confirmarContrasena').value
    };
}

/**
 * Valida los datos del formulario
 */
function validarDatos(data) {
    // Verificar campos requeridos
    const camposRequeridos = ['nombres', 'apellidos', 'tipo_documento', 'documento', 'direccion', 'telefono', 'ciudad', 'usuario', 'contrasena'];
    
    for (const campo of camposRequeridos) {
        if (!data[campo] || data[campo].length === 0) {
            mostrarError(`El campo ${campo.replace('_', ' ')} es requerido`);
            return false;
        }
    }
    
    // Validar usuario (mínimo 4 caracteres, solo letras y números)
    if (data.usuario.length < 4 || !/^[a-zA-Z0-9]+$/.test(data.usuario)) {
        mostrarError('El usuario debe tener mínimo 4 caracteres y solo contener letras y números');
        return false;
    }
    
    // Validar contraseña (mínimo 6 caracteres)
    if (data.contrasena.length < 6) {
        mostrarError('La contraseña debe tener mínimo 6 caracteres');
        return false;
    }
    
    // Verificar que las contraseñas coincidan
    if (data.contrasena !== data.confirmarContrasena) {
        mostrarError('Las contraseñas no coinciden');
        return false;
    }
    
    // Validar documento (solo números)
    if (!/^\d+$/.test(data.documento)) {
        mostrarError('El documento debe contener solo números');
        return false;
    }
    
    // Validar teléfono (solo números)
    if (!/^\d+$/.test(data.telefono)) {
        mostrarError('El teléfono debe contener solo números');
        return false;
    }
    
    return true;
}

/**
 * Verifica si un usuario o documento ya existe
 */
async function verificarUsuarioExistente(usuario, documento) {
    try {
        const result = await db.allDocs({ include_docs: true });
        
        return result.rows.some(row => {
            const doc = row.doc;
            return doc.type === 'persona' && 
                   (doc.usuario === usuario || doc.documento === documento);
        });
    } catch (error) {
        console.error('Error al verificar usuario:', error);
        return false;
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
    
    const formulario = document.getElementById('registroForm');
    formulario.insertBefore(alerta, formulario.firstChild);
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
    
    const formulario = document.getElementById('registroForm');
    formulario.insertBefore(alerta, formulario.firstChild);
}