// map-censos.js - Visualización de todos los censos en el mapa

let mapa;

document.addEventListener('DOMContentLoaded', () => {
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
        alert('No se pudieron cargar los censos del servidor.');
    }
}

function renderizarMarcadores(censos) {
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
