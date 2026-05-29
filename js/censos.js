// ═══════════════════════════════════════════════════════════
// GESTIÓN DE CENSOS CON PAGINACIÓN Y FILTROS
// ═══════════════════════════════════════════════════════════

let db;
let syncManager;
let allCensos = [];
let filteredCensos = [];
let currentPage = 1;
let itemsPerPage = 10;

// ═══════════════════════════════════════════════════════════
// SYNC MANAGER PARA CENSOS
// ═══════════════════════════════════════════════════════════
class SyncManagerCensos {
    constructor(db) {
        this.db = db;
        this.syncing = false;
        this._setupListeners();
        setInterval(() => this.sync(), 30000);
    }

    _setupListeners() {
        window.addEventListener('online', () => { this._updateStatus(); this.sync(); });
        window.addEventListener('offline', () => this._updateStatus());
        this._updateStatus();
    }

    _updateStatus() {
        const badge = document.getElementById('syncStatus');
        if (!badge) return;
        if (navigator.onLine) {
            badge.textContent = 'En línea';
            badge.className = 'badge bg-success';
        } else {
            badge.textContent = 'Sin conexión';
            badge.className = 'badge bg-secondary';
        }
    }

    async sync() {
        if (this.syncing || !navigator.onLine) return;
        this.syncing = true;
        this._setSyncingUI(true);
        try {
            await this.syncUp();
            await this.syncDown();
            showToast('Sincronización completada', 'success');
        } catch (err) {
            console.error('Error de sincronización:', err);
            showToast('Error al sincronizar con el servidor.', 'error');
        } finally {
            this.syncing = false;
            this._setSyncingUI(false);
            // Recargar censos después de sincronizar
            await cargarCensos();
        }
    }

    _setSyncingUI(syncing) {
        const btn = document.getElementById('btnSync');
        if (!btn) return;
        btn.disabled = syncing;
        btn.innerHTML = syncing
            ? '<i class="fas fa-spinner fa-spin me-1"></i>Sincronizando...'
            : '<i class="fas fa-rotate me-1"></i>Sincronizar';
    }

