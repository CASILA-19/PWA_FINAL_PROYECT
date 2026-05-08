if (!isAuthenticated() || getUser().rol !== 'ADMIN') {
    window.location.href = '../../index.html';
}

let duenos = [];
let mascotas = [];

document.addEventListener('DOMContentLoaded', () => {
    cargarDuenos();
    cargarMascotas();
});

async function cargarDuenos() {
    try {
        duenos = await apiRequest('/api/duenos');
        mostrarDuenos();
    } catch (error) {
        document.getElementById('duenosContainer').innerHTML = `
            <div class="alert alert-danger">Error: ${error.message}</div>
        `;
    }
}

function mostrarDuenos() {
    const container = document.getElementById('duenosContainer');
    
    if (duenos.length === 0) {
        container.innerHTML = '<p class="text-center">No hay dueños registrados</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Documento</th>
                        <th>Ciudad</th>
                        <th>Teléfono</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${duenos.map(d => `
                        <tr>
                            <td>${d.nombres} ${d.apellidos}</td>
                            <td>${d["tipo documento"]} ${d.documento}</td>
                            <td>${d.ciudad}</td>
                            <td>${d.teléfono}</td>
                            <td>
                                <button class="btn btn-sm btn-danger" onclick='eliminarDueno("${d.id}")'>
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function eliminarDueno(id) {
    if (!confirm('¿Eliminar este dueño?')) return;
    
    try {
        await apiRequest(`/api/duenos/${id}`, { method: 'DELETE' });
        alert('Dueño eliminado');
        cargarDuenos();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function cargarMascotas() {
    try {
        mascotas = await apiRequest('/api/mascotas');
        mostrarMascotas();
    } catch (error) {
        document.getElementById('mascotasContainer').innerHTML = `
            <div class="alert alert-danger">Error: ${error.message}</div>
        `;
    }
}

function mostrarMascotas() {
    const container = document.getElementById('mascotasContainer');
    
    if (mascotas.length === 0) {
        container.innerHTML = '<p class="text-center">No hay mascotas registradas</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Foto</th>
                        <th>Nombre</th>
                        <th>Género</th>
                        <th>Edad</th>
                        <th>Dueño</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${mascotas.map(m => `
                        <tr>
                            <td>
                                ${m.fotografia ? `<img src="${m.fotografia}" width="50" class="rounded">` : 'N/A'}
                            </td>
                            <td>${m.nombre}</td>
                            <td>${m.genero}</td>
                            <td>${m.edad}</td>
                            <td>${m.nombre_dueno || 'N/A'} ${m.apellido_dueno || ''}</td>
                            <td>
                                <button class="btn btn-sm btn-danger" onclick='eliminarMascota("${m.id}")'>
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function eliminarMascota(id) {
    if (!confirm('¿Eliminar esta mascota?')) return;
    
    try {
        await apiRequest(`/api/mascotas/${id}`, { method: 'DELETE' });
        alert('Mascota eliminada');
        cargarMascotas();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}
