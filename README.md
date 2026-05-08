# 🐾 Sistema de Mascotas PWA

Sistema de gestión de censos de mascotas con Progressive Web App (PWA) y API REST.

## 📋 Descripción

Aplicación web progresiva para realizar censos de mascotas, permitiendo a encuestadores registrar información de dueños, mascotas y ubicaciones GPS, mientras que los administradores pueden gestionar usuarios y visualizar estadísticas globales.

## ✨ Características

### Para Encuestadores
- 📝 Registrar censos con información completa (dueño + mascota + ubicación)
- 📸 Captura de fotografías con validación de tamaño (máx. 50KB)
- 📍 Geolocalización GPS automática
- 👁️ Ver solo sus propios censos
- 🔍 Buscar dueños existentes o registrar nuevos

### Para Administradores
- 👥 Gestión completa de usuarios (crear, editar, eliminar)
- 📊 Estadísticas globales del proyecto
- 🗂️ Gestión de dueños y mascotas
- 👀 Visualización de todos los censos
- 📈 Dashboard con métricas en tiempo real

### Características Técnicas
- 🔐 Autenticación con JWT
- 🌐 PWA con funcionalidad offline
- 🐳 Dockerizado para fácil despliegue
- 📱 Diseño responsive con Bootstrap 5
- 🗄️ Base de datos PostgreSQL

## 🚀 Inicio Rápido

### Prerrequisitos

- Docker y Docker Compose
- Node.js 18+ (para desarrollo local)
- PostgreSQL 16 (si no usas Docker)

### Instalación con Docker (Recomendado)

1. Clonar el repositorio:
```bash
git clone <url-del-repo>
cd PWA_FINAL_PROYECT
```

2. Configurar variables de entorno (ya está configurado en `.env`)

3. Levantar los servicios:
```bash
docker-compose -f docker-compose.prod.yml up --build
```

4. Acceder a la aplicación:
- Frontend: Abrir `indexDB/index.html` en un navegador
- Backend API: `http://localhost:3303`
- PostgreSQL: `localhost:5432`

### Instalación Local (Desarrollo)

**Backend:**
```bash
cd backend
npm install
npm start
```

**Frontend:**
Servir la carpeta `indexDB/` con cualquier servidor HTTP (ej: Live Server de VS Code)

## 📁 Estructura del Proyecto

```
proyecto/
├── backend/              # API REST (Node.js + Express)
│   ├── server.js        # Servidor principal
│   ├── package.json     # Dependencias
│   └── Dockerfile       # Imagen Docker
│
├── indexDB/             # Frontend PWA
│   ├── assets/          # Recursos estáticos
│   │   ├── img/        # Imágenes
│   │   └── js/         # Scripts JavaScript
│   ├── pages/          # Páginas HTML
│   │   ├── admin/      # Páginas de administrador
│   │   ├── encuestador/# Páginas de encuestador
│   │   └── shared/     # Páginas compartidas
│   ├── index.html      # Dashboard principal
│   └── manifest.json   # Configuración PWA
│
├── .env                 # Variables de entorno
└── docker-compose.prod.yml # Configuración Docker
```

Ver [ESTRUCTURA.md](./ESTRUCTURA.md) para documentación detallada.

## 🔐 Usuarios por Defecto

Después de la instalación, registra tu primer usuario admin desde la interfaz de registro.

## 📚 Documentación

- [Estructura del Proyecto](./ESTRUCTURA.md) - Documentación detallada de la arquitectura
- [API Endpoints](#api-endpoints) - Documentación de la API REST

## 🛠️ Tecnologías

### Backend
- Node.js 18
- Express 4.18
- PostgreSQL 16
- JWT para autenticación
- bcryptjs para hash de contraseñas
- Docker

### Frontend
- HTML5, CSS3, JavaScript (Vanilla)
- Bootstrap 5.3
- PWA (Service Worker, Manifest)
- Geolocation API
- File API para captura de imágenes

## 📡 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión

### Dueños
- `GET /api/duenos` - Listar dueños
- `POST /api/duenos` - Crear dueño
- `PUT /api/duenos/:id` - Actualizar dueño
- `DELETE /api/duenos/:id` - Eliminar dueño

### Mascotas
- `GET /api/mascotas` - Listar mascotas
- `POST /api/mascotas` - Crear mascota
- `PUT /api/mascotas/:id` - Actualizar mascota
- `DELETE /api/mascotas/:id` - Eliminar mascota

### Censos
- `GET /api/censos` - Listar censos (filtrado por rol)
- `POST /api/censos` - Crear censo
- `GET /api/censos/:id` - Obtener censo
- `DELETE /api/censos/:id` - Eliminar censo

### Usuarios (Solo ADMIN)
- `GET /api/usuarios` - Listar usuarios
- `PUT /api/usuarios/:id` - Actualizar usuario
- `DELETE /api/usuarios/:id` - Eliminar usuario

### Estadísticas (Solo ADMIN)
- `GET /api/estadisticas` - Obtener estadísticas globales

## 🔧 Configuración

### Variables de Entorno (`.env`)

```env
MASCOTAS_PORT=3303
MASCOTAS_POSTGRES_HOST=localhost
MASCOTAS_POSTGRES_USER=root
MASCOTAS_POSTGRES_PASSWORD=1q2w3e4r5,
MASCOTAS_POSTGRES_DB=mascotasdb
MASCOTAS_POSTGRES_PORT=5432
JWT_SECRET=mi_secreto_super_seguro_2024_cambiar_en_produccion
```

### Configuración del Frontend (`indexDB/assets/js/config.js`)

```javascript
const API_URL = 'http://localhost:3303';
const ID_PROYECTO = 'PROPWA_001';
const COLOR_PROYECTO = '#0062ff';
```

## 🐛 Troubleshooting

### Error de conexión a PostgreSQL
```bash
# Verificar que PostgreSQL esté corriendo
docker-compose -f docker-compose.prod.yml ps

# Ver logs
docker-compose -f docker-compose.prod.yml logs postgres
```

### Puerto 3303 en uso
```bash
# Ver qué proceso usa el puerto
netstat -ano | findstr :3303

# Cambiar el puerto en .env
MASCOTAS_PORT=3304
```

### Imágenes muy pesadas
Las imágenes deben ser menores a 50KB. Usa herramientas de compresión antes de subirlas.

## 📝 Comandos Útiles

```bash
# Levantar servicios
docker-compose -f docker-compose.prod.yml up -d

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f

# Detener servicios
docker-compose -f docker-compose.prod.yml down

# Reconstruir servicios
docker-compose -f docker-compose.prod.yml up --build

# Acceder a PostgreSQL
docker-compose -f docker-compose.prod.yml exec postgres psql -U root -d mascotasdb
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request



- Bootstrap por el framework CSS
- PostgreSQL por la base de datos
- Express.js por el framework backend
