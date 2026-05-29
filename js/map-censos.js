// map-censos.js - Visualización de todos los censos en el mapa

let mapa;
let db;
let syncManager;

// ═══════════════════════════════════════════════════════════
// SYNC MANAGER PARA MAPA
// ═══════════════════════════════════════════════════════════
class SyncManagerMapa {
    constructor(db) {
        this.db = db;
        this.syncing = false;
        this._setupListeners();
    }

    _setupListeners() {
        window.addEventListener('online', () => { this._updateStatus(); });
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
            await cargarCensos();
            showToast('Mapa actualizado', 'success');
        } catch (err) {
            console.error('Error de sincronización:', err);
            showToast('Error al actualizar el mapa', 'error');
        } finally {
            this.syncing = false;
            this._setSyncingUI(false);
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
}

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar base de datos
    db = new PouchDB('mascotasDB');
    syncManager = new SyncManagerMapa(db);

    // Mostrar usuario actual
    const usuario = localStorage.getItem('usuario');
    if (usuario) {
        const usuarioElement = document.getElementById('usuarioActual');
        if (usuarioElement) {
            usuarioElement.textContent = `👤 ${usuario}`;
        }
    }

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

    inicializarMapa();
    cargarCensos();
});

function inicializarMapa() {
    mapa = L.map('mapaCensos').setView([5.5353, -73.3678], 6); // Colombia centro
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(mapa);
}

async function cargarCensos() {
    try {
        const token = localStorage.getItem('jwt_token') || '';
        const response = await fetch(`${ENV.API_URL}/api/v1/censos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error al cargar censos');
        
        const censos = await response.json();
        renderizarMarcadores(censos);
        
    } catch (error) {
        console.error('Error:', error);
        showToast('No se pudieron cargar los censos del servidor', 'error');
    }
}

function renderizarMarcadores(censos) {
    // Limpiar marcadores existentes
    mapa.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            mapa.removeLayer(layer);
        }
    });

    censos.forEach(censo => {
        const icon = L.divIcon({
            className: '',
            html: `<svg width="32" height="32" viewBox="0 0 32 32">
                    <path d="M16 30s10-12.27 10-18A10 10 0 1 0 6 12c0 5.73 10 18 10 18z"
                          fill="${censo.color}" stroke="#fff" stroke-width="2"/>
                    <circle cx="16" cy="13" r="4" fill="#fff"/>
                   </svg>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });
        
        const marker = L.marker([censo.lat, censo.lon], { icon }).addTo(mapa);
        
        const popupContent = `
            <div class="info-window">
                <h6><i class="fas fa-paw"></i> ${censo.mascota.nombre}</h6>
                <p><strong>Tipo:</strong> ${censo.mascota.tipo}<br>
                   <strong>Edad:</strong> ${censo.mascota.edad} años</p>
                <hr>
                <h6><i class="fas fa-user"></i> ${censo.dueno.nombres} ${censo.dueno.apellidos}</h6>
                <p><strong>Teléfono:</strong> ${censo.dueno.telefono}</p>
                ${censo.fotografiaCenso ? `<img src="${censo.fotografiaCenso}" alt="Foto censo">` : ''}
            </div>
        `;
        
        marker.bindPopup(popupContent);
    });
}

// ═══════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
    return container;
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
