// Variables globales
let currentSection = 'dashboard';
let stats = {};
let products = [];
let categories = [];
let orders = [];
let customers = [];
let contacts = [];

// Elementos del DOM
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const adminMenuToggle = document.getElementById('adminMenuToggle');
const adminDropdown = document.getElementById('adminDropdown');
const logoutBtn = document.getElementById('logoutBtn');
const pageTitle = document.getElementById('pageTitle');
const adminName = document.getElementById('adminName');
const adminRole = document.getElementById('adminRole');

// Elementos de estadísticas
const totalProducts = document.getElementById('totalProducts');
const totalCategories = document.getElementById('totalCategories');
const totalOrders = document.getElementById('totalOrders');
const monthlySales = document.getElementById('monthlySales');
const recentOrdersTable = document.getElementById('recentOrdersTable');

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

// Función principal de inicialización
async function initializeDashboard() {
    try {
        // Verificar autenticación
        if (!checkAuth()) {
            return;
        }
        
        // Configurar event listeners
        setupEventListeners();
        
        // Cargar datos iniciales
        await loadInitialData();
        
        // Configurar navegación
        setupNavigation();
        
        // Cargar sección activa
        loadSection(currentSection);
        
    } catch (error) {
        console.error('Error inicializando dashboard:', error);
        showToast('Error cargando el dashboard', 'error');
    }
}

// Verificar autenticación
function checkAuth() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/admin/login';
        return false;
    }
    return true;
}

// Configurar event listeners
function setupEventListeners() {
    // Sidebar toggle
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    // Mobile menu toggle
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    }
    
    // Admin menu toggle
    if (adminMenuToggle) {
        adminMenuToggle.addEventListener('click', toggleAdminMenu);
    }
    
    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Cerrar dropdowns al hacer clic fuera
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.admin-menu')) {
            adminDropdown.classList.remove('show');
        }
    });
    
    // Navegación con teclado
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            adminDropdown.classList.remove('show');
        }
    });
}

// Cargar datos iniciales
async function loadInitialData() {
    try {
        // Cargar estadísticas
        await loadStats();
        
        // Cargar datos del usuario
        loadUserData();
        
        // Actualizar UI
        updateDashboardUI();
        
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
        showToast('Error cargando datos', 'error');
    }
}

// Cargar estadísticas
async function loadStats() {
    try {
        const response = await fetch('/api/stats', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (response.ok) {
            stats = await response.json();
            updateStatsDisplay();
        } else {
            throw new Error('Error cargando estadísticas');
        }
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        // Usar datos por defecto
        stats = {
            products: 0,
            categories: 0,
            orders: 0,
            monthly_sales: 0
        };
        updateStatsDisplay();
    }
}

// Actualizar display de estadísticas
function updateStatsDisplay() {
    if (totalProducts) {
        totalProducts.textContent = stats.products || 0;
    }
    
    if (totalCategories) {
        totalCategories.textContent = stats.categories || 0;
    }
    
    if (totalOrders) {
        totalOrders.textContent = stats.orders || 0;
    }
    
    if (monthlySales) {
        const sales = stats.monthly_sales || 0;
        monthlySales.textContent = formatCurrency(sales);
    }
}

// Cargar datos del usuario
function loadUserData() {
    const userData = localStorage.getItem('adminUser');
    if (userData) {
        const user = JSON.parse(userData);
        if (adminName) {
            adminName.textContent = user.name || 'Administrador';
        }
        if (adminRole) {
            adminRole.textContent = user.role || 'Admin';
        }
    }
}

// Configurar navegación
function setupNavigation() {
    const menuLinks = document.querySelectorAll('.menu-link');
    
    menuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const section = this.getAttribute('data-section');
            if (section) {
                navigateToSection(section);
            }
        });
    });
}

// Navegar a sección
function navigateToSection(section) {
    // Actualizar menú activo
    updateActiveMenu(section);
    
    // Cargar sección
    loadSection(section);
    
    // Actualizar título
    updatePageTitle(section);
    
    // Cerrar menú móvil si está abierto
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('show');
    }
}

// Actualizar menú activo
function updateActiveMenu(section) {
    const menuItems = document.querySelectorAll('.menu-item');
    const targetLink = document.querySelector(`[data-section="${section}"]`);
    
    menuItems.forEach(item => {
        item.classList.remove('active');
    });
    
    if (targetLink) {
        targetLink.parentElement.classList.add('active');
    }
}

// Cargar sección
async function loadSection(section) {
    currentSection = section;
    
    // Ocultar todas las secciones
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(s => s.classList.remove('active'));
    
    // Mostrar sección activa
    const activeSection = document.getElementById(`${section}-section`);
    if (activeSection) {
        activeSection.classList.add('active');
    }
    
    // Cargar datos específicos de la sección
    await loadSectionData(section);
}

