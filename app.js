/* 
    FirmaExpress Pro - SaaS Logic
    Desarrollado para Matías Gómez
*/

// Configuración Global y Variables de Estado
const db = firebase.firestore();
const auth = firebase.auth();
const SUPER_ADMIN_EMAIL = "matias@firmaexpress.com";

let currentTenantId = null; // ID de la empresa que estamos gestionando (si somos superadmin)
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
const btnPerfil = document.getElementById('btnPerfil');
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

btnLogout.addEventListener('click', () => {
    auth.signOut();
});

function iniciarModoSuperAdmin() {
    superAdminDashboard.style.display = 'block';
    tenantDashboard.style.display = 'none';
    btnVolverAdmin.style.display = 'none';
    btnPerfil.style.display = 'none';
    headerTitle.textContent = "FirmaExpress Pro - Super Admin";
    currentTenantId = null;
    cargarEmpresas();
}

async function iniciarModoCliente(tenantUid) {
    superAdminDashboard.style.display = 'none';
    tenantDashboard.style.display = 'block';
    btnPerfil.style.display = 'inline-flex';
    
    if (isSuperAdmin) {
        btnVolverAdmin.style.display = 'inline-flex';
    }

    const doc = await db.collection('empresas').doc(tenantUid).get();
    if (doc.exists) {
        const data = doc.data();
        headerTitle.textContent = `Gestionando: ${data.nombre || 'Empresa'}`;
        aplicarBranding(data);
    }

    cargarAuditoriasDeEmpresa();
    cargarHistorialDeEmpresa(tenantUid);
}

function aplicarBranding(data) {
    const root = document.documentElement;
    if (data.color) {
        root.style.setProperty('--primary-color', data.color);
        root.style.setProperty('--primary-hover', data.color + 'dd');
    }
    
    const logoImg = document.getElementById('customLogo');
    const defaultIcon = document.getElementById('defaultLogoIcon');
    if (data.logoUrl) {
        logoImg.src = data.logoUrl;
        logoImg.style.display = 'block';
        defaultIcon.style.display = 'none';
    } else {
        logoImg.style.display = 'none';
        defaultIcon.style.display = 'block';
    }
}

window.volverAlAdmin = function() {
    iniciarModoSuperAdmin();
}

// ----------------------------------------------------
// 2. GESTIÓN DE EMPRESAS (Solo Super Admin)
// ----------------------------------------------------

async function cargarEmpresas() {
    const list = document.getElementById('empresasList');
    db.collection('empresas').onSnapshot((snapshot) => {
        list.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${data.logoUrl || ''}" style="width:30px; height:30px; border-radius:4px; object-fit:contain; background:#f0f0f0;" onerror="this.src='https://via.placeholder.com/30?text=F'">
                        <div>
                            <strong>${data.nombre}</strong><br>
                            <small style="color:var(--text-secondary)">${data.whatsapp || 'Sin WhatsApp'}</small>
                        </div>
                    </div>
                </td>
                <td>${data.email}</td>
                <td class="td-actions">
                    <button class="icon-btn" title="Gestionar Documentos" onclick="entrarComoEmpresa('${doc.id}', '${data.nombre}')" style="color: var(--primary-color);">
                        <i class="fa-solid fa-right-to-bracket"></i>
                    </button>
                    <button class="icon-btn" title="Editar" onclick="abrirModalEmpresa('${doc.id}')" style="color: var(--text-secondary);">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="icon-btn" title="Eliminar" onclick="eliminarEmpresa('${doc.id}')" style="color: var(--danger-color);">
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
    if(confirm("¿Estás seguro de eliminar esta empresa y todos sus accesos?")) {
        await db.collection('empresas').doc(id).delete();
    }
}

// Modales de Empresa
window.abrirModalEmpresa = async (id = null) => {
    const modal = document.getElementById('modalEmpresa');
    const form = document.getElementById('formNuevaEmpresa');
    form.reset();
    document.getElementById('editEmpresaId').value = id || '';
    document.getElementById('modalEmpresaTitle').innerHTML = id ? '<i class="fa-solid fa-pen"></i> Editar Empresa' : '<i class="fa-solid fa-plus"></i> Nueva Empresa';
    
    if (id) {
        const doc = await db.collection('empresas').doc(id).get();
        const data = doc.data();
        document.getElementById('empNombre').value = data.nombre;
        document.getElementById('empWhatsapp').value = data.whatsapp || '';
        document.getElementById('empEmail').value = data.email;
        document.getElementById('empLogoUrl').value = data.logoUrl || '';
        document.getElementById('empColor').value = data.color || '#2563eb';
        document.getElementById('passGroup').style.display = 'none';
        document.getElementById('editActions').style.display = 'block';
    } else {
        document.getElementById('passGroup').style.display = 'block';
        document.getElementById('editActions').style.display = 'none';
    }
    modal.style.display = 'flex';
}

window.cerrarModalEmpresa = () => {
    document.getElementById('modalEmpresa').style.display = 'none';
}

document.getElementById('formNuevaEmpresa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editEmpresaId').value;
    const data = {
        nombre: document.getElementById('empNombre').value,
        whatsapp: document.getElementById('empWhatsapp').value,
        email: document.getElementById('empEmail').value,
        logoUrl: document.getElementById('empLogoUrl').value,
        color: document.getElementById('empColor').value
    };

    try {
        if (id) {
            await db.collection('empresas').doc(id).update(data);
        } else {
            const pass = document.getElementById('empPassword').value;
            // Nota: Aquí se asume que hay un endpoint o lógica de Firebase para crear usuarios si es necesario
            await db.collection('empresas').add(data);
        }
        cerrarModalEmpresa();
    } catch (err) {
        alert("Error al guardar empresa: " + err.message);
    }
});

