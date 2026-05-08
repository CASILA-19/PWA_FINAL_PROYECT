if (!isAuthenticated() || getUser().rol !== 'ADMIN') {
    window.location.href = '../../index.html';
}

let usuarios = [];
let modalEditar;

document.addEventListener('DOMContentLoaded', () => {
    modalEditar = new bootstrap.Modal(document.getElementById('modalEditar'));
    cargarUsuarios();
    
    document.getElementById('formEditar').addEventListener('submit', guardarEdicion);
});

async function cargarUsuarios() {
    try {
        usuarios = await apiRequest('/api/usuarios');
        mostrarUsuarios();
    } catch (error) {
        document.getElementById('usuariosContainer').innerHTML = `
            <div class="alert alert-danger">Error: ${error.message}</div>
        `;
    }
}

function mostrarUsuarios() {
    const container = document.getElementById('usuariosContainer');
    
    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Usuario</th>
                        <th>Documento</th>
                        <th>Rol</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${usuarios.map(u => `
                        <tr>
                            <td>${u.nombres} ${u.apellidos}</td>
                            <td>${u.usuario}</td>
                            <td>${u.documento}</td>
                            <td><span class="badge bg-${u.rol === 'ADMIN' ? 'danger' : 'primary'}">${u.rol}</span></td>
                            <td>
                                <button class="btn btn-sm btn-warning" onclick='editarUsuario(${JSON.stringify(u)})'>
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick='eliminarUsuario("${u.id}")'>
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

function editarUsuario(usuario) {
    document.getElementById('editId').value = usuario.id;
    document.getElementById('editNombres').value = usuario.nombres;
    document.getElementById('editApellidos').value = usuario.apellidos;
    document.getElementById('editUsuario').value = usuario.usuario;
    document.getElementById('editDocumento').value = usuario.documento;
    document.getElementById('editRol').value = usuario.rol;
    
    modalEditar.show();
}

async function guardarEdicion(e) {
    e.preventDefault();
    
    try {
        const id = document.getElementById('editId').value;
        await apiRequest(`/api/usuarios/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                nombres: document.getElementById('editNombres').value,
                apellidos: document.getElementById('editApellidos').value,
                usuario: document.getElementById('editUsuario').value,
                documento: document.getElementById('editDocumento').value,
                rol: document.getElementById('editRol').value
            })
        });
        
        alert('Usuario actualizado exitosamente');
        modalEditar.hide();
        cargarUsuarios();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function eliminarUsuario(id) {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    
    try {
        await apiRequest(`/api/usuarios/${id}`, { method: 'DELETE' });
        alert('Usuario eliminado exitosamente');
        cargarUsuarios();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}
