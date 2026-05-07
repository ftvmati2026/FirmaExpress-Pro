/* 
    FirmaExpress Pro - SaaS Logic
    Desarrollado para Matías Gómez
*/

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
const db = firebase.firestore();
const auth = firebase.auth();
const SUPER_ADMIN_EMAIL = "matias@firmaexpress.com";

let currentTenantId = null;
let isSuperAdmin = false;
let listenerAuditorias = null;
let listenerHistorial = null;
let ultimoPDFId = null;

// Referencias a elementos del DOM
const superAdminDashboard = document.getElementById('superAdminDashboard');
const tenantDashboard = document.getElementById('tenantDashboard');
const headerTitle = document.getElementById('headerTitle');
const userEmailDisplay = document.getElementById('userEmailDisplay');
const btnLogout = document.getElementById('btnLogout');
const btnVolverAdmin = document.getElementById('btnVolverAdmin');
const btnDownloadHeader = document.getElementById('btnDownloadPDF');

// ----------------------------------------------------
// 1. AUTENTICACIÓN Y FLUJO INICIAL
// ----------------------------------------------------

auth.onAuthStateChanged(async (user) => {
    if (user) {
        userEmailDisplay.textContent = user.email;
        if (user.email === SUPER_ADMIN_EMAIL) {
            isSuperAdmin = true;
            iniciarModoSuperAdmin();
        } else {
            isSuperAdmin = false;
            currentTenantId = user.uid;
            iniciarModoCliente(user.uid);
        }
    } else {
        window.location.href = 'login.html';
    }
});

if(btnLogout) btnLogout.addEventListener('click', () => { auth.signOut(); });

function iniciarModoSuperAdmin() {
    if(superAdminDashboard) superAdminDashboard.style.display = 'block';
    if(tenantDashboard) tenantDashboard.style.display = 'none';
    if(btnVolverAdmin) btnVolverAdmin.style.display = 'none';
    headerTitle.textContent = "Admin - FirmaExpress Pro";
    currentTenantId = null;
    cargarEmpresas();
}

async function iniciarModoCliente(tenantUid) {
    if(superAdminDashboard) superAdminDashboard.style.display = 'none';
    if(tenantDashboard) tenantDashboard.style.display = 'block';
    
    if (isSuperAdmin && btnVolverAdmin) {
        btnVolverAdmin.style.display = 'inline-flex';
    }

    const doc = await db.collection('empresas').doc(tenantUid).get();
    if (doc.exists) {
        const data = doc.data();
        headerTitle.textContent = `Gestionando: ${data.nombre || 'Empresa'}`;
    }

    cargarAuditoriasDeEmpresa();
    cargarHistorialDeEmpresa(tenantUid);
}

window.volverAlAdmin = function() { iniciarModoSuperAdmin(); }

// ----------------------------------------------------
// 2. GESTIÓN DE EMPRESAS (Solo Admin)
// ----------------------------------------------------

async function cargarEmpresas() {
    const list = document.getElementById('empresasList');
    if(!list) return;
    db.collection('empresas').onSnapshot((snapshot) => {
        list.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${data.nombre}</strong><br><small>${data.email}</small></td>
                <td>${data.whatsapp || '---'}</td>
                <td class="td-actions">
                    <button class="icon-btn" onclick="entrarComoEmpresa('${doc.id}', '${data.nombre}')" style="color: var(--primary-color);">
                        <i class="fa-solid fa-right-to-bracket"></i>
                    </button>
                    <button class="icon-btn" onclick="eliminarEmpresa('${doc.id}')" style="color: var(--danger-color);">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            list.appendChild(tr);
        });
    });
}

window.entrarComoEmpresa = (id, nombre) => {
    currentTenantId = id;
    iniciarModoCliente(id);
};

window.eliminarEmpresa = async (id) => {
    if(confirm("¿Eliminar empresa?")) await db.collection('empresas').doc(id).delete();
}

// ----------------------------------------------------
// 3. GESTIÓN DE DOCUMENTOS
// ----------------------------------------------------

const uploadForm = document.getElementById('uploadForm');
const pdfInput = document.getElementById('pdfFile');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const btnUpload = document.getElementById('btnUpload');

if (pdfInput) {
    pdfInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            fileNameDisplay.textContent = file.name;
            btnUpload.disabled = false;
        } else {
            fileNameDisplay.textContent = 'Seleccionar PDF';
            btnUpload.disabled = true;
        }
    });
}