// ----------------------------------------------------
// 3. GESTIÓN DE DOCUMENTOS (Dashboard Cliente)
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
            fileNameDisplay.style.color = 'var(--primary-color)';
            fileNameDisplay.style.fontWeight = 'bold';
            btnUpload.disabled = false;
        } else {
            fileNameDisplay.textContent = 'Hacé clic para seleccionar el PDF';
            btnUpload.disabled = true;
        }
    });
}

if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = pdfInput.files[0];
        if (!currentTenantId) {
            alert("Error: No se detectó el ID de la empresa.");
            return;
        }

        const modoFirmaElegido = document.querySelector('input[name="modoFirma"]:checked').value;
        const posicionFirma = document.getElementById('posicionFirma') ? document.getElementById('posicionFirma').value : 'abajo_izquierda';

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
            
            alert(`¡Documento guardado con éxito!`);
            uploadForm.reset();
            fileNameDisplay.textContent = 'Hacé clic para seleccionar el PDF';
            btnUpload.disabled = true;

        } catch (error) {
            console.error(error);
            alert('Error al subir el archivo.');
        } finally {
            btnUpload.innerHTML = '<i class="fa-solid fa-link"></i> Generar Link Único';
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

        docs.sort((a, b) => {
            const dateA = a.fechaCreacion ? (a.fechaCreacion.toMillis ? a.fechaCreacion.toMillis() : a.fechaCreacion) : Date.now();
            const dateB = b.fechaCreacion ? (b.fechaCreacion.toMillis ? b.fechaCreacion.toMillis() : b.fechaCreacion) : Date.now();
            return dateB - dateA;
        });

        if (docs.length === 0) {
            auditsList.innerHTML = `<tr class="empty-state"><td colspan="3">No hay documentos pendientes.</td></tr>`;
        }

        docs.forEach((data) => {
            const tr = document.createElement('tr');
            const baseURL = window.location.href.substring(0, window.location.href.lastIndexOf("/") + 1);
            const linkACompartir = `${baseURL}firmar.html?id=${data.id}`;
            
            tr.innerHTML = `
                <td><strong>${data.nombreArchivo}</strong></td>
                <td><span class="badge badge-pending">Pendiente</span></td>
                <td class="td-actions">
                    <button class="icon-btn" title="Copiar link" onclick="copiarLink('${linkACompartir}')" style="color: var(--primary-color);">
                        <i class="fa-brands fa-whatsapp"></i>
                    </button>
                    <button class="icon-btn" title="Eliminar" onclick="eliminarAuditoria('${data.id}')" style="color: var(--danger-color);">
                        <i class="fa-solid fa-trash"></i>
                    </button>
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
            if (data.estado === 'Firmado') {
                docs.push({ id: doc.id, ...data });
            }
        });

        docs.sort((a, b) => {
            const dateA = a.fechaFirma ? (a.fechaFirma.toMillis ? a.fechaFirma.toMillis() : a.fechaFirma) : Date.now();
            const dateB = b.fechaFirma ? (b.fechaFirma.toMillis ? b.fechaFirma.toMillis() : b.fechaFirma) : Date.now();
            return dateB - dateA;
        });

        if (docs.length === 0) {
            historyList.innerHTML = `<tr class="empty-state"><td colspan="4">No hay documentos firmados todavía.</td></tr>`;
            if (btnDownloadHeader) btnDownloadHeader.style.display = 'none';
            return;
        }

        ultimoPDFId = docs[0].id;
        if (btnDownloadHeader) btnDownloadHeader.style.display = 'inline-flex';

        docs.forEach((data) => {
            const tr = document.createElement('tr');
            const fechaF = data.fechaFirma ? (data.fechaFirma.toDate ? data.fechaFirma.toDate().toLocaleString('es-AR') : new Date(data.fechaFirma).toLocaleString('es-AR')) : 'Recién';
            
            tr.innerHTML = `
                <td><strong>${data.nombreArchivo}</strong></td>
                <td>${fechaF}</td>
                <td><span class="badge badge-signed">${data.afiliadoNombre || 'Firmante'}</span></td>
                <td class="td-actions">
                    <button class="icon-btn" title="Descargar" onclick="descargarPDF('${data.id}')" style="color: var(--success-color);">
                        <i class="fa-solid fa-download"></i>
                    </button>
                    <button class="icon-btn" title="Eliminar" onclick="eliminarAuditoria('${data.id}')" style="color: var(--danger-color);">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            historyList.appendChild(tr);
        });
    });
}

