# 🏪 AlquimiaTechnologic Store

Sistema completo de tienda web especializada en software, aceites esenciales, figuras en yeso y suscripciones premium.

## 🚀 Características

### ✨ **Funcionalidades Principales**
- **Panel de Administración Completo** - Gestión de productos, categorías, pedidos y usuarios
- **Tienda Pública Moderna** - Diseño responsive con animaciones y UX optimizada
- **Sistema de Autenticación Seguro** - JWT con roles y permisos
- **Gestión de Productos Avanzada** - CRUD completo con imágenes múltiples
- **Sistema de Categorías** - Organización jerárquica de productos
- **Carrito de Compras** - Funcionalidad completa de e-commerce
- **Sistema de Pedidos** - Seguimiento y gestión de estados
- **Búsqueda Inteligente** - Filtros avanzados y búsqueda en tiempo real
- **Dashboard con Estadísticas** - Métricas en tiempo real
- **Sistema de Logs** - Registro completo de actividades
- **API REST Completa** - Endpoints para integración externa

### 🛡️ **Seguridad**
- **Autenticación JWT** - Tokens seguros con expiración
- **Rate Limiting** - Protección contra ataques de fuerza bruta
- **Validación de Datos** - Sanitización y validación completa
- **Helmet Security** - Headers de seguridad HTTP
- **CORS Configurado** - Control de acceso cross-origin
- **SQL Injection Protection** - Consultas parametrizadas
- **XSS Protection** - Sanitización de entrada de datos

### 📱 **Responsive Design**
- **Mobile First** - Optimizado para dispositivos móviles
- **Progressive Web App** - Funcionalidades PWA
- **Accesibilidad** - Cumple estándares WCAG
- **Performance** - Lazy loading y optimización de imágenes

## 🛠️ Tecnologías Utilizadas

### **Backend**
- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **MySQL** - Base de datos relacional
- **JWT** - Autenticación stateless
- **Multer** - Manejo de archivos
- **Bcrypt** - Encriptación de contraseñas

### **Frontend**
- **HTML5** - Estructura semántica
- **CSS3** - Estilos modernos con animaciones
- **JavaScript ES6+** - Funcionalidad interactiva
- **Responsive Design** - Adaptable a todos los dispositivos

### **Herramientas de Desarrollo**
- **Nodemon** - Auto-reload en desarrollo
- **ESLint** - Linting de código
- **Prettier** - Formateo de código
- **Jest** - Testing framework

## 📋 Requisitos Previos

### **Software Necesario**
- **Node.js** (v16.0.0 o superior)
- **MySQL** (v8.0 o superior)
- **XAMPP/WAMP** (para desarrollo local)
- **Git** (para control de versiones)

### **Requisitos del Sistema**
- **RAM**: Mínimo 2GB, Recomendado 4GB
- **Almacenamiento**: 1GB de espacio libre
- **Procesador**: Cualquier CPU moderna

## 🚀 Instalación

### **1. Clonar el Repositorio**
```bash
git clone https://github.com/alquimiatechnologic/store.git
cd store
```

### **2. Instalar Dependencias**
```bash
npm install
```

### **3. Configurar Base de Datos**

