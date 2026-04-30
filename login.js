// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBwwELPPJ4klVTcqTcZzAPfUR-q5A4_ZDk",
    authDomain: "firmaexpress-pro.firebaseapp.com",
    projectId: "firmaexpress-pro",
    storageBucket: "firmaexpress-pro.firebasestorage.app",
    messagingSenderId: "101193300557",
    appId: "1:101193300557:web:e8d8dab3d86b6cf2caba04"
};

// Iniciar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Lógica de Login
const loginForm = document.getElementById('loginForm');
const btnLogin = document.getElementById('btnLogin');
const loginError = document.getElementById('loginError');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        btnLogin.disabled = true;
        btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
        loginError.style.display = 'none';
        
        await auth.signInWithEmailAndPassword(email, password);
        
        // Si todo sale bien, redirigir al panel principal
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        loginError.style.display = 'block';
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            loginError.textContent = 'Correo o contraseña incorrectos.';
        } else {
            loginError.textContent = 'Ocurrió un error. Intente nuevamente.';
        }
        btnLogin.disabled = false;
        btnLogin.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión';
    }
});

// Verificar si ya está logueado para no pedirle la clave de nuevo
auth.onAuthStateChanged((user) => {
    if (user) {
        window.location.href = 'index.html';
    }
});

// Lógica de Temas (Sol/Luna)
const themeToggle = document.getElementById('themeToggle');
const body = document.body;
const savedTheme = localStorage.getItem('theme') || 'light';

// Aplicar el tema guardado al iniciar
body.setAttribute('data-theme', savedTheme);
actualizarIconoTema(savedTheme);

if(themeToggle){
    themeToggle.addEventListener('click', () => {
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        actualizarIconoTema(newTheme);
    });
}

function actualizarIconoTema(theme) {
    if(!themeToggle) return;
    if (theme === 'dark') {
        themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
        themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
}
