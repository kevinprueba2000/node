// Variables globales
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let categories = [];
let featuredProducts = [];

// Elementos del DOM
const searchToggle = document.getElementById('searchToggle');
const searchBar = document.getElementById('searchBar');
const searchInput = document.getElementById('searchInput');
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const navMenu = document.getElementById('navMenu');
const cartCount = document.getElementById('cartCount');
const categoriesGrid = document.getElementById('categoriesGrid');
const featuredProductsGrid = document.getElementById('featuredProductsGrid');
const footerCategories = document.getElementById('footerCategories');
const newsletterForm = document.getElementById('newsletterForm');
const loadingSpinner = document.getElementById('loadingSpinner');
const toastContainer = document.getElementById('toastContainer');

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Función principal de inicialización
async function initializeApp() {
    try {
        showLoading(true);
        
        // Cargar datos
        await Promise.all([
            loadCategories(),
            loadFeaturedProducts(),
            loadSiteConfig()
        ]);
        
        // Actualizar carrito
        updateCartCount();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Configurar animaciones
        setupAnimations();
        
        // Configurar lazy loading
        setupLazyLoading();
        
        // Configurar scroll animations
        setupScrollAnimations();
        
    } catch (error) {
        console.error('Error inicializando la aplicación:', error);
        showToast('Error cargando la aplicación', 'error');
    } finally {
        showLoading(false);
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Search toggle
    if (searchToggle) {
        searchToggle.addEventListener('click', toggleSearch);
    }
    
    // Mobile menu toggle
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    }
    
    // Search form
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });
    }
    
    // Newsletter form
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', handleNewsletterSubmit);
    }
    
    // Smooth scrolling para enlaces internos
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Toggle search bar
function toggleSearch() {
    searchBar.classList.toggle('show');
    if (searchBar.classList.contains('show')) {
        searchInput.focus();
    }
}

// Toggle mobile menu
function toggleMobileMenu() {
    navMenu.classList.toggle('show');
}

// Realizar búsqueda
function performSearch() {
    const query = searchInput.value.trim();
    if (query) {
        window.location.href = `/productos?search=${encodeURIComponent(query)}`;
    }
}

// Cargar categorías
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        if (response.ok) {
            categories = await response.json();
            updateCategoriesDisplay();
        }
    } catch (error) {
        console.error('Error cargando categorías:', error);
    }
}

// Actualizar display de categorías
function updateCategoriesDisplay() {
    if (categoriesGrid) {
        categoriesGrid.innerHTML = categories.map(category => `
            <a href="/categoria/${category.slug}" class="category-card">
                <div class="category-icon">
                    <i class="fas fa-${getCategoryIcon(category.name)}"></i>
                </div>
                <h3 class="category-title">${category.name}</h3>
                <p class="category-description">${category.description || 'Descubre nuestros productos en esta categoría.'}</p>
            </a>
        `).join('');
    }
    
    if (footerCategories) {
        footerCategories.innerHTML = categories.map(category => `
            <li><a href="/categoria/${category.slug}">${category.name}</a></li>
        `).join('');
    }
}

// Obtener icono para categoría
function getCategoryIcon(categoryName) {
    const iconMap = {
        'Software Personalizado': 'code',
        'Aceites Esenciales': 'leaf',
        'Figuras en Yeso': 'palette',
        'Suscripciones Premium': 'crown'
    };
    return iconMap[categoryName] || 'tag';
}

// Cargar productos destacados
async function loadFeaturedProducts() {
    try {
        const response = await fetch('/api/products?featured=true&limit=6');
        if (response.ok) {
            const data = await response.json();
            featuredProducts = data.data || [];
            updateFeaturedProductsDisplay();
        }
    } catch (error) {
        console.error('Error cargando productos destacados:', error);
    }
}

