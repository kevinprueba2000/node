// Variables globales
let isSubmitting = false;

// Elementos del DOM
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const alertMessage = document.getElementById('alertMessage');
const alertText = document.getElementById('alertText');
const usernameError = document.getElementById('usernameError');
const passwordError = document.getElementById('passwordError');
const eyeIcon = document.getElementById('eyeIcon');

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeLogin();
});

// Función principal de inicialización
function initializeLogin() {
    // Configurar event listeners
    setupEventListeners();
    
    // Verificar si hay token guardado
    checkExistingSession();
    
    // Enfoque en el primer campo
    usernameInput.focus();
}

// Configurar event listeners
function setupEventListeners() {
    // Formulario de login
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Validación en tiempo real
    if (usernameInput) {
        usernameInput.addEventListener('input', () => validateField('username'));
        usernameInput.addEventListener('blur', () => validateField('username'));
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('input', () => validateField('password'));
        passwordInput.addEventListener('blur', () => validateField('password'));
    }
    
    // Enter key para navegar entre campos
    usernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            passwordInput.focus();
        }
    });
    
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleLogin(e);
        }
    });
    
    // Prevenir envío múltiple
    loginForm.addEventListener('submit', function(e) {
        if (isSubmitting) {
            e.preventDefault();
            return;
        }
    });
}

// Verificar sesión existente
function checkExistingSession() {
    const token = localStorage.getItem('adminToken');
    if (token) {
        // Verificar si el token es válido
        verifyToken(token);
    }
}

// Verificar token
async function verifyToken(token) {
    try {
        const response = await fetch('/api/auth/verify', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            // Token válido, redirigir al dashboard
            window.location.href = '/admin/dashboard';
        } else {
            // Token inválido, limpiar
            localStorage.removeItem('adminToken');
        }
    } catch (error) {
        console.error('Error verificando token:', error);
        localStorage.removeItem('adminToken');
    }
}

// Manejar login
async function handleLogin(e) {
    e.preventDefault();
    
    if (isSubmitting) {
        return;
    }
    
    // Validar formulario
    if (!validateForm()) {
        return;
    }
    
    // Mostrar estado de carga
    setLoadingState(true);
    
    try {
        const formData = {
            username: usernameInput.value.trim(),
            password: passwordInput.value
        };
        
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Login exitoso
            handleLoginSuccess(data);
        } else {
            // Error en login
            handleLoginError(data.message || 'Error en el inicio de sesión');
        }
        
    } catch (error) {
        console.error('Error en login:', error);
        handleLoginError('Error de conexión. Intenta de nuevo.');
    } finally {
        setLoadingState(false);
    }
}

// Manejar login exitoso
function handleLoginSuccess(data) {
    // Guardar token
    localStorage.setItem('adminToken', data.token);
    localStorage.setItem('adminUser', JSON.stringify(data.user));
    
    // Mostrar mensaje de éxito
    showAlert('¡Bienvenido! Redirigiendo...', 'success');
    
    // Redirigir al dashboard
    setTimeout(() => {
        window.location.href = '/admin/dashboard';
    }, 1000);
}

// Manejar error de login
function handleLoginError(message) {
    showAlert(message, 'error');
    
    // Limpiar contraseña
    passwordInput.value = '';
    passwordInput.focus();
}

// Validar formulario completo
function validateForm() {
    const usernameValid = validateField('username');
    const passwordValid = validateField('password');
    
    return usernameValid && passwordValid;
}