    async syncUp() {
        const result = await this.db.allDocs({ include_docs: true });
        const pending = result.rows.filter(r => r.doc.syncStatus && r.doc.syncStatus !== 'synced');

        const token = localStorage.getItem('jwt_token') || '';
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        for (const row of pending) {
            const doc = row.doc;
            try {
                if (doc.syncStatus === 'pending_create') {
                    let personaId = doc.remotePersonaId || null;

                    if (!personaId) {
                        const personaData = {
                            nombres: doc.persona.nombres,
                            apellidos: doc.persona.apellidos,
                            tipoDocumento: doc.persona.tipoDocumento,
                            documento: doc.persona.documento,
                            direccion: doc.persona.direccion,
                            telefono: doc.persona.telefono,
                            ciudad: doc.persona.ciudad
                        };

                        const resPersona = await fetch(`${ENV.API_URL}/api/v1/personas`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(personaData)
                        });

                        if (resPersona.status === 409) {
                            const resLista = await fetch(`${ENV.API_URL}/api/v1/personas`, { headers });
                            if (!resLista.ok) throw new Error(`No se pudo obtener la lista de personas (${resLista.status})`);
                            const listaPersonas = await resLista.json();
                            const encontrada = listaPersonas.find(
                                p => String(p.documento) === String(personaData.documento)
                            );
                            if (encontrada?.id) {
                                personaId = encontrada.id;
                            } else {
                                throw new Error(`Persona con documento ${personaData.documento} no encontrada en la lista`);
                            }
                        } else if (resPersona.ok) {
                            const personaCreada = await resPersona.json();
                            personaId = personaCreada.id;
                        } else {
                            throw new Error(`HTTP Persona ${resPersona.status}`);
                        }

                        if (!personaId) throw new Error('No se pudo obtener el ID de la persona');

                        const docActual1 = await this.db.get(doc._id);
                        docActual1.remotePersonaId = personaId;
                        await this.db.put(docActual1);
                        doc._rev = docActual1._rev;
                        doc.remotePersonaId = personaId;
                    }

                    let mascotaId = doc.remoteMascotaId || null;
                    if (!mascotaId) {
                        const fotoLocal = doc.mascota.fotografia;
                        const fotografiaUrl =
                            fotoLocal?.startsWith('http')
                                ? fotoLocal
                                : `https://via.placeholder.com/150?text=${encodeURIComponent(doc.mascota.nombre)}`;
                        const mascotaData = {
                            nombre: doc.mascota.nombre,
                            tipo: doc.mascota.tipo,
                            genero: doc.mascota.genero,
                            edad: doc.mascota.edad,
                            fotografia: fotografiaUrl
                        };

                        const resMascota = await fetch(`${ENV.API_URL}/api/v1/mascotas`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(mascotaData)
                        });

                        if (!resMascota.ok) throw new Error(`HTTP Mascota ${resMascota.status}`);
                        const mascotaCreada = await resMascota.json();
                        mascotaId = mascotaCreada.id;

                        const docActual2 = await this.db.get(doc._id);
                        docActual2.remoteMascotaId = mascotaId;
                        await this.db.put(docActual2);
                        doc._rev = docActual2._rev;
                        doc.remoteMascotaId = mascotaId;
                    }

                    const resCenso = await fetch(`${ENV.API_URL}/api/v1/censos`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            idMascota: mascotaId,
                            idDueno: personaId,
                            fotografia: doc.censo.fotografia,
                            lat: doc.censo.lat,
                            lon: doc.censo.lon,
                            idProyecto: doc.idProyecto,
                            color: doc.color
                        })
                    });
                    if (!resCenso.ok) throw new Error(`HTTP Censo ${resCenso.status}`);
                    
                    const censoCreado = await resCenso.json();
                    const remoteCensoId = censoCreado.id;

                    // Eliminar el documento local temporal
                    await this.db.remove(doc);
                    
                    // Crear nuevo documento con el ID remoto del censo
                    await this.db.put({
                        _id: remoteCensoId,
                        syncStatus: 'synced',
                        idProyecto: doc.idProyecto,
                        color: doc.color,
                        remotePersonaId: personaId,
                        remoteMascotaId: mascotaId,
                        persona: doc.persona,
                        mascota: doc.mascota,
                        censo: doc.censo
                    });

                } else if (doc.syncStatus === 'pending_update') {
                    const remotePersonaId = doc.remotePersonaId;
                    const remoteMascotaId = doc.remoteMascotaId;

                    if (!remotePersonaId || !remoteMascotaId) {
                        console.warn(`Registro ${doc._id} marcado pending_update sin IDs remotos. Omitiendo.`);
                        continue;
                    }

                    const resUpdatePersona = await fetch(
                        `${ENV.API_URL}/api/v1/personas/${remotePersonaId}`,
                        {
                            method: 'PATCH',
                            headers,
                            body: JSON.stringify({
                                nombres: doc.persona.nombres,
                                apellidos: doc.persona.apellidos,
                                tipoDocumento: doc.persona.tipoDocumento,
                                documento: doc.persona.documento,
                                direccion: doc.persona.direccion,
                                telefono: doc.persona.telefono,
                                ciudad: doc.persona.ciudad
                            })
                        }
                    );
                    if (!resUpdatePersona.ok) throw new Error(`HTTP Update Persona ${resUpdatePersona.status}`);

                    const fotoUpdateLocal = doc.mascota.fotografia;
                    const fotoUpdateUrl =
                        (fotoUpdateLocal && (fotoUpdateLocal.startsWith('http://') || fotoUpdateLocal.startsWith('https://')))
                            ? fotoUpdateLocal
                            : `https://via.placeholder.com/150?text=${encodeURIComponent(doc.mascota.nombre || 'Mascota')}`;

                    const mascotaUpdateData = {
                        nombre: doc.mascota.nombre,
                        tipo: doc.mascota.tipo,
                        genero: doc.mascota.genero,
                        edad: doc.mascota.edad,
                        fotografia: fotoUpdateUrl
                    };

                    const resUpdateMascota = await fetch(
                        `${ENV.API_URL}/api/v1/mascotas/${remoteMascotaId}`,
                        {
                            method: 'PATCH',
                            headers,
                            body: JSON.stringify(mascotaUpdateData)
                        }
                    );
                    if (!resUpdateMascota.ok) throw new Error(`HTTP Update Mascota ${resUpdateMascota.status}`);

                    const resUpdateCenso = await fetch(
                        `${ENV.API_URL}/api/v1/censos/${doc._id}`,
                        {
                            method: 'PATCH',
                            headers,
                            body: JSON.stringify({
                                fotografia: doc.censo.fotografia,
                                lat: doc.censo.lat,
                                lon: doc.censo.lon
                            })
                        }
                    );
                    if (!resUpdateCenso.ok) throw new Error(`HTTP Update Censo ${resUpdateCenso.status}`);

                    const docActualizado = await this.db.get(doc._id);
                    docActualizado.syncStatus = 'synced';
                    await this.db.put(docActualizado);

                } else if (doc.syncStatus === 'pending_delete') {
                    await this.db.remove(doc);
                }
            } catch (err) {
                console.error(`Error al sincronizar censo ${doc._id}:`, err);
            }
        }
    }

    async syncDown() {
        try {
            const token = localStorage.getItem('jwt_token') || '';
            const response = await fetch(`${ENV.API_URL}/api/v1/censos`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Error al obtener censos');

            const censos = await response.json();

            for (const censo of censos) {
                try {
                    // Intentar obtener el documento existente
                    const existingDoc = await this.db.get(censo.id);
                    
                    // Actualizar el documento existente con los datos del servidor
                    // Preservar datos locales si los del servidor están incompletos
                    await this.db.put({
                        ...existingDoc,
                        _id: censo.id,
                        _rev: existingDoc._rev,
                        syncStatus: 'synced',
                        idProyecto: censo.idProyecto,
                        color: censo.color,
                        // Preservar datos de persona si existen localmente y son más completos
                        persona: (existingDoc.persona && existingDoc.persona.direccion) 
                            ? existingDoc.persona 
                            : censo.dueno,
                        mascota: censo.mascota,
                        censo: {
                            lat: censo.lat,
                            lon: censo.lon,
                            fotografia: censo.fotografiaCenso || existingDoc.censo?.fotografia
                        },
                        remotePersonaId: censo.idDueno,
                        remoteMascotaId: censo.idMascota
                    });
                } catch (err) {
                    if (err.status === 404) {
                        // Solo crear si no existe
                        await this.db.put({
                            _id: censo.id,
                            syncStatus: 'synced',
                            idProyecto: censo.idProyecto,
                            color: censo.color,
                            persona: censo.dueno,
                            mascota: censo.mascota,
                            censo: {
                                lat: censo.lat,
                                lon: censo.lon,
                                fotografia: censo.fotografiaCenso
                            },
                            remotePersonaId: censo.idDueno,
                            remoteMascotaId: censo.idMascota
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Error en syncDown:', err);
        }
    }
}

// ═══════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== Inicializando página de censos ===');
    
    // Crear instancia de base de datos
    db = new PouchDB('mascotasDB');
    
    // Crear SyncManager personalizado para censos
    syncManager = new SyncManagerCensos(db);

    // Mostrar usuario actual
    const usuario = localStorage.getItem('usuario');
    if (usuario) {
        const usuarioElement = document.getElementById('usuarioActual');
        if (usuarioElement) {
            usuarioElement.textContent = `👤 ${usuario}`;
        }
    }

    // Event listeners para búsqueda y filtros
    const searchInput = document.getElementById('searchInput');
    const filterTipo = document.getElementById('filterTipo');
    const filterEdad = document.getElementById('filterEdad');
    const itemsPerPageSelect = document.getElementById('itemsPerPage');

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            console.log('Búsqueda cambiada:', searchInput.value);
            aplicarFiltros();
        });
    }

    if (filterTipo) {
        filterTipo.addEventListener('change', () => {
            console.log('Filtro tipo cambiado:', filterTipo.value);
            aplicarFiltros();
        });
    }

    if (filterEdad) {
        filterEdad.addEventListener('change', () => {
            console.log('Filtro edad cambiado:', filterEdad.value);
            aplicarFiltros();
        });
    }

    if (itemsPerPageSelect) {
        itemsPerPageSelect.addEventListener('change', (e) => {
            itemsPerPage = parseInt(e.target.value);
            currentPage = 1;
            console.log('Items por página cambiado a:', itemsPerPage);
            aplicarFiltros();
        });
    }

    // Configurar botones de paginación
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', previousPage);
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', nextPage);
    }

    // Cargar censos
    cargarCensos();

    // Configurar botones de notificaciones
    const btnActivada = document.getElementById('btnActivarNotificaciones');
    const btnDesactivada = document.getElementById('btnDesactivarNotificaciones');

    if (btnDesactivada) {
        btnDesactivada.addEventListener('click', function () {
            if (!window.swReg) return;
            getPublicKey().then(key => {
                window.swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
                    .then(res => res.toJSON())
                    .then(subscription => {
                        fetch(`${ENV.API_URL}/notificaciones/subscribe`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(subscription)
                        })
                            .then(res => {
                                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                verificarSuscripcion(true);
                                showToast('Notificaciones activadas', 'success');
                            }).catch(() => showToast('Error en servidor', 'error'));
                    }).catch(() => showToast('Error de suscripción', 'error'));
            });
        });
    }

    if (btnActivada) {
        btnActivada.addEventListener('click', () => cancelarSuscripcion());
    }

    setTimeout(() => {
        if (window.swReg) {
            window.swReg.pushManager.getSubscription().then(sub => verificarSuscripcion(!!sub));
        }
    }, 100);

    console.log('=== Inicialización completada ===');
});