#### **Opción A: Usando phpMyAdmin (Recomendado para desarrollo)**
1. Abrir XAMPP Control Panel
2. Iniciar Apache y MySQL
3. Abrir phpMyAdmin (http://localhost/phpmyadmin)
4. Crear nueva base de datos: `alquimia_technologic_store`
5. Importar el archivo `database/schema.sql`

#### **Opción B: Usando línea de comandos**
```bash
mysql -u root -p
CREATE DATABASE alquimia_technologic_store;
USE alquimia_technologic_store;
SOURCE database/schema.sql;
```

### **4. Configurar Variables de Entorno**
```bash
# Copiar archivo de configuración
cp config.env.example config.env

# Editar configuración
nano config.env
```

#### **Configuración Mínima Requerida:**
```env
# Base de Datos
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=alquimia_technologic_store
DB_PORT=3306

# Seguridad
JWT_SECRET=tu_super_secret_key_aqui
JWT_EXPIRES_IN=24h

# Servidor
PORT=3000
NODE_ENV=development
```

### **5. Crear Directorios Necesarios**
```bash
mkdir -p uploads/products uploads/categories uploads/admin logs
```

### **6. Iniciar el Servidor**
```bash
# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start
```

## 🌐 Acceso al Sistema

### **URLs Principales**
- **Tienda Pública**: http://localhost:3000
- **Panel Admin**: http://localhost:3000/admin
- **API REST**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health

### **Credenciales por Defecto**
- **Usuario**: admin
- **Contraseña**: password
- **Email**: admin@alquimiatechnologic.com

## 📚 Documentación de la API

### **Autenticación**
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

### **Productos**
```http
GET /api/products
GET /api/products/:id
POST /api/products
PUT /api/products/:id
DELETE /api/products/:id
```

### **Categorías**
```http
GET /api/categories
POST /api/categories
PUT /api/categories/:id
DELETE /api/categories/:id
```

### **Pedidos**
```http
GET /api/orders
GET /api/orders/:id
PUT /api/orders/:id/status
```

## 🗂️ Estructura del Proyecto

```
webtiendanode/
├── config/                 # Configuración
│   ├── database.js        # Configuración de BD
│   └── config.env         # Variables de entorno
├── database/              # Base de datos
│   └── schema.sql         # Esquema de BD
├── middleware/            # Middleware personalizado
│   └── auth.js           # Autenticación y autorización
├── routes/               # Rutas de la aplicación
│   ├── auth.js          # Rutas de autenticación
│   ├── admin.js         # Rutas del panel admin
│   ├── api.js           # API REST
│   └── public.js        # Rutas públicas
├── public/              # Archivos estáticos
│   ├── admin/           # Panel de administración
│   │   ├── login.html
│   │   └── dashboard.html
│   ├── css/             # Estilos
│   ├── js/              # JavaScript
│   └── images/          # Imágenes
├── uploads/             # Archivos subidos
│   ├── products/        # Imágenes de productos
│   └── categories/      # Imágenes de categorías
├── logs/               # Logs del sistema
├── server.js           # Servidor principal
├── package.json        # Dependencias
└── README.md          # Documentación
```

## 🔧 Comandos Útiles

### **Desarrollo**
```bash
# Iniciar en modo desarrollo
npm run dev

# Ejecutar tests
npm test

# Linting
npm run lint

# Formatear código
npm run format
```

### **Base de Datos**
```bash
# Ejecutar migraciones
npm run db:migrate

# Poblar con datos de prueba
npm run db:seed

# Resetear base de datos
npm run db:reset
```

### **Producción**
```bash
# Construir para producción
npm run build

# Desplegar
npm run deploy

# Verificar salud del sistema
npm run health
```

## 🧪 Testing

### **Ejecutar Tests**
```bash
# Todos los tests
npm test

# Tests en modo watch
npm run test:watch

# Tests con cobertura
npm run test:coverage
```

### **Estructura de Tests**
```
tests/
├── unit/              # Tests unitarios
├── integration/       # Tests de integración
└── e2e/              # Tests end-to-end
```

## 🔒 Seguridad

### **Medidas Implementadas**
- ✅ **JWT Authentication** - Tokens seguros
- ✅ **Password Hashing** - Bcrypt con salt
- ✅ **Rate Limiting** - Protección contra ataques
- ✅ **Input Validation** - Validación de entrada
- ✅ **SQL Injection Protection** - Consultas parametrizadas
- ✅ **XSS Protection** - Sanitización de datos
- ✅ **CORS Configuration** - Control de acceso
- ✅ **Security Headers** - Headers de seguridad

### **Buenas Prácticas**
- 🔐 Cambiar contraseñas por defecto
- 🔐 Usar HTTPS en producción
- 🔐 Configurar firewall
- 🔐 Mantener dependencias actualizadas
- 🔐 Hacer backups regulares

## 📊 Monitoreo y Logs

### **Logs del Sistema**
- **Access Logs**: `logs/access.log`
- **Error Logs**: `logs/error.log`
- **Application Logs**: `logs/app.log`

### **Health Check**
```http
GET /health
```

### **Métricas Disponibles**
- Estado de la base de datos
- Uso de memoria
- Tiempo de respuesta
- Conexiones activas

## 🚀 Despliegue

### **Entorno de Desarrollo**
```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp config.env.example config.env

# Iniciar servidor
npm run dev
```

### **Entorno de Producción**
```bash
# Instalar dependencias de producción
npm install --production

# Configurar variables de entorno
nano config.env

# Construir aplicación
npm run build

# Iniciar servidor
npm start
```

### **Docker (Opcional)**
```bash
# Construir imagen
docker build -t alquimia-store .

# Ejecutar contenedor
docker run -p 3000:3000 alquimia-store
```

## 🤝 Contribución

### **Cómo Contribuir**
1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

### **Estándares de Código**
- Usar ESLint y Prettier
- Seguir convenciones de naming
- Documentar funciones complejas
- Escribir tests para nuevas funcionalidades

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📞 Soporte

### **Contacto**
- **Email**: soporte@alquimiatechnologic.com
- **Teléfono**: +57 300 123 4567
- **Sitio Web**: https://alquimiatechnologic.com

### **Documentación Adicional**
- **API Docs**: http://localhost:3000/api-docs
- **Swagger UI**: http://localhost:3000/swagger
- **Postman Collection**: Disponible en `/docs/postman`

## 🎯 Roadmap

### **Próximas Funcionalidades**
- [ ] Sistema de pagos (Stripe, PayPal)
- [ ] Notificaciones push
- [ ] Chat en vivo
- [ ] Sistema de reseñas
- [ ] Wishlist
- [ ] Cupones de descuento
- [ ] Newsletter
- [ ] Multiidioma
- [ ] PWA completa
- [ ] Analytics avanzado

### **Mejoras Técnicas**
- [ ] Cache con Redis
- [ ] CDN para imágenes
- [ ] Microservicios
- [ ] GraphQL API
- [ ] Testing automatizado
- [ ] CI/CD pipeline

---

## ⚡ Quick Start

```bash
# 1. Clonar repositorio
git clone https://github.com/alquimiatechnologic/store.git
cd store

# 2. Instalar dependencias
npm install

# 3. Configurar base de datos
# - Crear BD: alquimia_technologic_store
# - Importar: database/schema.sql

# 4. Configurar variables de entorno
cp config.env.example config.env
# Editar config.env con tus credenciales

# 5. Crear directorios
mkdir -p uploads/products uploads/categories logs

# 6. Iniciar servidor
npm run dev

# 7. Acceder al sistema
# Tienda: http://localhost:3000
# Admin: http://localhost:3000/admin
# Usuario: admin / Contraseña: password
```

¡Listo! Tu tienda web está funcionando. 🎉 