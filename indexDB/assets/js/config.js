// Configuración de la API
const API_URL = 'http://localhost:3303';

// Constantes del proyecto
const ID_PROYECTO = 'PROPWA_001';
const COLOR_PROYECTO = '#0062ff';

// Helper para obtener el token
const getToken = () => localStorage.getItem('token');

// Helper para obtener el usuario
const getUser = () => JSON.parse(localStorage.getItem('user') || '{}');

// Helper para verificar si está autenticado
const isAuthenticated = () => !!getToken();

// Helper para hacer peticiones a la API
const apiRequest = async (endpoint, options = {}) => {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error en la petición');
        }

        return data;
    } catch (error) {
        console.error('Error en API:', error);
        throw error;
    }
};

// Cerrar sesión
const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'pages/shared/login.html';
};