// Cargar datos de sección
async function loadSectionData(section) {
    try {
        switch (section) {
            case 'dashboard':
                await loadDashboardData();
                break;
            case 'products':
                await loadProductsData();
                break;
            case 'categories':
                await loadCategoriesData();
                break;
            case 'orders':
                await loadOrdersData();
                break;
            case 'customers':
                await loadCustomersData();
                break;
            case 'contacts':
                await loadContactsData();
                break;
            case 'settings':
                await loadSettingsData();
                break;
        }
    } catch (error) {
        console.error(`Error cargando datos de ${section}:`, error);
        showToast(`Error cargando ${section}`, 'error');
    }
}

// Cargar datos del dashboard
async function loadDashboardData() {
    try {
        // Cargar pedidos recientes
        const response = await fetch('/api/orders?limit=5', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            updateRecentOrdersTable(data.orders || []);
        }
    } catch (error) {
        console.error('Error cargando datos del dashboard:', error);
    }
}

// Actualizar tabla de pedidos recientes
function updateRecentOrdersTable(orders) {
    if (!recentOrdersTable) return;
    
    if (orders.length === 0) {
        recentOrdersTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    No hay pedidos recientes
                </td>
            </tr>
        `;
        return;
    }
    
    recentOrdersTable.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id}</td>
            <td>${order.customer_name || 'Cliente'}</td>
            <td>${formatCurrency(order.total_amount)}</td>
            <td>
                <span class="status-badge ${order.status}">
                    ${getStatusText(order.status)}
                </span>
            </td>
            <td>${formatDate(order.created_at)}</td>
        </tr>
    `).join('');
}

// Cargar datos de productos
async function loadProductsData() {
    try {
        const response = await fetch('/api/products', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            products = data.products || [];
            updateProductsTable();
        }
    } catch (error) {
        console.error('Error cargando productos:', error);
        showToast('Error cargando productos', 'error');
    }
}

