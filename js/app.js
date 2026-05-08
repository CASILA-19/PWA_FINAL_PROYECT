/**
 * app.js — Lógica principal: CRUD de mascotas + sincronización offline (PouchDB) ok
 */

const API_URL = 'http://localhost:3303/mascota';

let db;
let syncManager;
let mascotaEnEdicionId = null;

/* =============================================
   Utilidad: Toast de notificaciones
   ============================================= */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

/* =============================================
   SyncManager — sincronización con el servidor
   ============================================= */
class SyncManager {
    constructor(db) {
        this.db = db;
        this.syncing = false;
        this._setupListeners();
        setInterval(() => this.sync(), 30000);
    }

    _setupListeners() {
        window.addEventListener('online',  () => { this._updateStatus(); this.sync(); });
        window.addEventListener('offline', () => this._updateStatus());
        this._updateStatus();
    }

    _updateStatus() {
        const badge = document.getElementById('syncStatus');
        if (!badge) return;
        if (navigator.onLine) {
            badge.textContent = 'En línea';
            badge.className   = 'badge bg-success';
        } else {
            badge.textContent = 'Sin conexión';
            badge.className   = 'badge bg-secondary';
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
        btn.disabled   = syncing;
        btn.innerHTML  = syncing
            ? '<i class="fas fa-spinner fa-spin me-1"></i>Sincronizando...'
            : '<i class="fas fa-rotate me-1"></i>Sincronizar';
    }

    async syncUp() {
        const result  = await this.db.allDocs({ include_docs: true });
        const pending = result.rows.filter(r => r.doc.syncStatus && r.doc.syncStatus !== 'synced');

        for (const row of pending) {
            const doc = row.doc;
            try {
                if (doc.syncStatus === 'pending_create') {
                    const res = await fetch(API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nombre: doc.nombre, tipo: doc.tipo, edad: doc.edad })
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const created = await res.json();
                    await this.db.put({ ...doc, remoteId: created.id, syncStatus: 'synced' });

                } else if (doc.syncStatus === 'pending_update' && doc.remoteId) {
                    const res = await fetch(`${API_URL}/${doc.remoteId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nombre: doc.nombre, tipo: doc.tipo, edad: doc.edad })
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    await this.db.put({ ...doc, syncStatus: 'synced' });

                } else if (doc.syncStatus === 'pending_delete') {
                    if (doc.remoteId) {
                        const res = await fetch(`${API_URL}/${doc.remoteId}`, { method: 'DELETE' });
                        if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
                    }
                    await this.db.remove(doc);
                }
            } catch (err) {
                console.error(`Error al sincronizar doc ${doc._id}:`, err);
            }
        }
    }

    async syncDown() {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const remoteMascotas = await res.json();

        const localResult = await this.db.allDocs({ include_docs: true });
        const remoteIdMap = {};
        for (const row of localResult.rows) {
            if (row.doc.remoteId) remoteIdMap[row.doc.remoteId] = row.doc;
        }

        for (const remote of remoteMascotas) {
            const localDoc = remoteIdMap[remote.id];
            if (localDoc) {
                if (localDoc.syncStatus === 'synced') {
                    const needsUpdate =
                        localDoc.nombre !== remote.nombre ||
                        localDoc.tipo   !== remote.tipo   ||
                        localDoc.edad   !== remote.edad;
                    if (needsUpdate) {
                        await this.db.put({
                            ...localDoc,
                            nombre: remote.nombre,
                            tipo:   remote.tipo,
                            edad:   remote.edad
                        });
                    }
                }
            } else {
                await this.db.put({
                    _id:        `remote-${remote.id}`,
                    nombre:     remote.nombre,
                    tipo:       remote.tipo,
                    edad:       remote.edad,
                    remoteId:   remote.id,
                    syncStatus: 'synced'
                });
            }
        }

        const remoteIds = new Set(remoteMascotas.map(r => r.id));
        for (const row of localResult.rows) {
            const doc = row.doc;
            if (doc.remoteId && !remoteIds.has(doc.remoteId) && doc.syncStatus === 'synced') {
                await this.db.remove(doc);
            }
        }
    }
}

/* =============================================
   Inicialización
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
    db          = new PouchDB('mascotasDB');
    syncManager = new SyncManager(db);

    document.getElementById('mascotaForm').addEventListener('submit', manejarEnvioFormulario);
    document.getElementById('btnCancelarEdicion').addEventListener('click', cancelarEdicion);

    cargarMascotas();
});

/* =============================================
   Formulario
   ============================================= */
function manejarEnvioFormulario(event) {
    event.preventDefault();
    if (mascotaEnEdicionId) {
        actualizarMascota(mascotaEnEdicionId);
    } else {
        agregarMascota();
    }
}

function agregarMascota() {
    const nombre = document.getElementById('nombre').value.trim();
    const tipo   = document.getElementById('tipo').value;
    const edad   = parseInt(document.getElementById('edad').value, 10);

    if (!nombre || !tipo || Number.isNaN(edad)) return;

    const mascota = {
        _id:        new Date().toISOString(),
        nombre,
        tipo,
        edad,
        remoteId:   null,
        syncStatus: 'pending_create'
    };

    db.put(mascota)
        .then(() => {
            limpiarFormulario();
            cargarMascotas();
            showToast(`${nombre} agregado correctamente.`, 'success');
            if (navigator.onLine) syncManager.sync();
        })
        .catch(err => {
            console.error('Error al agregar mascota:', err);
            showToast('No se pudo agregar la mascota.', 'error');
        });
}

function actualizarMascota(id) {
    const nombre = document.getElementById('nombre').value.trim();
    const tipo   = document.getElementById('tipo').value;
    const edad   = parseInt(document.getElementById('edad').value, 10);

    if (!nombre || !tipo || Number.isNaN(edad)) return;

    db.get(id)
        .then(doc => {
            doc.nombre = nombre;
            doc.tipo   = tipo;
            doc.edad   = edad;
            if (doc.syncStatus !== 'pending_create') doc.syncStatus = 'pending_update';
            return db.put(doc);
        })
        .then(() => {
            cancelarEdicion();
            cargarMascotas();
            showToast(`${nombre} actualizado correctamente.`, 'success');
            if (navigator.onLine) syncManager.sync();
        })
        .catch(err => {
            console.error('Error al actualizar mascota:', err);
            showToast('No se pudo actualizar la mascota.', 'error');
        });
}

function eliminarMascota(id) {
    db.get(id)
        .then(doc => {
            const nombre = doc.nombre;
            const accion = !doc.remoteId
                ? db.remove(doc)
                : db.put({ ...doc, syncStatus: 'pending_delete' });

            return accion.then(() => nombre);
        })
        .then(nombre => {
            if (mascotaEnEdicionId === id) cancelarEdicion();
            cargarMascotas();
            showToast(`${nombre} eliminado.`, 'info');
            if (navigator.onLine) syncManager.sync();
        })
        .catch(err => {
            console.error('Error al eliminar mascota:', err);
            showToast('No se pudo eliminar la mascota.', 'error');
        });
}

function iniciarEdicion(id) {
    db.get(id)
        .then(doc => {
            document.getElementById('nombre').value = doc.nombre;
            document.getElementById('tipo').value   = doc.tipo;
            document.getElementById('edad').value   = doc.edad;

            mascotaEnEdicionId = id;
            document.getElementById('btnGuardar').innerHTML =
                '<i class="fas fa-floppy-disk me-1"></i>Guardar cambios';
            document.getElementById('btnCancelarEdicion').classList.remove('d-none');
            document.getElementById('mascotaForm').scrollIntoView({ behavior: 'smooth' });
        })
        .catch(err => {
            console.error('Error al iniciar edición:', err);
            showToast('No se pudo cargar la mascota para editar.', 'error');
        });
}

function cancelarEdicion() {
    mascotaEnEdicionId = null;
    document.getElementById('btnGuardar').innerHTML =
        '<i class="fas fa-plus me-1"></i>Agregar';
    document.getElementById('btnCancelarEdicion').classList.add('d-none');
    limpiarFormulario();
}

function limpiarFormulario() {
    document.getElementById('mascotaForm').reset();
}

/* =============================================
   Tabla de mascotas
   ============================================= */
function cargarMascotas() {
    const tbody = document.getElementById('mascotasTbody');
    tbody.innerHTML = '';

    db.allDocs({ include_docs: true })
        .then(result => {
            const mascotas = result.rows
                .map(r => r.doc)
                .filter(doc => doc.syncStatus !== 'pending_delete');

            if (mascotas.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" class="empty-state">
                            <i class="fas fa-paw"></i>
                            No hay mascotas registradas aún.
                        </td>
                    </tr>`;
                return;
            }

            mascotas.forEach(mascota => agregarFilaMascota(mascota, tbody));
        })
        .catch(err => {
            console.error('Error al cargar mascotas:', err);
            showToast('Error al cargar la lista de mascotas.', 'error');
        });
}

function agregarFilaMascota(mascota, tbody) {
    const fila = document.createElement('tr');
    fila.dataset.id = mascota._id;

    // Columna nombre con indicador de pendiente
    const tdNombre = document.createElement('td');
    tdNombre.textContent = mascota.nombre;
    if (mascota.syncStatus !== 'synced') {
        const badge = document.createElement('span');
        badge.className = 'badge bg-warning text-dark ms-2';
        badge.title     = 'Pendiente de sincronización';
        badge.textContent = '⏳ Pendiente';
        tdNombre.appendChild(badge);
    }

    // Columna tipo
    const tdTipo = document.createElement('td');
    tdTipo.textContent = mascota.tipo;

    // Columna edad
    const tdEdad = document.createElement('td');
    tdEdad.textContent = `${mascota.edad} año${mascota.edad !== 1 ? 's' : ''}`;

    // Columna acciones
    const tdAcciones = document.createElement('td');
    tdAcciones.className = 'text-center';

    const btnEditar = document.createElement('button');
    btnEditar.className = 'btn btn-warning btn-action me-1';
    btnEditar.innerHTML = '<i class="fas fa-pen"></i>';
    btnEditar.title     = 'Editar';
    btnEditar.addEventListener('click', () => iniciarEdicion(mascota._id));

    const btnEliminar = document.createElement('button');
    btnEliminar.className = 'btn btn-danger btn-action';
    btnEliminar.innerHTML = '<i class="fas fa-trash"></i>';
    btnEliminar.title     = 'Eliminar';
    btnEliminar.addEventListener('click', () => {
        if (confirm(`¿Eliminar a ${mascota.nombre}?`)) {
            eliminarMascota(mascota._id);
        }
    });

    tdAcciones.appendChild(btnEditar);
    tdAcciones.appendChild(btnEliminar);

    fila.appendChild(tdNombre);
    fila.appendChild(tdTipo);
    fila.appendChild(tdEdad);
    fila.appendChild(tdAcciones);
    tbody.appendChild(fila);
}
