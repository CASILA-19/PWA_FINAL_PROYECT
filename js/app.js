let db;
let syncManager;
let mascotaEnEdicionId = null;
let swReg = null;
let btnActivada = null;
let btnDesactivada = null;

// ═══════════════════════════════════════════════════════════
// FUNCIONES DE VALIDACIÓN
// ═══════════════════════════════════════════════════════════
function soloNumeros(valor) {
    return /^\d+$/.test(valor);
}

function validarDocumento(documento) {
    if (!documento) {
        return { valido: false, mensaje: 'El documento es requerido' };
    }
    if (!soloNumeros(documento)) {
        return { valido: false, mensaje: 'El documento solo debe contener números' };
    }
    if (documento.length < 5 || documento.length > 15) {
        return { valido: false, mensaje: 'El documento debe tener entre 5 y 15 dígitos' };
    }
    return { valido: true };
}

function validarTelefono(telefono) {
    if (!telefono) {
        return { valido: false, mensaje: 'El teléfono es requerido' };
    }
    if (!soloNumeros(telefono)) {
        return { valido: false, mensaje: 'El teléfono solo debe contener números' };
    }
    if (telefono.length < 7 || telefono.length > 15) {
        return { valido: false, mensaje: 'El teléfono debe tener entre 7 y 15 dígitos' };
    }
    return { valido: true };
}

function validarEdad(edad) {
    if (!edad || edad <= 0) {
        return { valido: false, mensaje: 'La edad debe ser mayor a 0' };
    }
    if (edad > 100) {
        return { valido: false, mensaje: 'La edad no puede ser mayor a 100 años' };
    }
    return { valido: true };
}

function validarNombres(nombres) {
    if (!nombres) {
        return { valido: false, mensaje: 'Los nombres son requeridos' };
    }
    if (nombres.length < 2) {
        return { valido: false, mensaje: 'Los nombres deben tener al menos 2 caracteres' };
    }
    return { valido: true };
}

function validarApellidos(apellidos) {
    if (!apellidos) {
        return { valido: false, mensaje: 'Los apellidos son requeridos' };
    }
    if (apellidos.length < 2) {
        return { valido: false, mensaje: 'Los apellidos deben tener al menos 2 caracteres' };
    }
    return { valido: true };
}