// ═══════════════════════════════════════════════════════════
// CARGAR CENSOS
// ═══════════════════════════════════════════════════════════
async function cargarCensos() {
    try {
        console.log('Cargando censos desde PouchDB...');
        const result = await db.allDocs({ include_docs: true });
        console.log('Documentos obtenidos:', result.rows.length);
        
        // Filtrar documentos válidos
        const censosValidos = result.rows
            .map(r => r.doc)
            .filter(doc => doc.persona && doc.mascota && doc.censo);
        
        console.log('Censos válidos antes de deduplicar:', censosValidos.length);
        
        // Eliminar duplicados basándose en datos únicos (documento del dueño + nombre de mascota + timestamp similar)
        const censosUnicos = new Map();
        
        for (const censo of censosValidos) {
            // Crear una clave única basada en datos del censo
            const documento = censo.persona?.documento || '';
            const nombreMascota = censo.mascota?.nombre || '';
            const tipo = censo.mascota?.tipo || '';
            const edad = censo.mascota?.edad || '';
            
            // Clave única para identificar duplicados
            const claveUnica = `${documento}-${nombreMascota}-${tipo}-${edad}`;
            
            // Si ya existe un censo con esta clave, mantener el que tenga syncStatus 'synced'
            // o el que tenga un ID más largo (los IDs del servidor son más largos)
            if (censosUnicos.has(claveUnica)) {
                const censoExistente = censosUnicos.get(claveUnica);
                
                // Priorizar el censo sincronizado o con ID del servidor (más largo)
                if (censo.syncStatus === 'synced' && censoExistente.syncStatus !== 'synced') {
                    censosUnicos.set(claveUnica, censo);
                } else if (censo._id.length > censoExistente._id.length) {
                    censosUnicos.set(claveUnica, censo);
                }
                // Si ambos están sincronizados, mantener el que tiene ID más largo (del servidor)
                else if (censo.syncStatus === 'synced' && censoExistente.syncStatus === 'synced') {
                    if (censo._id.length > censoExistente._id.length) {
                        censosUnicos.set(claveUnica, censo);
                    }
                }
            } else {
                censosUnicos.set(claveUnica, censo);
            }
        }
        
        allCensos = Array.from(censosUnicos.values())
            .sort((a, b) => {
                const fechaA = a.timestamp || 0;
                const fechaB = b.timestamp || 0;
                return fechaB - fechaA;
            });

        console.log('Censos únicos después de deduplicar:', allCensos.length);
        
        // Mostrar algunos datos de ejemplo para debug
        if (allCensos.length > 0) {
            console.log('Ejemplo de censo:', {
                id: allCensos[0]._id,
                dueño: allCensos[0].persona?.nombres,
                mascota: allCensos[0].mascota?.nombre,
                tipo: allCensos[0].mascota?.tipo,
                edad: allCensos[0].mascota?.edad,
                syncStatus: allCensos[0].syncStatus
            });
        }

        aplicarFiltros();
    } catch (err) {
        console.error('Error al cargar censos:', err);
        showToast('Error al cargar los censos', 'error');
    }
}

