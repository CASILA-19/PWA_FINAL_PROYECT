// Verificar autenticación
if (!isAuthenticated()) {
    window.location.href = 'pages/shared/login.html';
}

const user = getUser();

// Mostrar información del usuario
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userInfo').textContent = `${user.nombre} ${user.Apellido} (${user.rol})`;
    document.getElementById('welcomeMessage').textContent = `Bienvenido, ${user.nombre}`;
    
    cargarOpciones();
    
    if (user.rol === 'ADMIN') {
        cargarEstadisticas();
    }
});

function cargarOpciones() {
    const mainOptions = document.getElementById('mainOptions');
    
    if (user.rol === 'ADMIN') {
        mainOptions.innerHTML = `
            <div class="col-md-4">
                <div class="card h-100 shadow-sm">
                    <div class="card-body text-center">
                        <i class="bi bi-clipboard-data display-1 text-primary"></i>
                        <h5 class="card-title mt-3">Ver Censos</h5>
                        <p class="card-text">Ver todos los censos realizados</p>
                        <a href="pages/shared/censos.html" class="btn btn-primary">Ir a Censos</a>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card h-100 shadow-sm">
                    <div class="card-body text-center">
                        <i class="bi bi-people display-1 text-success"></i>
                        <h5 class="card-title mt-3">Gestionar Usuarios</h5>
                        <p class="card-text">Administrar encuestadores y admins</p>
                        <a href="pages/admin/usuarios.html" class="btn btn-success">Gestionar</a>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card h-100 shadow-sm">
                    <div class="card-body text-center">
                        <i class="bi bi-database display-1 text-info"></i>
                        <h5 class="card-title mt-3">Gestionar Datos</h5>
                        <p class="card-text">Administrar dueños y mascotas</p>
                        <a href="pages/admin/gestion.html" class="btn btn-info">Gestionar</a>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('estadisticasSection').classList.remove('d-none');
    } else {
        mainOptions.innerHTML = `
            <div class="col-md-6">
                <div class="card h-100 shadow-sm">
                    <div class="card-body text-center">
                        <i class="bi bi-plus-circle display-1 text-success"></i>
                        <h5 class="card-title mt-3">Realizar Censo</h5>
                        <p class="card-text">Registrar un nuevo censo de mascota</p>
                        <a href="pages/encuestador/nuevo-censo.html" class="btn btn-success btn-lg">Nuevo Censo</a>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card h-100 shadow-sm">
                    <div class="card-body text-center">
                        <i class="bi bi-clipboard-data display-1 text-primary"></i>
                        <h5 class="card-title mt-3">Mis Censos</h5>
                        <p class="card-text">Ver los censos que he realizado</p>
                        <a href="pages/shared/censos.html" class="btn btn-primary btn-lg">Ver Mis Censos</a>
                    </div>
                </div>
            </div>
        `;
    }
}

async function cargarEstadisticas() {
    try {
        const stats = await apiRequest('/api/estadisticas');
        
        document.getElementById('totalCensos').textContent = stats.totalCensos;
        document.getElementById('totalMascotas').textContent = stats.totalMascotas;
        document.getElementById('totalDuenos').textContent = stats.totalDuenos;
        document.getElementById('totalEncuestadores').textContent = stats.totalEncuestadores;
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}
