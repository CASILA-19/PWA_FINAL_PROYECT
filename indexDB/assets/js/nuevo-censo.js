if (!isAuthenticated()) {
    window.location.href = '../../pages/shared/login.html';
}

let duenoSeleccionado = null;

// Manejar cambio entre dueño existente y nuevo
document.querySelectorAll('input[name="tipoDueno"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'existente') {
            document.getElementById('buscarDuenoSection').classList.remove('d-none');
            document.getElementById('nuevoDuenoSection').classList.add('d-none');
            deshabilitarCamposDueno(true);
        } else {
            document.getElementById('buscarDuenoSection').classList.add('d-none');
            document.getElementById('nuevoDuenoSection').classList.remove('d-none');
            deshabilitarCamposDueno(false);
            duenoSeleccionado = null;
        }
    });
});

function deshabilitarCamposDueno(deshabilitar) {
    ['duenoNombres', 'duenoApellidos', 'duenoTipoDoc', 'duenoDocumento', 'duenoDireccion', 'duenoTelefono', 'duenoCiudad'].forEach(id => {
        document.getElementById(id).required = !deshabilitar;
    });
}

// Buscar dueños
let timeoutBusqueda;
document.getElementById('buscarDueno').addEventListener('input', (e) => {
    clearTimeout(timeoutBusqueda);
    const query = e.target.value.trim();
    
    if (query.length < 3) {
        document.getElementById('resultadosBusqueda').innerHTML = '';
        return;
    }
    
    timeoutBusqueda = setTimeout(async () => {
        try {
            const duenos = await apiRequest('/api/duenos');
            const filtrados = duenos.filter(d => 
                d.documento.includes(query) || 
                d.nombres.toLowerCase().includes(query.toLowerCase()) ||
                d.apellidos.toLowerCase().includes(query.toLowerCase())
            );
            
            mostrarResultadosBusqueda(filtrados);
        } catch (error) {
            console.error('Error al buscar dueños:', error);
        }
    }, 300);
});

function mostrarResultadosBusqueda(duenos) {
    const container = document.getElementById('resultadosBusqueda');
    
    if (duenos.length === 0) {
        container.innerHTML = '<div class="list-group-item">No se encontraron resultados</div>';
        return;
    }
    
    container.innerHTML = duenos.map(d => `
        <button type="button" class="list-group-item list-group-item-action" onclick='seleccionarDueno(${JSON.stringify(d)})'>
            <strong>${d.nombres} ${d.apellidos}</strong><br>
            <small>Doc: ${d.documento} - ${d.ciudad}</small>
        </button>
    `).join('');
}

function seleccionarDueno(dueno) {
    duenoSeleccionado = dueno;
    document.getElementById('buscarDueno').value = `${dueno.nombres} ${dueno.apellidos} (${dueno.documento})`;
    document.getElementById('resultadosBusqueda').innerHTML = '';
}

// Preview de imágenes y validación de tamaño
function setupImagePreview(inputId, previewId) {
    document.getElementById(inputId).addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const base64 = await fileToBase64(file);
            const sizeKB = (base64.length * 0.75) / 1024;
            
            if (sizeKB > 50) {
                alert(`La imagen es muy pesada (${sizeKB.toFixed(2)} KB). Máximo 50 KB.`);
                e.target.value = '';
                document.getElementById(previewId).classList.add('d-none');
                return;
            }
            
            document.getElementById(previewId).src = base64;
            document.getElementById(previewId).classList.remove('d-none');
        } catch (error) {
            console.error('Error al procesar imagen:', error);
        }
    });
}

setupImagePreview('mascotaFoto', 'previewMascota');
setupImagePreview('censoFoto', 'previewCenso');

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Obtener ubicación GPS
function obtenerUbicacion() {
    if (!navigator.geolocation) {
        alert('Tu navegador no soporta geolocalización');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            document.getElementById('lat').value = position.coords.latitude;
            document.getElementById('lon').value = position.coords.longitude;
        },
        (error) => {
            alert('Error al obtener ubicación: ' + error.message);
        }
    );
}

// Obtener ubicación automáticamente al cargar
document.addEventListener('DOMContentLoaded', obtenerUbicacion);

// Enviar formulario
document.getElementById('censoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btnGuardar = document.getElementById('btnGuardar');
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';
    
    try {
        let idDueno;
        
        // 1. Crear o usar dueño existente
        if (duenoSeleccionado) {
            idDueno = duenoSeleccionado.id;
        } else {
            const dueno = await apiRequest('/api/duenos', {
                method: 'POST',
                body: JSON.stringify({
                    nombres: document.getElementById('duenoNombres').value.trim(),
                    apellidos: document.getElementById('duenoApellidos').value.trim(),
                    tipo_documento: document.getElementById('duenoTipoDoc').value,
                    documento: document.getElementById('duenoDocumento').value.trim(),
                    dirección: document.getElementById('duenoDireccion').value.trim(),
                    teléfono: document.getElementById('duenoTelefono').value.trim(),
                    ciudad: document.getElementById('duenoCiudad').value.trim()
                })
            });
            idDueno = dueno.id;
        }
        
        // 2. Crear mascota
        const mascotaFoto = await fileToBase64(document.getElementById('mascotaFoto').files[0]);
        const mascota = await apiRequest('/api/mascotas', {
            method: 'POST',
            body: JSON.stringify({
                nombre: document.getElementById('mascotaNombre').value.trim(),
                genero: document.getElementById('mascotaGenero').value,
                edad: parseInt(document.getElementById('mascotaEdad').value) || 0,
                idDueno: idDueno,
                fotografia: mascotaFoto
            })
        });
        
        // 3. Crear censo
        const censoFoto = await fileToBase64(document.getElementById('censoFoto').files[0]);
        await apiRequest('/api/censos', {
            method: 'POST',
            body: JSON.stringify({
                idMascota: mascota.id,
                idDueno: idDueno,
                fotografia: censoFoto,
                lat: parseFloat(document.getElementById('lat').value),
                lon: parseFloat(document.getElementById('lon').value),
                idProyecto: ID_PROYECTO,
                color: COLOR_PROYECTO
            })
        });
        
        alert('Censo guardado exitosamente');
        window.location.href = '../../index.html';
        
    } catch (error) {
        alert('Error al guardar: ' + error.message);
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = '<i class="bi bi-save"></i> Guardar Censo';
    }
});