// ═══════════════════════════════════════════════════════════
// APLICAR FILTROS Y BÚSQUEDA
// ═══════════════════════════════════════════════════════════
function aplicarFiltros() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const filterTipo = document.getElementById('filterTipo').value.toUpperCase();
    const filterEdad = document.getElementById('filterEdad').value;

    console.log('Aplicando filtros:', { searchTerm, filterTipo, filterEdad });
    console.log('Total censos:', allCensos.length);

    filteredCensos = allCensos.filter(censo => {
        // Búsqueda por nombre de dueño o mascota
        const nombreDueno = ((censo.persona?.nombres || '') + ' ' + (censo.persona?.apellidos || '')).toLowerCase();
        const nombreMascota = (censo.mascota?.nombre || '').toLowerCase();
        const matchSearch = !searchTerm || nombreDueno.includes(searchTerm) || nombreMascota.includes(searchTerm);

        // Filtro por tipo/especie (convertir a mayúsculas para comparar)
        const tipoMascota = (censo.mascota?.tipo || '').toUpperCase();
        const matchTipo = !filterTipo || tipoMascota === filterTipo;

        // Filtro por edad
        let matchEdad = true;
        if (filterEdad) {
            const edad = parseFloat(censo.mascota?.edad) || 0;
            switch (filterEdad) {
                case '0-1':
                    matchEdad = edad >= 0 && edad <= 1;
                    break;
                case '1-3':
                    matchEdad = edad > 1 && edad <= 3;
                    break;
                case '3-5':
                    matchEdad = edad > 3 && edad <= 5;
                    break;
                case '5-10':
                    matchEdad = edad > 5 && edad <= 10;
                    break;
                case '10+':
                    matchEdad = edad > 10;
                    break;
            }
        }

        return matchSearch && matchTipo && matchEdad;
    });

    console.log('Censos filtrados:', filteredCensos.length);
    currentPage = 1;
    renderizarTabla();
}

