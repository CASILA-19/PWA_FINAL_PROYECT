let db;
let syncManager;
let mascotaEnEdicionId = null;
let swReg = null;
let btnActivada = null;
let btnDesactivada = null;

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

class SyncManager {
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
        } catch (err) {
            console.error('Error de sincronización:', err);
            showToast('Error al sincronizar con el servidor.', 'error');
        } finally {
            this.syncing = false;
            this._setSyncingUI(false);
            cargarMascotas();
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
                    
                    // 1. Registrar Persona
                    const resPersona = await fetch(`${ENV.API_URL}/api/v1/personas`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(doc.persona)
                    });
                    if (!resPersona.ok) throw new Error(`HTTP Persona ${resPersona.status}`);

                    // 2. Registrar Mascota
                    const resMascota = await fetch(`${ENV.API_URL}/api/v1/mascotas`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(doc.mascota)
                    });
                    if (!resMascota.ok) throw new Error(`HTTP Mascota ${resMascota.status}`);

                    // 3. Registrar Censo
                    const resCenso = await fetch(`${ENV.API_URL}/api/v1/censos`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            id: doc._id,
                            idMascota: doc.mascota.id,
                            idDueno: doc.persona.id,
                            fotografia: doc.censo.fotografia,
                            lat: doc.censo.lat,
                            lon: doc.censo.lon,
                            idProyecto: doc.idProyecto,
                            color: doc.color
                        })
                    });
                    if (!resCenso.ok) throw new Error(`HTTP Censo ${resCenso.status}`);
                    await this.db.put({ ...doc, syncStatus: 'synced' });
                
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
                    await this.db.get(censo.id);
                } catch (err) {
                    if (err.status === 404) {
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
                            }
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Error en syncDown:', err);
        }
    }
}

function verificarSuscripcion(activadas) {
    const statusBadge = document.getElementById('notificationStatus');
    if (statusBadge) {
        if (activadas) {
            statusBadge.textContent = 'Activadas';
            statusBadge.className = 'badge bg-success';
            btnDesactivada.style.display = 'inline-block';
            btnActivada.style.display = 'none';
        } else {
            statusBadge.textContent = 'Desactivadas';
            statusBadge.className = 'badge bg-secondary';
            btnDesactivada.style.display = 'none';
            btnActivada.style.display = 'inline-block';
        }
    }
}

function enviarNotificacion() {
    const notificationOptions = {
        body: "¡Gracias por usar nuestra aplicación!",
        icon: "/img/logo.jpg",
    };
    new Notification("¡Notificación de GeoMapFoto!", notificationOptions);
}

function notificarme() {
    if (!("Notification" in window)) {
        alert("Tu navegador no soporta notificaciones.");
        return;
    }
    if (Notification.permission === "granted") {
        enviarNotificacion();
    } else if (Notification.permission !== "denied" || Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") enviarNotificacion();
        });
    }
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

function getPublicKey() {
    return fetch(`${ENV.API_URL}/notificaciones/key`)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
        })
        .then(key => urlBase64ToUint8Array(key));
}