// Validar campo específico
function validateField(fieldName) {
    const field = fieldName === 'username' ? usernameInput : passwordInput;
    const errorElement = fieldName === 'username' ? usernameError : passwordError;
    const value = field.value.trim();
    
    let isValid = true;
    let errorMessage = '';
    
    switch (fieldName) {
        case 'username':
            if (!value) {
                errorMessage = 'El usuario es requerido';
                isValid = false;
            } else if (value.length < 3) {
                errorMessage = 'El usuario debe tener al menos 3 caracteres';
                isValid = false;
            }
            break;
            
        case 'password':
            if (!value) {
                errorMessage = 'La contraseña es requerida';
                isValid = false;
            } else if (value.length < 6) {
                errorMessage = 'La contraseña debe tener al menos 6 caracteres';
                isValid = false;
            }
            break;
    }
    
    // Actualizar UI
    updateFieldValidation(field, errorElement, isValid, errorMessage);
    
    return isValid;
}

// Actualizar validación de campo
function updateFieldValidation(field, errorElement, isValid, errorMessage) {
    if (isValid) {
        field.classList.remove('error');
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    } else {
        field.classList.add('error');
        errorElement.textContent = errorMessage;
        errorElement.style.display = 'block';
    }
}

// Toggle password visibility
function togglePassword() {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    
    // Cambiar icono
    if (type === 'text') {
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}

// Mostrar alerta
function showAlert(message, type = 'error') {
    alertMessage.className = `alert ${type}`;
    alertText.textContent = message;
    alertMessage.style.display = 'flex';
    
    // Auto-ocultar después de 5 segundos
    setTimeout(() => {
        alertMessage.style.display = 'none';
    }, 5000);
}

// Ocultar alerta
function hideAlert() {
    alertMessage.style.display = 'none';
}

// Establecer estado de carga
function setLoadingState(loading) {
    isSubmitting = loading;
    
    if (loading) {
        loginBtn.classList.add('loading');
        loginBtn.disabled = true;
    } else {
        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;
    }
}

// Limpiar formulario
function clearForm() {
    loginForm.reset();
    usernameError.textContent = '';
    passwordError.textContent = '';
    usernameError.style.display = 'none';
    passwordError.style.display = 'none';
    usernameInput.classList.remove('error');
    passwordInput.classList.remove('error');
    hideAlert();
}

// Función para hacer el campo global
window.togglePassword = togglePassword;

// Manejar errores de red
window.addEventListener('online', function() {
    hideAlert();
});

window.addEventListener('offline', function() {
    showAlert('Sin conexión a internet. Verifica tu conexión.', 'warning');
});

// Prevenir envío múltiple con teclas
let lastSubmitTime = 0;
const SUBMIT_COOLDOWN = 2000; // 2 segundos

function preventMultipleSubmit() {
    const now = Date.now();
    if (now - lastSubmitTime < SUBMIT_COOLDOWN) {
        return false;
    }
    lastSubmitTime = now;
    return true;
}

// Mejorar UX con feedback visual
function addVisualFeedback() {
    // Efecto de ripple en botón
    loginBtn.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');
        
        this.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
}

// Inicializar efectos visuales
document.addEventListener('DOMContentLoaded', function() {
    addVisualFeedback();
});

// Auto-completar prevención
document.addEventListener('DOMContentLoaded', function() {
    // Prevenir auto-completar en campos sensibles
    usernameInput.setAttribute('autocomplete', 'username');
    passwordInput.setAttribute('autocomplete', 'current-password');
    
    // Limpiar campos al cargar la página
    setTimeout(() => {
        usernameInput.value = '';
        passwordInput.value = '';
    }, 100);
});

// Mejorar accesibilidad
document.addEventListener('DOMContentLoaded', function() {
    // Agregar labels para screen readers
    usernameInput.setAttribute('aria-label', 'Nombre de usuario o email');
    passwordInput.setAttribute('aria-label', 'Contraseña');
    loginBtn.setAttribute('aria-label', 'Iniciar sesión');
    
    // Navegación con teclado
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideAlert();
        }
    });
});

// Detectar tipo de dispositivo
function detectDevice() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        document.body.classList.add('mobile');
        // Ajustar zoom para móviles
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }
    }
}

// Inicializar detección de dispositivo
detectDevice(); 