// ═══════════════════════════════════════════════════════════
// RENDERIZAR TABLA CON PAGINACIÓN
// ═══════════════════════════════════════════════════════════
function renderizarTabla() {
    const tbody = document.getElementById('mascotasTbody');
    const emptyState = document.getElementById('emptyState');
    const table = document.querySelector('.table');
    const paginationNav = document.querySelector('nav[aria-label="Paginación"]');

    console.log('Renderizando tabla...');
    console.log('Censos filtrados:', filteredCensos.length);
    console.log('Items por página:', itemsPerPage);
    console.log('Página actual:', currentPage);

    // Calcular índices
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedCensos = filteredCensos.slice(startIndex, endIndex);

    console.log('Mostrando desde', startIndex, 'hasta', endIndex);
    console.log('Censos en esta página:', paginatedCensos.length);

    // Mostrar/ocultar tabla y estado vacío
    if (filteredCensos.length === 0) {
        table.style.display = 'none';
        emptyState.style.display = 'block';
        if (paginationNav) paginationNav.style.display = 'none';
    } else {
        table.style.display = 'table';
        emptyState.style.display = 'none';
        if (paginationNav) paginationNav.style.display = 'block';
    }

    // Limpiar tabla
    tbody.innerHTML = '';

    // Llenar tabla
    paginatedCensos.forEach(censo => {
        const row = document.createElement('tr');
        const nombreDueno = `${censo.persona?.nombres || ''} ${censo.persona?.apellidos || ''}`.trim() || 'N/A';
        const nombreMascota = censo.mascota?.nombre || 'N/A';
        const tipo = censo.mascota?.tipo || 'N/A';
        const edad = censo.mascota?.edad ? `${censo.mascota.edad} años` : 'N/A';
        const estado = censo.syncStatus === 'synced' ? 'Sincronizado' : 'Pendiente';
        const estadoClass = censo.syncStatus === 'synced' ? 'bg-success' : 'bg-warning';

        row.innerHTML = `
            <td>${nombreDueno}</td>
            <td>${nombreMascota}</td>
            <td>${tipo}</td>
            <td>${edad}</td>
            <td><span class="badge ${estadoClass}">${estado}</span></td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary" onclick="verDetalles('${censo._id}')" title="Ver detalles">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Actualizar información de paginación
    actualizarPaginacion();
}

// ═══════════════════════════════════════════════════════════
// ACTUALIZAR CONTROLES DE PAGINACIÓN
// ═══════════════════════════════════════════════════════════
function actualizarPaginacion() {
    const totalPages = Math.ceil(filteredCensos.length / itemsPerPage);
    const startIndex = filteredCensos.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const endIndex = Math.min(currentPage * itemsPerPage, filteredCensos.length);

    console.log('Actualizando paginación:', { totalPages, startIndex, endIndex, currentPage });

    // Actualizar información
    const paginationInfo = document.getElementById('paginationInfo');
    if (paginationInfo) {
        paginationInfo.textContent = `Mostrando ${startIndex} - ${endIndex} de ${filteredCensos.length}`;
    }

    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.textContent = `Página ${currentPage} de ${totalPages || 1}`;
    }

    // Habilitar/deshabilitar botones
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
        prevBtn.parentElement.classList.toggle('disabled', currentPage === 1);
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages || totalPages === 0;
        nextBtn.parentElement.classList.toggle('disabled', currentPage >= totalPages || totalPages === 0);
    }
}

// ═══════════════════════════════════════════════════════════
// NAVEGACIÓN DE PÁGINAS
// ═══════════════════════════════════════════════════════════
function nextPage() {
    const totalPages = Math.ceil(filteredCensos.length / itemsPerPage);
    console.log('nextPage llamado. Página actual:', currentPage, 'Total páginas:', totalPages);
    
    if (currentPage < totalPages) {
        currentPage++;
        console.log('Avanzando a página:', currentPage);
        renderizarTabla();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        console.log('Ya estás en la última página');
    }
}

function previousPage() {
    console.log('previousPage llamado. Página actual:', currentPage);
    
    if (currentPage > 1) {
        currentPage--;
        console.log('Retrocediendo a página:', currentPage);
        renderizarTabla();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        console.log('Ya estás en la primera página');
    }
}

// ═══════════════════════════════════════════════════════════
// VER DETALLES
// ═══════════════════════════════════════════════════════════
window.verDetalles = function(censoId) {
    const censo = allCensos.find(c => c._id === censoId);
    if (!censo) {
        showToast('Censo no encontrado', 'error');
        return;
    }
    
    // Crear modal con detalles
    const nombreDueno = `${censo.persona?.nombres || ''} ${censo.persona?.apellidos || ''}`.trim();
    const tipoDocumento = censo.persona?.tipoDocumento || 'N/A';
    const documento = censo.persona?.documento || 'N/A';
    const telefono = censo.persona?.telefono || 'N/A';
    const direccion = censo.persona?.direccion || 'N/A';
    const ciudad = censo.persona?.ciudad || 'N/A';
    
    const nombreMascota = censo.mascota?.nombre || 'N/A';
    const tipo = censo.mascota?.tipo || 'N/A';
    const genero = censo.mascota?.genero || 'N/A';
    const edad = censo.mascota?.edad || 'N/A';
    
    const fotoCenso = censo.censo?.fotografia || '';
    const lat = censo.censo?.lat || 'N/A';
    const lon = censo.censo?.lon || 'N/A';
    
    const modalHTML = `
        <div class="modal fade" id="detalleModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-paw me-2"></i>Detalles del Censo
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6 class="text-primary"><i class="fas fa-user me-2"></i>Datos del Dueño</h6>
                                <p><strong>Nombre:</strong> ${nombreDueno}</p>
                                <p><strong>Documento:</strong> ${tipoDocumento} ${documento}</p>
                                <p><strong>Teléfono:</strong> ${telefono}</p>
                                <p><strong>Dirección:</strong> ${direccion}</p>
                                <p><strong>Ciudad:</strong> ${ciudad}</p>
                            </div>
                            <div class="col-md-6">
                                <h6 class="text-primary"><i class="fas fa-paw me-2"></i>Datos de la Mascota</h6>
                                <p><strong>Nombre:</strong> ${nombreMascota}</p>
                                <p><strong>Tipo:</strong> ${tipo}</p>
                                <p><strong>Género:</strong> ${genero}</p>
                                <p><strong>Edad:</strong> ${edad} años</p>
                            </div>
                        </div>
                        <div class="row mt-3">
                            <div class="col-12">
                                <h6 class="text-primary"><i class="fas fa-camera me-2"></i>Foto del Censo</h6>
                                ${fotoCenso ? `<img src="${fotoCenso}" class="img-fluid rounded" alt="Foto del censo" style="max-height: 400px; object-fit: contain;">` : '<p class="text-muted">Sin foto</p>'}
                            </div>
                        </div>
                        <div class="row mt-3">
                            <div class="col-12">
                                <h6 class="text-primary"><i class="fas fa-map-marker-alt me-2"></i>Ubicación</h6>
                                <p><strong>Latitud:</strong> ${lat}</p>
                                <p><strong>Longitud:</strong> ${lon}</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Eliminar modal anterior si existe
    const oldModal = document.getElementById('detalleModal');
    if (oldModal) oldModal.remove();
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('detalleModal'));
    modal.show();
    
    // Limpiar modal al cerrar
    document.getElementById('detalleModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}

// ═══════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES (Copiadas de app.js)
// ═══════════════════════════════════════════════════════════

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

window.verificarSuscripcion = function(activadas) {
    const statusBadge = document.getElementById('notificationStatus');
    if (statusBadge) {
        if (activadas) {
            statusBadge.textContent = 'Activadas';
            statusBadge.className = 'badge bg-success';
            document.getElementById('btnDesactivarNotificaciones').style.display = 'inline-block';
            document.getElementById('btnActivarNotificaciones').style.display = 'none';
        } else {
            statusBadge.textContent = 'Desactivadas';
            statusBadge.className = 'badge bg-secondary';
            document.getElementById('btnDesactivarNotificaciones').style.display = 'none';
            document.getElementById('btnActivarNotificaciones').style.display = 'inline-block';
        }
    }
}

function cancelarSuscripcion() {
    if (!window.swReg) return;
    window.swReg.pushManager.getSubscription().then(subscription => {
        if (subscription) {
            return subscription.unsubscribe().then(() => {
                return fetch(`${ENV.API_URL}/notificaciones/unsubscribe`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(subscription)
                });
            }).then(() => {
                verificarSuscripcion(false);
                showToast('Notificaciones desactivadas', 'info');
            }).catch(() => showToast('Error al desactivar notificaciones', 'error'));
        } else {
            verificarSuscripcion(false);
        }
    });
}

function getPublicKey() {
    return fetch(`${ENV.API_URL}/notificaciones/key`)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
        })
        .then(key => urlBase64ToUint8Array(key));
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

window.logout = function() {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('usuario');
    window.location.href = 'login.html';
}
