/**
 * geo.js — Geolocalización y renderizado del mapa con Leaflet
 */

/* ── Imagen del perrito en base64 ── */
let _perritoBase64 = '';

async function cargarPerritoBase64() {
    try {
        const response = await fetch('img/perrito.jpg');
        const blob     = await response.blob();
        _perritoBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.warn('No se pudo cargar perrito.jpg como base64:', err);
    }
}

// Cargar al iniciar
cargarPerritoBase64();


function getGeoLocation() {
    if (!('geolocation' in navigator)) {
        showToast('La geolocalización no está soportada por este navegador.', 'error');
        return;
    }

    const btn = document.getElementById('geoBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Obteniendo ubicación...';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-location-crosshairs"></i> Obtener mi ubicación';
            mostrarMapa(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-location-crosshairs"></i> Obtener mi ubicación';
            showToast('No se pudo obtener la ubicación: ' + error.message, 'error');
        }
    );
}

function mostrarMapa(lat, lng) {
    if (window._mapa) {
        window._mapa.remove();
        window._mapa = null;
    }

    window._mapa = L.map('map').setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(window._mapa);

    const customIcon = L.divIcon({
        className: '',
        html: `
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 30s10-12.27 10-18A10 10 0 1 0 6 12c0 5.73 10 18 10 18z"
                      fill="#0062FF" stroke="#0062FF" stroke-width="2"/>
                <circle cx="16" cy="13" r="4" fill="#fff" stroke="#0062FF" stroke-width="2"/>
            </svg>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
    });

    L.marker([lat, lng], { icon: customIcon })
        .addTo(window._mapa)
        .bindPopup(`
            <div style="text-align:center; font-family: sans-serif;">
                <strong>¡Aquí estoy!</strong><br>
                ${_perritoBase64
                    ? `<img src="${_perritoBase64}" alt="Perrito" width="100"
                             style="border-radius:8px; margin-top:6px;">`
                    : ''}
            </div>`)
        .openPopup();

    showToast('Ubicación obtenida correctamente.', 'success');
}
