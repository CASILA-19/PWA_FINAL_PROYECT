

const API_URL = 'http://localhost:3303/mascota';

let db;
let syncManager;
let mascotaEnEdicionId = null;

class SyncManager {
    constructor(db) {
        this.db = db;
        this.syncing = false;
        this._setupListeners();
        setInterval(() => this.sync(), 30000);
    }

    _setupListeners() {
        window.addEventListener('online', () => {
            this._updateStatus();
            this.sync();
        });
        window.addEventListener('offline', () => this._updateStatus());
        this._updateStatus();
    }

    _updateStatus() {
        const badge = document.getElementById('syncStatus');
        if (!badge) return;
        if (navigator.onLine) {
            badge.textContent = 'En línea';
            badge.className = 'badge bg-success ms-2';
        } else {
            badge.textContent = 'Sin conexión';
            badge.className = 'badge bg-secondary ms-2';
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
        btn.textContent = syncing ? 'Sincronizando...' : 'Sincronizar';
    }

    async syncUp() {
        const result = await this.db.allDocs({ include_docs: true });
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
            if (row.doc.remoteId) {
                remoteIdMap[row.doc.remoteId] = row.doc;
            }
        }

        for (const remote of remoteMascotas) {
            const localDoc = remoteIdMap[remote.id];
            if (localDoc) {
                if (localDoc.syncStatus === 'synced') {
                    const needsUpdate = localDoc.nombre !== remote.nombre ||
                        localDoc.tipo !== remote.tipo ||
                        localDoc.edad !== remote.edad;
                    if (needsUpdate) {
                        await this.db.put({ ...localDoc, nombre: remote.nombre, tipo: remote.tipo, edad: remote.edad });
                    }
                }
            } else {
                await this.db.put({
                    _id: `remote-${remote.id}`,
                    nombre: remote.nombre,
                    tipo: remote.tipo,
                    edad: remote.edad,
                    remoteId: remote.id,
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

addEventListener('DOMContentLoaded', () => {
    const dbName = 'mascotasDB';
    db = new PouchDB(dbName);
    syncManager = new SyncManager(db);

    const formulario = document.getElementById('mascotaForm');
    const btnCancelar = document.getElementById('btnCancelarEdicion');

    formulario.addEventListener('submit', manejarEnvioFormulario);
    btnCancelar.addEventListener('click', cancelarEdicion);

    cargarMascotas();
});

function manejarEnvioFormulario(event) {
    event.preventDefault();

    if (mascotaEnEdicionId) {
        actualizarMascota(mascotaEnEdicionId);
        return;
    }

    agregarMascota();
}

function agregarMascota() {
    const nombre = document.getElementById('nombre').value.trim();
    const tipo = document.getElementById('tipo').value;
    const edad = parseInt(document.getElementById('edad').value, 10);

    if (!nombre || !tipo || Number.isNaN(edad)) {
        return;
    }

    const mascota = {
        _id: new Date().toISOString(),
        nombre,
        tipo,
        edad,
        remoteId: null,
        syncStatus: 'pending_create'
    };
    db.put(mascota).then(() => {
        limpiarFormulario();
        cargarMascotas();
        if (navigator.onLine) syncManager.sync();
    }).catch(err => {
        console.error('Error al agregar mascota:', err);
    });
}

function agregarAMascotaTabla(mascota) {
    const tabla = document.querySelector('table tbody');
    const fila = document.createElement('tr');
    fila.dataset.id = mascota._id;
    const pendingIcon = mascota.syncStatus !== 'synced'
        ? ' <span class="text-warning" title="Pendiente de sincronización">⏳</span>'
        : '';
    fila.innerHTML = `
        <td>${mascota.nombre}${pendingIcon}</td>
        <td>${mascota.tipo}</td>
        <td>${mascota.edad}</td>
        <td>
            <button class="btn btn-warning" onclick="iniciarEdicion('${mascota._id}')">Actualizar</button>
        </td>
        <td>
            <button class="btn btn-danger" onclick="eliminarMascota('${mascota._id}')">Eliminar</button>
        </td>
    `;
    tabla.appendChild(fila);
}

function eliminarMascota(id) {
    db.get(id).then(doc => {
        if (!doc.remoteId) {
            return db.remove(doc);
        }
        doc.syncStatus = 'pending_delete';
        return db.put(doc);
    }).then(() => {
        if (mascotaEnEdicionId === id) cancelarEdicion();
        cargarMascotas();
        if (navigator.onLine) syncManager.sync();
    }).catch(err => {
        console.error('Error al eliminar mascota:', err);
    });
}

function actualizarMascota(id) {
    const nuevoNombre = document.getElementById('nombre').value.trim();
    const nuevoTipo = document.getElementById('tipo').value;
    const nuevaEdad = parseInt(document.getElementById('edad').value, 10);

    if (!nuevoNombre || !nuevoTipo || Number.isNaN(nuevaEdad)) {
        return;
    }

    db.get(id).then(doc => {
        doc.nombre = nuevoNombre;
        doc.tipo = nuevoTipo;
        doc.edad = nuevaEdad;
        if (doc.syncStatus !== 'pending_create') {
            doc.syncStatus = 'pending_update';
        }
        return db.put(doc);
    }).then(() => {
        cancelarEdicion();
        cargarMascotas();
        if (navigator.onLine) syncManager.sync();
    }).catch(err => {
        console.error('Error al actualizar mascota:', err);
    });
}

function iniciarEdicion(id) {
    db.get(id).then(doc => {
        document.getElementById('nombre').value = doc.nombre;
        document.getElementById('tipo').value = doc.tipo;
        document.getElementById('edad').value = doc.edad;

        mascotaEnEdicionId = id;
        document.getElementById('btnGuardar').textContent = 'Guardar cambios';
        document.getElementById('btnCancelarEdicion').classList.remove('d-none');
    }).catch(err => {
        console.error('Error al iniciar edicion:', err);
    });
}

function cancelarEdicion() {
    mascotaEnEdicionId = null;
    document.getElementById('btnGuardar').textContent = 'Agregar';
    document.getElementById('btnCancelarEdicion').classList.add('d-none');
    limpiarFormulario();
}

function limpiarFormulario() {
    document.getElementById('mascotaForm').reset();
}

function cargarMascotas() {
    const tabla = document.querySelector('table tbody');
    tabla.innerHTML = '';

    db.allDocs({ include_docs: true }).then(result => {
        result.rows
            .filter(row => row.doc.syncStatus !== 'pending_delete')
            .forEach(row => agregarAMascotaTabla(row.doc));
    }).catch(err => {
        console.error('Error al cargar mascotas:', err);
    });
}