// Actualizar tabla de productos
function updateProductsTable() {
    const productsTable = document.getElementById('productsTable');
    if (!productsTable) return;
    
    if (products.length === 0) {
        productsTable.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted">
                    No hay productos disponibles
                </td>
            </tr>
        `;
        return;
    }
    
    productsTable.innerHTML = products.map(product => `
        <tr>
            <td>${product.name}</td>
            <td>${product.sku || 'N/A'}</td>
            <td>${formatCurrency(product.price)}</td>
            <td>${product.stock || 0}</td>
            <td>
                <span class="status-badge ${product.is_active ? 'active' : 'inactive'}">
                    ${product.is_active ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-secondary" onclick="editProduct(${product.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct(${product.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Cargar datos de categorías
async function loadCategoriesData() {
    try {
        const response = await fetch('/api/categories', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            categories = data.categories || [];
            updateCategoriesTable();
        }
    } catch (error) {
        console.error('Error cargando categorías:', error);
        showToast('Error cargando categorías', 'error');
    }
}

// Actualizar tabla de categorías
function updateCategoriesTable() {
    const categoriesTable = document.getElementById('categoriesTable');
    if (!categoriesTable) return;
    
    if (categories.length === 0) {
        categoriesTable.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted">
                    No hay categorías disponibles
                </td>
            </tr>
        `;
        return;
    }
    
    categoriesTable.innerHTML = categories.map(category => `
        <tr>
            <td>${category.name}</td>
            <td>${category.slug}</td>
            <td>${category.description || 'Sin descripción'}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-secondary" onclick="editCategory(${category.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCategory(${category.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Cargar datos de pedidos
async function loadOrdersData() {
    try {
        const response = await fetch('/api/orders', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            orders = data.orders || [];
            updateOrdersTable();
        }
    } catch (error) {
        console.error('Error cargando pedidos:', error);
        showToast('Error cargando pedidos', 'error');
    }
}

// Actualizar tabla de pedidos
function updateOrdersTable() {
    const ordersTable = document.getElementById('ordersTable');
    if (!ordersTable) return;
    
    if (orders.length === 0) {
        ordersTable.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted">
                    No hay pedidos disponibles
                </td>
            </tr>
        `;
        return;
    }
    
    ordersTable.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id}</td>
            <td>${order.customer_name || 'Cliente'}</td>
            <td>${formatCurrency(order.total_amount)}</td>
            <td>
                <span class="status-badge ${order.status}">
                    ${getStatusText(order.status)}
                </span>
            </td>
            <td>${formatDate(order.created_at)}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-secondary" onclick="viewOrder(${order.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-success" onclick="updateOrderStatus(${order.id})">
                        <i class="fas fa-check"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Cargar datos de clientes
async function loadCustomersData() {
    try {
        const response = await fetch('/api/customers', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            customers = data.customers || [];
            updateCustomersTable();
        }
    } catch (error) {
        console.error('Error cargando clientes:', error);
        showToast('Error cargando clientes', 'error');
    }
}

// Actualizar tabla de clientes
function updateCustomersTable() {
    const customersTable = document.getElementById('customersTable');
    if (!customersTable) return;
    
    if (customers.length === 0) {
        customersTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    No hay clientes registrados
                </td>
            </tr>
        `;
        return;
    }
    
    customersTable.innerHTML = customers.map(customer => `
        <tr>
            <td>${customer.name}</td>
            <td>${customer.email}</td>
            <td>${customer.phone || 'N/A'}</td>
            <td>${formatDate(customer.created_at)}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-secondary" onclick="viewCustomer(${customer.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${customer.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Cargar datos de contactos
async function loadContactsData() {
    try {
        const response = await fetch('/api/contacts', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            contacts = data.contacts || [];
            updateContactsTable();
        }
    } catch (error) {
        console.error('Error cargando contactos:', error);
        showToast('Error cargando contactos', 'error');
    }
}

// Actualizar tabla de contactos
function updateContactsTable() {
    const contactsTable = document.getElementById('contactsTable');
    if (!contactsTable) return;
    
    if (contacts.length === 0) {
        contactsTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    No hay mensajes de contacto
                </td>
            </tr>
        `;
        return;
    }
    
    contactsTable.innerHTML = contacts.map(contact => `
        <tr>
            <td>${contact.name}</td>
            <td>${contact.email}</td>
            <td>${contact.subject}</td>
            <td>${formatDate(contact.created_at)}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-secondary" onclick="viewContact(${contact.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteContact(${contact.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Cargar datos de configuración
async function loadSettingsData() {
    try {
        const response = await fetch('/api/settings', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            updateSettingsForm(data.settings || {});
        }
    } catch (error) {
        console.error('Error cargando configuración:', error);
        showToast('Error cargando configuración', 'error');
    }
}

// Actualizar formulario de configuración
function updateSettingsForm(settings) {
    // Implementar según la estructura de configuración
    console.log('Configuración cargada:', settings);
}

// Toggle sidebar
function toggleSidebar() {
    sidebar.classList.toggle('collapsed');
    
    // Guardar preferencia
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebarCollapsed', isCollapsed);
}

// Toggle mobile menu
function toggleMobileMenu() {
    sidebar.classList.toggle('show');
}

// Toggle admin menu
function toggleAdminMenu() {
    adminDropdown.classList.toggle('show');
}

// Manejar logout
function handleLogout() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        window.location.href = '/admin/login';
    }
}

// Actualizar título de página
function updatePageTitle(section) {
    const titles = {
        dashboard: 'Dashboard',
        products: 'Productos',
        categories: 'Categorías',
        orders: 'Pedidos',
        customers: 'Clientes',
        contacts: 'Contactos',
        settings: 'Configuración'
    };
    
    if (pageTitle) {
        pageTitle.textContent = titles[section] || 'Dashboard';
    }
}

// Actualizar UI del dashboard
function updateDashboardUI() {
    // Implementar actualizaciones específicas del UI
    console.log('Dashboard UI actualizada');
}

// Funciones de utilidad
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(amount || 0);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Pendiente',
        'processing': 'Procesando',
        'completed': 'Completado',
        'cancelled': 'Cancelado',
        'active': 'Activo',
        'inactive': 'Inactivo'
    };
    
    return statusMap[status] || status;
}

// Mostrar toast
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const iconMap = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="${iconMap[type]}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    const container = document.getElementById('toastContainer');
    if (container) {
        container.appendChild(toast);
        
        // Mostrar toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
}

// Funciones CRUD (placeholder)
function editProduct(id) {
    showToast(`Editando producto ${id}`, 'info');
    // Implementar modal de edición
}

function deleteProduct(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
        showToast(`Eliminando producto ${id}`, 'info');
        // Implementar eliminación
    }
}

function editCategory(id) {
    showToast(`Editando categoría ${id}`, 'info');
    // Implementar modal de edición
}

function deleteCategory(id) {
    if (confirm('¿Estás seguro de que quieres eliminar esta categoría?')) {
        showToast(`Eliminando categoría ${id}`, 'info');
        // Implementar eliminación
    }
}

function viewOrder(id) {
    showToast(`Viendo pedido ${id}`, 'info');
    // Implementar vista de pedido
}

function updateOrderStatus(id) {
    showToast(`Actualizando estado del pedido ${id}`, 'info');
    // Implementar actualización de estado
}

function viewCustomer(id) {
    showToast(`Viendo cliente ${id}`, 'info');
    // Implementar vista de cliente
}

function deleteCustomer(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
        showToast(`Eliminando cliente ${id}`, 'info');
        // Implementar eliminación
    }
}

function viewContact(id) {
    showToast(`Viendo contacto ${id}`, 'info');
    // Implementar vista de contacto
}

function deleteContact(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este contacto?')) {
        showToast(`Eliminando contacto ${id}`, 'info');
        // Implementar eliminación
    }
}

// Inicializar sidebar state
document.addEventListener('DOMContentLoaded', function() {
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
    }
});

// Manejar errores de red
window.addEventListener('online', function() {
    showToast('Conexión restaurada', 'success');
});

window.addEventListener('offline', function() {
    showToast('Sin conexión a internet', 'warning');
});

// Auto-refresh de datos
setInterval(async function() {
    if (currentSection === 'dashboard') {
        await loadStats();
    }
}, 300000); // Cada 5 minutos 