// Actualizar display de productos destacados
function updateFeaturedProductsDisplay() {
    if (featuredProductsGrid) {
        if (featuredProducts.length === 0) {
            featuredProductsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                    <p style="color: var(--text-secondary);">No hay productos destacados disponibles.</p>
                </div>
            `;
            return;
        }
        
        featuredProductsGrid.innerHTML = featuredProducts.map(product => `
            <div class="product-card">
                <div class="product-image">
                    ${product.primary_image ? 
                        `<img src="/uploads/${product.primary_image}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover;">` :
                        `<i class="fas fa-image"></i>`
                    }
                </div>
                <div class="product-content">
                    <h3 class="product-title">${product.name}</h3>
                    <div class="product-price">${formatCurrency(product.price)}</div>
                    <p class="product-description">${product.short_description || 'Descripción del producto.'}</p>
                    <button class="btn btn-primary" onclick="addToCart(${product.id}, '${product.name}', ${product.price})">
                        <i class="fas fa-shopping-cart"></i>
                        Agregar al Carrito
                    </button>
                </div>
            </div>
        `).join('');
    }
}

// Cargar configuración del sitio
async function loadSiteConfig() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const data = await response.json();
            // Aquí puedes actualizar elementos del sitio con la configuración
            console.log('Configuración cargada:', data);
        }
    } catch (error) {
        console.error('Error cargando configuración:', error);
    }
}

// Funciones del carrito
function addToCart(productId, productName, price) {
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: productId,
            name: productName,
            price: price,
            quantity: 1
        });
    }
    
    saveCart();
    updateCartCount();
    showToast(`${productName} agregado al carrito`, 'success');
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartCount();
}

function updateCartCount() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCount) {
        cartCount.textContent = totalItems;
    }
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function clearCart() {
    cart = [];
    saveCart();
    updateCartCount();
}

// Formatear moneda
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(amount);
}

// Manejar newsletter
async function handleNewsletterSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('newsletterEmail').value.trim();
    
    if (!email || !email.includes('@')) {
        showToast('Por favor ingresa un email válido', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/newsletter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('¡Suscripción exitosa!', 'success');
            document.getElementById('newsletterEmail').value = '';
        } else {
            showToast(data.message || 'Error en la suscripción', 'error');
        }
    } catch (error) {
        console.error('Error en newsletter:', error);
        showToast('Error en la suscripción', 'error');
    }
}

// Mostrar loading
function showLoading(show) {
    if (loadingSpinner) {
        if (show) {
            loadingSpinner.classList.add('show');
        } else {
            loadingSpinner.classList.remove('show');
        }
    }
}

// Mostrar toast
function showToast(message, type = 'info', title = null) {
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
            ${title ? `<div class="toast-title">${title}</div>` : ''}
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Mostrar toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Funciones de utilidad
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Lazy loading para imágenes
function setupLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// Smooth scroll para enlaces internos
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Configurar animaciones
function setupAnimations() {
    // Animación de entrada para elementos
    const animateElements = document.querySelectorAll('.category-card, .product-card, .service-card, .hero-content, .section-header');
    
    animateElements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            el.style.transition = 'all 0.6s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

// Animaciones al hacer scroll
function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                
                // Animación específica para cada tipo de elemento
                if (entry.target.classList.contains('product-card')) {
                    entry.target.style.animation = 'slideUpFade 0.6s ease forwards';
                } else if (entry.target.classList.contains('category-card')) {
                    entry.target.style.animation = 'scaleIn 0.6s ease forwards';
                } else if (entry.target.classList.contains('service-card')) {
                    entry.target.style.animation = 'slideInLeft 0.6s ease forwards';
                }
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.category-card, .product-card, .service-card, .section-header').forEach(el => {
        observer.observe(el);
    });
}

// Configurar lazy loading mejorado
function setupLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                img.classList.add('loaded');
                imageObserver.unobserve(img);
                
                // Animación de carga
                img.style.opacity = '0';
                img.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    img.style.transition = 'all 0.5s ease';
                    img.style.opacity = '1';
                    img.style.transform = 'scale(1)';
                }, 100);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '50px'
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// Inicializar animaciones cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    setupLazyLoading();
    setupSmoothScroll();
    setupScrollAnimations();
});

// Manejar errores de red
window.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG') {
        e.target.src = '/images/placeholder.jpg';
    }
});

// Prevenir envío múltiple de formularios
document.addEventListener('submit', function(e) {
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    if (submitBtn && !form.dataset.submitting) {
        form.dataset.submitting = 'true';
        submitBtn.disabled = true;
        
        setTimeout(() => {
            form.dataset.submitting = 'false';
            submitBtn.disabled = false;
        }, 3000);
    }
}); 