function validarCiudad(ciudad) {
    if (!ciudad) {
        return { valido: false, mensaje: 'La ciudad es requerida' };
    }
    if (ciudad.length < 2) {
        return { valido: false, mensaje: 'La ciudad debe tener al menos 2 caracteres' };
    }
    return { valido: true };
}

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

                    // ── PASO 1: Registrar Persona ──────────────────
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
                            // La persona ya existe: la buscamos por documento
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

                        // Guardar el progreso parcial para no repetir este paso si falla después
                        const docActual1 = await this.db.get(doc._id);
                        docActual1.remotePersonaId = personaId;
                        await this.db.put(docActual1);
                        doc = await this.db.get(doc._id);
                    }

                    // ── PASO 2: Registrar Mascota ──────────────────────────────
                    // Si ya fue creada en un intento previo, reutilizamos el ID guardado.
                    let mascotaId = doc.remoteMascotaId || null;
                    if (!mascotaId) {
                        const fotoLocal = doc.mascota.fotografia;
                        const fotografiaUrl =
                            fotoLocal?.startsWith('http')
                                ? fotoLocal
                                : `https://via.placeholder.com/150?text=${encodeURIComponent(nombre)}`;
                        const mascotaData = {
                            nombre: doc.mascota.nombre,
                            tipo: doc.mascota.tipo,
                            genero: doc.mascota.genero,
                            edad: doc.mascota.edad,
                            fotografia: fotografiaUrl  // siempre URL — requerido por la API
                        };

                        const resMascota = await fetch(`${ENV.API_URL}/api/v1/mascotas`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(mascotaData)
                        });

                        if (!resMascota.ok) throw new Error(`HTTP Mascota ${resMascota.status}`);
                        const mascotaCreada = await resMascota.json();
                        mascotaId = mascotaCreada.id;

                        // Guardar el progreso parcial
                        const docActual2 = await this.db.get(doc._id);
                        docActual2.remoteMascotaId = mascotaId;
                        await this.db.put(docActual2);
                        doc = await this.db.get(doc._id);
                    }


                    // ── PASO 3: Registrar Censo ────────────────────────────────
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

                    const docFinal = await this.db.get(doc._id);
                    docFinal.syncStatus = 'synced';
                    await this.db.put(docFinal);

                } else if (doc.syncStatus === 'pending_update') {

                    const remotePersonaId = doc.remotePersonaId;
                    const remoteMascotaId = doc.remoteMascotaId;

                    if (!remotePersonaId || !remoteMascotaId) {
                        console.warn(`Registro ${doc._id} marcado pending_update sin IDs remotos. Omitiendo.`);
                        continue;
                    }

                    // ── Actualizar Persona ─────────────────────────────────────
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

                    // ── Actualizar Mascota ─────────────────────────────────────
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

                    // ── Actualizar Censo ───────────────────────────────────────
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

                    // Marcar como sincronizado
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

    // Agregar validación en tiempo real para campos numéricos
    const documento = document.getElementById('documento');
    const telefono = document.getElementById('telefono');
    const edad = document.getElementById('edad');
    const ciudad = document.getElementById('ciudad');
    const ciudadManual = document.getElementById('ciudadManual');

    if (documento) {
        documento.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^\d]/g, '');
        });
    }

    if (telefono) {
        telefono.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^\d]/g, '');
        });
    }

    if (edad) {
        edad.addEventListener('input', (e) => {
            // Permitir números y punto decimal
            e.target.value = e.target.value.replace(/[^\d.]/g, '');
            // Evitar múltiples puntos
            if ((e.target.value.match(/\./g) || []).length > 1) {
                e.target.value = e.target.value.replace(/\.+$/, '');
            }
        });
    }

    // Manejar cambio de ciudad
    if (ciudad) {
        ciudad.addEventListener('change', (e) => {
            if (e.target.value === 'OTRA') {
                ciudadManual.style.display = 'block';
                ciudadManual.required = true;
            } else {
                ciudadManual.style.display = 'none';
                ciudadManual.required = false;
                ciudadManual.value = '';
            }
        });
    }

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

    // Obtener ciudad (de select o input manual)
    const ciudadSelect = document.getElementById('ciudad')?.value || '';
    let ciudad = '';
    if (ciudadSelect === 'OTRA') {
        ciudad = document.getElementById('ciudadManual')?.value.trim() || '';
    } else {
        ciudad = ciudadSelect;
    }

    // ═══════════════════════════════════════════════════════════
    // DATOS DEL CENSO (Entidad: Censo) — se lee primero porque
    // la misma foto base64 se reutiliza para la mascota
    // ═══════════════════════════════════════════════════════════
    const imgElement = document.getElementById('foto');
    const fotoBase64 = imgElement && imgElement.src.startsWith('data:image') ? imgElement.src : null;

    // ═══════════════════════════════════════════════════════════
    // DATOS DE LA MASCOTA (Entidad: Mascota)
    // ═══════════════════════════════════════════════════════════
    const nombre = document.getElementById('nombre')?.value.trim() || '';
    const tipo = document.getElementById('tipo')?.value || '';
    const genero = document.getElementById('genero')?.value || '';
    const edad = parseFloat(document.getElementById('edad')?.value) || 0;
    const fotografia = fotoBase64 || '';
    const lat = window.latitudActual || null;
    const lon = window.longitudActual || null;

    // ═══════════════════════════════════════════════════════════
    // VALIDACIONES DEL DUEÑO
    // ═══════════════════════════════════════════════════════════
    const validacionesPersona = [
        validarNombres(nombres),
        validarApellidos(apellidos),
        validarDocumento(documento),
        validarTelefono(telefono),
        validarCiudad(ciudad)
    ];

    for (let validacion of validacionesPersona) {
        if (!validacion.valido) {
            showToast(validacion.mensaje, 'error');
            return;
        }
    }

    if (!tipoDocumento) {
        showToast('Por favor selecciona un tipo de documento', 'error');
        return;
    }

    if (!direccion) {
        showToast('La dirección es requerida', 'error');
        return;
    }

    // ═══════════════════════════════════════════════════════════
    // VALIDACIONES DE LA MASCOTA
    // ═══════════════════════════════════════════════════════════
    if (!nombre || nombre.length < 2) {
        showToast('El nombre de la mascota debe tener al menos 2 caracteres', 'error');
        return;
    }

    if (!tipo) {
        showToast('Por favor selecciona un tipo de mascota', 'error');
        return;
    }

    if (!genero) {
        showToast('Por favor selecciona un género', 'error');
        return;
    }

    const validacionEdad = validarEdad(edad);
    if (!validacionEdad.valido) {
        showToast(validacionEdad.mensaje, 'error');
        return;
    }

    // ═══════════════════════════════════════════════════════════
    // VALIDACIONES DEL CENSO
    // ═══════════════════════════════════════════════════════════
    if (!fotoBase64) {
        showToast('Por favor toma una foto del censo', 'error');
        return;
    }

    if (!lat || !lon) {
        showToast('Por favor obtén la ubicación GPS', 'error');
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
    // CONSTRUCCIÓN DEL REGISTRO COMPLETO
    // ═══════════════════════════════════════════════════════════
    const registroCompleto = {
        syncStatus: 'pending_create',
        idProyecto: ENV.ID_PROYECTO,
        color: ENV.COLOR,

        persona: {
            nombres,
            apellidos,
            tipoDocumento,
            documento,
            direccion,
            telefono,
            ciudad
        },

        mascota: {
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