function cancelarSuscripcion() {
    if (!swReg) return;
    swReg.pushManager.getSubscription().then(subscription => {
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

document.addEventListener('DOMContentLoaded', () => {
    db = new PouchDB('mascotasDB');
    syncManager = new SyncManager(db);

    // Mostrar usuario actual
    const usuario = localStorage.getItem('usuario');
    if (usuario) {
        document.getElementById('usuarioActual').textContent = `👤 ${usuario}`;
    }

    btnActivada = document.getElementById('btnActivarNotificaciones');
    btnDesactivada = document.getElementById('btnDesactivarNotificaciones');

    document.getElementById('mascotaForm').addEventListener('submit', manejarEnvioFormulario);
    document.getElementById('btnCancelarEdicion').addEventListener('click', cancelarEdicion);

    if (btnDesactivada) {
        btnDesactivada.addEventListener('click', function () {
            if (!swReg) return;
            getPublicKey().then(key => {
                swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
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
            swReg = window.swReg;
            swReg.pushManager.getSubscription().then(sub => verificarSuscripcion(!!sub));
        }
    }, 100);

    cargarMascotas();
    cargarPersonas();
});

function manejarEnvioFormulario(event) {
    event.preventDefault();
    if (mascotaEnEdicionId) {
        actualizarMascota(mascotaEnEdicionId);
    } else {
        agregarMascota();
    }
}

function agregarMascota() {
    // ═══════════════════════════════════════════════════════════
    // DATOS DEL DUEÑO (Entidad: Persona)
    // ═══════════════════════════════════════════════════════════
    const nombres = document.getElementById('nombres')?.value.trim() || '';
    const apellidos = document.getElementById('apellidos')?.value.trim() || '';
    const tipoDocumento = document.getElementById('tipoDocumento')?.value || '';
    const documento = document.getElementById('documento')?.value.trim() || '';
    const direccion = document.getElementById('direccion')?.value.trim() || '';
    const telefono = document.getElementById('telefono')?.value.trim() || '';
    const ciudad = document.getElementById('ciudad')?.value.trim() || '';
    const usuario = document.getElementById('usuario')?.value.trim() || '';
    const contrasena = document.getElementById('contrasena')?.value.trim() || '';

    // ═══════════════════════════════════════════════════════════
    // DATOS DE LA MASCOTA (Entidad: Mascota)
    // ═══════════════════════════════════════════════════════════
    const nombre = document.getElementById('nombre')?.value.trim() || '';
    const tipo = document.getElementById('tipo')?.value || '';
    const genero = document.getElementById('genero')?.value || '';
    const edad = parseFloat(document.getElementById('edad')?.value) || 0;
    const fotografia = document.getElementById('fotografia')?.value.trim() || '';

    // ═══════════════════════════════════════════════════════════
    // DATOS DEL CENSO (Entidad: Censo)
    // ═══════════════════════════════════════════════════════════
    const imgElement = document.getElementById('foto');
    const fotoBase64 = imgElement && imgElement.src.startsWith('data:image') ? imgElement.src : null;
    const lat = window.latitudActual || null;
    const lon = window.longitudActual || null;

    // ═══════════════════════════════════════════════════════════
    // VALIDACIONES
    // ═══════════════════════════════════════════════════════════
    if (!nombres || !apellidos || !tipoDocumento || !documento || !telefono || !direccion || !ciudad) {
        showToast('Por favor completa todos los datos del dueño.', 'error');
        return;
    }

    if (!nombre || !tipo || !genero || edad <= 0) {
        showToast('Por favor completa todos los datos de la mascota.', 'error');
        return;
    }

    if (!fotoBase64) {
        showToast('Por favor toma una foto del censo.', 'error');
        return;
    }

    if (!lat || !lon) {
        showToast('Por favor obtén la ubicación GPS.', 'error');
        return;
    }

    // ═══════════════════════════════════════════════════════════
    // VALIDACIÓN DE TAMAÑO DE FOTO (MAX 50KB)
    // ═══════════════════════════════════════════════════════════
    const fotoSizeKB = (fotoBase64.length * 3) / 4 / 1024;
    if (fotoSizeKB > 50) {
        showToast(`La foto es muy grande (${fotoSizeKB.toFixed(2)} KB). Máximo permitido: 50 KB.`, 'error');
        return;
    }

    // ═══════════════════════════════════════════════════════════
    // ENCRIPTAR CONTRASEÑA SI EXISTE
    // ═══════════════════════════════════════════════════════════
    let contrasenaHash = '';
    if (contrasena) {
        const salt = bcrypt.genSaltSync(10);
        contrasenaHash = bcrypt.hashSync(contrasena, salt);
    }

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCCIÓN DEL REGISTRO COMPLETO
    // ═══════════════════════════════════════════════════════════
    const registroCompleto = {
        _id: crypto.randomUUID(),
        syncStatus: 'pending_create',
        idProyecto: ENV.ID_PROYECTO,
        color: ENV.COLOR,
        
        persona: {
            id: crypto.randomUUID(),
            nombres,
            apellidos,
            tipoDocumento,
            documento,
            direccion,
            telefono,
            ciudad,
            usuario,
            contrasena: contrasenaHash
        },
        
        mascota: {
            id: crypto.randomUUID(),
            nombre,
            tipo,
            genero,
            edad,
            fotografia
        },
        
        censo: {
            lat,
            lon,
            fotografia: fotoBase64
        }
    };

    // ═══════════════════════════════════════════════════════════
    // GUARDAR EN POUCHDB
    // ═══════════════════════════════════════════════════════════
    db.put(registroCompleto)
        .then(() => {
            limpiarFormulario();
            cargarMascotas();
            showToast(`Censo de ${nombre} registrado correctamente (${fotoSizeKB.toFixed(2)} KB).`, 'success');
            if (navigator.onLine) syncManager.sync();
        })
        .catch(err => {
            console.error('Error al guardar localmente:', err);
            showToast('No se pudo guardar la información.', 'error');
        });
}

function actualizarMascota(id) {
    // Datos del Dueño
    const nombres = document.getElementById('nombres')?.value.trim() || '';
    const apellidos = document.getElementById('apellidos')?.value.trim() || '';
    const tipoDocumento = document.getElementById('tipoDocumento')?.value || '';
    const documento = document.getElementById('documento')?.value.trim() || '';
    const direccion = document.getElementById('direccion')?.value.trim() || '';
    const telefono = document.getElementById('telefono')?.value.trim() || '';
    const ciudad = document.getElementById('ciudad')?.value.trim() || '';
    const usuario = document.getElementById('usuario')?.value.trim() || '';
    const contrasena = document.getElementById('contrasena')?.value.trim() || '';

    // Datos de la Mascota
    const nombre = document.getElementById('nombre')?.value.trim() || '';
    const tipo = document.getElementById('tipo')?.value || '';
    const genero = document.getElementById('genero')?.value || '';
    const edad = parseFloat(document.getElementById('edad')?.value) || 0;
    const fotografia = document.getElementById('fotografia')?.value.trim() || '';

    if (!nombre || !nombres || !apellidos || !documento) {
        showToast('Por favor completa los campos obligatorios.', 'error');
        return;
    }

    db.get(id).then(doc => {
        // Actualizar Persona
        doc.persona.nombres = nombres;
        doc.persona.apellidos = apellidos;
        doc.persona.tipoDocumento = tipoDocumento;
        doc.persona.documento = documento;
        doc.persona.direccion = direccion;
        doc.persona.telefono = telefono;
        doc.persona.ciudad = ciudad;
        doc.persona.usuario = usuario;
        
        // Encriptar contraseña si se proporciona
        if (contrasena) {
            const salt = bcrypt.genSaltSync(10);
            doc.persona.contrasena = bcrypt.hashSync(contrasena, salt);
        }

        // Actualizar Mascota
        doc.mascota.nombre = nombre;
        doc.mascota.tipo = tipo;
        doc.mascota.genero = genero;
        doc.mascota.edad = edad;
        doc.mascota.fotografia = fotografia;

        if (doc.syncStatus !== 'pending_create') doc.syncStatus = 'pending_update';
        return db.put(doc);
    }).then(() => {
        cancelarEdicion();
        cargarMascotas();
        showToast('Registro actualizado correctamente.', 'success');
        if (navigator.onLine) syncManager.sync();
    }).catch(() => showToast('Error al actualizar.', 'error'));
}

function eliminarMascota(id) {
    db.get(id).then(doc => {
        return (!doc.remoteId) ? db.remove(doc) : db.put({ ...doc, syncStatus: 'pending_delete' });
    }).then(() => {
        if (mascotaEnEdicionId === id) cancelarEdicion();
        cargarMascotas();
        showToast('Registro eliminado.', 'info');
        if (navigator.onLine) syncManager.sync();
    }).catch(() => showToast('Error al eliminar.', 'error'));
}

function iniciarEdicion(id) {
    db.get(id).then(doc => {
        // Cargar datos del Dueño
        document.getElementById('nombres').value = doc.persona.nombres || '';
        document.getElementById('apellidos').value = doc.persona.apellidos || '';
        document.getElementById('tipoDocumento').value = doc.persona.tipoDocumento || '';
        document.getElementById('documento').value = doc.persona.documento || '';
        document.getElementById('direccion').value = doc.persona.direccion || '';
        document.getElementById('telefono').value = doc.persona.telefono || '';
        document.getElementById('ciudad').value = doc.persona.ciudad || '';
        document.getElementById('usuario').value = doc.persona.usuario || '';
        // No cargamos la contraseña por seguridad

        // Cargar datos de la Mascota
        document.getElementById('nombre').value = doc.mascota.nombre || '';
        document.getElementById('tipo').value = doc.mascota.tipo || '';
        document.getElementById('genero').value = doc.mascota.genero || '';
        document.getElementById('edad').value = doc.mascota.edad || '';
        document.getElementById('fotografia').value = doc.mascota.fotografia || '';

        mascotaEnEdicionId = id;
        document.getElementById('btnGuardar').innerHTML = '<i class="fas fa-floppy-disk me-1"></i>Guardar cambios';
        document.getElementById('btnCancelarEdicion').classList.remove('d-none');
        document.getElementById('mascotaForm').scrollIntoView({ behavior: 'smooth' });
    }).catch(() => showToast('Error al cargar edición.', 'error'));
}

function cancelarEdicion() {
    mascotaEnEdicionId = null;
    document.getElementById('btnGuardar').innerHTML = '<i class="fas fa-plus me-1"></i>Agregar';
    document.getElementById('btnCancelarEdicion').classList.add('d-none');
    limpiarFormulario();
}

function limpiarFormulario() {
    document.getElementById('mascotaForm').reset();
    const foto = document.getElementById('foto');
    if (foto) foto.style.display = 'none';
    window.latitudActual = null;
    window.longitudActual = null;
}

function cargarMascotas() {
    const tbody = document.getElementById('mascotasTbody');
    tbody.innerHTML = '';

    db.allDocs({ include_docs: true }).then(result => {
        const censos = result.rows.map(r => r.doc).filter(doc => doc.syncStatus !== 'pending_delete');

        if (censos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-clipboard-list"></i>
                        <p>No hay censos registrados aún.</p>
                        <small>Completa el formulario para registrar tu primer censo.</small>
                    </td>
                </tr>`;
            return;
        }
        censos.forEach(doc => agregarFilaMascota(doc, tbody));
    });
}

async function cargarPersonas() {
    try {
        const token = localStorage.getItem('jwt_token') || '';
        const response = await fetch(`${ENV.API_URL}/api/v1/personas`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error al cargar personas');
        
        const personas = await response.json();
        console.log('Personas cargadas (sin contraseñas):', personas);
        
    } catch (error) {
        console.error('Error al cargar personas:', error);
    }
}

function agregarFilaMascota(doc, tbody) {
    const fila = document.createElement('tr');
    
    // Columna: Dueño
    const tdDueno = document.createElement('td');
    tdDueno.innerHTML = `
        <strong>${doc.persona.nombres} ${doc.persona.apellidos}</strong><br>
        <small class="text-muted">${doc.persona.tipoDocumento}: ${doc.persona.documento}</small>
    `;

    // Columna: Mascota
    const tdNombre = document.createElement('td');
    tdNombre.innerHTML = `<strong>${doc.mascota.nombre}</strong>`;
    if (doc.syncStatus !== 'synced') {
        const badge = document.createElement('span');
        badge.className = 'badge bg-warning text-dark ms-2';
        badge.innerHTML = '<i class="fas fa-clock"></i> Pendiente';
        tdNombre.appendChild(badge);
    }

    // Columna: Tipo
    const tdTipo = document.createElement('td');
    const iconos = {
        'PERRO': '🐶',
        'GATO': '🐱',
        'PAJARO': '🐦',
        'CONEJO': '🐰',
        'HAMSTER': '🐹',
        'OTRO': '🐾'
    };
    tdTipo.textContent = `${iconos[doc.mascota.tipo] || '🐾'} ${doc.mascota.tipo}`;

    // Columna: Edad
    const tdEdad = document.createElement('td');
    tdEdad.textContent = `${doc.mascota.edad} años`;

    // Columna: Estado
    const tdEstado = document.createElement('td');
    if (doc.syncStatus === 'synced') {
        tdEstado.innerHTML = '<span class="badge bg-success"><i class="fas fa-check"></i> Sincronizado</span>';
    } else if (doc.syncStatus === 'pending_create') {
        tdEstado.innerHTML = '<span class="badge bg-warning text-dark"><i class="fas fa-clock"></i> Pendiente</span>';
    } else if (doc.syncStatus === 'pending_update') {
        tdEstado.innerHTML = '<span class="badge bg-info"><i class="fas fa-sync"></i> Actualización</span>';
    } else {
        tdEstado.innerHTML = '<span class="badge bg-secondary">Desconocido</span>';
    }

    // Columna: Acciones
    const tdAcciones = document.createElement('td');
    tdAcciones.className = 'text-center';
    tdAcciones.innerHTML = `
        <button class="btn btn-sm btn-warning btn-action me-1" onclick="iniciarEdicion('${doc._id}')" title="Editar">
            <i class="fas fa-pen"></i>
        </button>
        <button class="btn btn-sm btn-danger btn-action" onclick="if(confirm('¿Eliminar censo de ${doc.mascota.nombre}?')) eliminarMascota('${doc._id}')" title="Eliminar">
            <i class="fas fa-trash"></i>
        </button>
    `;

    fila.append(tdDueno, tdNombre, tdTipo, tdEdad, tdEstado, tdAcciones);
    tbody.appendChild(fila);
}