if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = pdfInput.files[0];
        if (!currentTenantId) return;

        const modoFirmaElegido = document.querySelector('input[name="modoFirma"]:checked').value;
        const posicionFirma = document.getElementById('posicionFirma') ? document.getElementById('posicionFirma').value : 'abajo_derecha';

        try {
            btnUpload.disabled = true;
            btnUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';
            const base64PDF = await fileToBase64(file);
            await db.collection('auditorias').add({
                tenantId: currentTenantId,
                modoFirma: modoFirmaElegido,
                posicionFirma: posicionFirma,
                nombreArchivo: file.name,
                pdfBase64: base64PDF,
                estado: 'Pendiente',
                fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
                firmaBase64: null
            });
            alert("¡Subido!");
            uploadForm.reset();
            fileNameDisplay.textContent = 'Seleccionar PDF';
            btnUpload.disabled = true;
        } catch (error) {
            alert('Error al subir.');
        } finally {
            btnUpload.innerHTML = '<i class="fa-solid fa-link"></i> Generar Link';
        }
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function cargarAuditoriasDeEmpresa() {
    const auditsList = document.getElementById('auditsList');
    if (!auditsList || !currentTenantId) return;
    
    if(listenerAuditorias) listenerAuditorias();
    const pendingCounter = document.getElementById('pendingCounter');

    listenerAuditorias = db.collection('auditorias')
        .where("tenantId", "==", currentTenantId)
        .onSnapshot((snapshot) => {
            
        auditsList.innerHTML = '';
        let pendingCount = 0;
        const docs = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.estado === 'Pendiente') {
                docs.push({ id: doc.id, ...data });
                pendingCount++;
            }
        });

        if (docs.length === 0) {
            auditsList.innerHTML = `<tr><td colspan="3">No hay documentos pendientes.</td></tr>`;
        }

        docs.forEach((data) => {
            const tr = document.createElement('tr');
            const baseURL = window.location.href.substring(0, window.location.href.lastIndexOf("/") + 1);
            const linkACompartir = `${baseURL}firmar.html?id=${data.id}`;
            tr.innerHTML = `
                <td><strong>${data.nombreArchivo}</strong></td>
                <td><span class="badge badge-pending">Pendiente</span></td>
                <td>
                    <button class="icon-btn" onclick="copiarLink('${linkACompartir}')"><i class="fa-brands fa-whatsapp"></i></button>
                    <button class="icon-btn" onclick="eliminarAuditoria('${data.id}')" style="color:var(--danger-color)"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            auditsList.appendChild(tr);
        });

        if (pendingCounter) {
            pendingCounter.textContent = pendingCount;
            pendingCounter.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        }
    });
}

function cargarHistorialDeEmpresa(tenantUid) {
    const historyList = document.getElementById('historyList');
    if (!historyList || !tenantUid) return;
    if(listenerHistorial) listenerHistorial();
    
    listenerHistorial = db.collection('auditorias')
        .where("tenantId", "==", tenantUid)
        .onSnapshot((snapshot) => {
            
        historyList.innerHTML = '';
        const docs = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.estado === 'Firmado') docs.push({ id: doc.id, ...data });
        });

        if (docs.length === 0) {
            historyList.innerHTML = `<tr><td colspan="4">Sin historial.</td></tr>`;
            if (btnDownloadHeader) btnDownloadHeader.style.display = 'none';
            return;
        }

        ultimoPDFId = docs[0].id;
        if (btnDownloadHeader) btnDownloadHeader.style.display = 'inline-flex';

        docs.forEach((data) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${data.nombreArchivo}</strong></td>
                <td>Firmado</td>
                <td>${data.afiliadoNombre || 'N/A'}</td>
                <td>
                    <button class="icon-btn" onclick="descargarPDF('${data.id}')" style="color:var(--success-color)"><i class="fa-solid fa-download"></i></button>
                </td>
            `;
            historyList.appendChild(tr);
        });
    });
}

// ----------------------------------------------------
// 4. DESCARGA Y HERRAMIENTAS
// ----------------------------------------------------

window.copiarLink = function(link) {
    navigator.clipboard.writeText(link).then(() => { alert("¡Link copiado!"); });
}

window.eliminarAuditoria = async function(id) {
    if(confirm("¿Eliminar?")) await db.collection('auditorias').doc(id).delete();
}

window.descargarUltimoPDF = function() { if (ultimoPDFId) descargarPDF(ultimoPDFId); }

window.descargarPDF = async function(id) {
    try {
        const docSnapshot = await db.collection('auditorias').doc(id).get();
        const data = docSnapshot.data();
        const existingPdfBytes = await fetch(data.pdfBase64).then(res => res.arrayBuffer());
        const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
        
        const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        const pages = pdfDoc.getPages();
        const page = data.modoFirma === 'hoja_nueva' ? pdfDoc.addPage(PDFLib.PageSizes.A4) : pages[pages.length - 1];
        
        if (data.firmaBase64) {
            const signatureImage = await pdfDoc.embedPng(data.firmaBase64);
            page.drawImage(signatureImage, { x: 50, y: 50, width: 150, height: 75 });
        }
        
        page.drawText(`Firmado por: ${data.afiliadoNombre || 'N/A'}`, { x: 50, y: 30, size: 10, font: fontBold });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `FIRMADO_${data.nombreArchivo}`;
        link.click();
    } catch (err) { alert("Error al generar PDF."); }
}

// TEMA
const themeToggle = document.getElementById('themeToggle');
if(themeToggle) themeToggle.addEventListener('click', () => {
    const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
