if (!isAuthenticated()) {
    window.location.href = '../../pages/shared/login.html';
}

const user = getUser();
let censos = [];
let censoActual = null;
let modalDetalle;

document.addEventListener('DOMContentLoaded', () => {
    modalDetalle = new bootstrap.Modal(document.getElementById('modalDetalle'));
    
    if (user.rol === 'ADMIN') {
        document.getElementById('tituloPage').textContent = 'Todos los Censos';
    }
    
    cargarCensos();
});

async function cargarCensos() {
    try {
        censos = await apiRequest('/api/censos');
        document.getElementById('totalCensos').textContent = censos.length;
        mostrarCensos();
    } catch (error) {
        document.getElementById('censosContainer').innerHTML = `
            <div class="alert alert-danger">Error al cargar censos: ${error.message}</div>
        `;
    }
}

function mostrarCensos() {
    const container = document.getElementById('censosContainer');
    
    if (censos.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-inbox display-1 text-muted"></i>
                <p class="mt-3">No hay censos registrados</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Mascota</th>
                        <th>Dueño</th>
                        <th>Encuestador</th>
                        <th>Ubicación</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${censos.map(c => `
                        <tr>
                            <td>${new Date(c.fecha_creacion).toLocaleDateString()}</td>
                            <td>${c.nombre_mascota || 'N/A'}</td>
                            <td>${c.nombre_dueno || 'N/A'}</td>
                            <td>${c.nombre_encuestador || 'N/A'}</td>
                            <td><small>${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}</small></td>
                            <td>
                                <button class="btn btn-sm btn-info" onclick='verDetalle("${c.id}")'>
                                    <i class="bi bi-eye"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function verDetalle(id) {
    try {
        censoActual = await apiRequest(`/api/censos/${id}`);
        
        document.getElementById('modalBody').innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>Fotografía del Censo</h6>
                    <img src="${censoActual.fotografia}" class="img-fluid rounded mb-3">
                </div>
                <div class="col-md-6">
                    <h6>Información</h6>
                    <p><strong>Fecha:</strong> ${new Date(censoActual.fecha_creacion).toLocaleString()}</p>
                    <p><strong>Proyecto:</strong> ${censoActual.idProyecto}</p>
                    <p><strong>Ubicación:</strong><br>
                       Lat: ${censoActual.lat}<br>
                       Lon: ${censoActual.lon}</p>
                    <a href="https://www.google.com/maps?q=${censoActual.lat},${censoActual.lon}" target="_blank" class="btn btn-sm btn-primary">
                        <i class="bi bi-map"></i> Ver en Mapa
                    </a>
                </div>
            </div>
        `;
        
        // Solo admin puede eliminar cualquier censo
        if (user.rol !== 'ADMIN') {
            document.getElementById('btnEliminar').classList.add('d-none');
        } else {
            document.getElementById('btnEliminar').classList.remove('d-none');
        }
        
        modalDetalle.show();
    } catch (error) {
        alert('Error al cargar detalle: ' + error.message);
    }
}

async function eliminarCenso() {
    if (!confirm('¿Estás seguro de eliminar este censo?')) return;
    
    try {
        await apiRequest(`/api/censos/${censoActual.id}`, { method: 'DELETE' });
        alert('Censo eliminado exitosamente');
        modalDetalle.hide();
        cargarCensos();
    } catch (error) {
        alert('Error al eliminar: ' + error.message);
    }
}