// ----------------------------------------------------
// 4. FUNCIONES GLOBALES (DESCARGA Y HERRAMIENTAS)
// ----------------------------------------------------

window.copiarLink = function(link) {
    navigator.clipboard.writeText(link).then(() => {
        alert("¡Link copiado!");
    });
}

window.eliminarAuditoria = async function(id) {
    if(confirm("¿Estás seguro que querés eliminar esto?")) {
        await db.collection('auditorias').doc(id).delete();
    }
}

window.descargarUltimoPDF = function() {
    if (ultimoPDFId) window.descargarPDF(ultimoPDFId);
}

window.descargarPDF = async function(id) {
    try {
        const docSnapshot = await db.collection('auditorias').doc(id).get();
        if (!docSnapshot.exists) return;
        
        const data = docSnapshot.data();
        const base64PDFOriginal = data.pdfBase64;
        const base64Firma = data.firmaBase64;
        
        const existingPdfBytes = await fetch(base64PDFOriginal).then(res => res.arrayBuffer());
        const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
        
        const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        const fontNormal = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
        
        const pages = pdfDoc.getPages();
        const page = data.modoFirma === 'hoja_nueva' ? pdfDoc.addPage(PDFLib.PageSizes.A4) : pages[pages.length - 1];
        const { width, height } = page.getSize();
        
        let x = 50, y = 50;
        if (data.modoFirma !== 'hoja_nueva') {
            const pos = data.posicionFirma || 'abajo_izquierda';
            if (pos.endsWith('derecha')) x = width - 210;
            if (pos.endsWith('centro')) x = (width - 160) / 2;
            if (pos.startsWith('arriba')) y = height - 150;
            if (pos.startsWith('centro')) y = height / 2;
        } else {
            y = height - 50;
            page.drawText('CONSTANCIA DE FIRMA ELECTRÓNICA', { x: 50, y: y, size: 14, font: fontBold });
            y -= 40;
        }

        if (base64Firma) {
            const signatureImage = await pdfDoc.embedPng(base64Firma);
            page.drawImage(signatureImage, { x: x, y: y, width: 160, height: 80 });
        }
        
        const textY = data.modoFirma === 'hoja_nueva' ? y - 100 : y - 15;
        page.drawText(`Firmante: ${data.afiliadoNombre || 'N/A'}`, { x: x, y: textY, size: 9, font: fontBold });
        page.drawText(`DNI: ${data.afiliadoDNI || '---'}`, { x: x, y: textY - 10, size: 8, font: fontNormal });
        page.drawText(`Fecha: ${data.fechaFirma ? data.fechaFirma.toDate().toLocaleString('es-AR') : new Date().toLocaleString('es-AR')}`, { x: x, y: textY - 20, size: 8, font: fontNormal });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${data.nombreArchivo.replace('.pdf', '')}_FIRMADO.pdf`;
        link.click();
        
    } catch (error) {
        console.error(error);
        alert("Error al generar PDF.");
    }
}

// 5. TEMA CLARO/OSCURO
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.setAttribute('data-theme', savedTheme);
document.documentElement.setAttribute('data-theme', savedTheme);

if(themeToggle){
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeToggle.innerHTML = newTheme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    });
}
