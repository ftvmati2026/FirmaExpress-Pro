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
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();
const SUPER_ADMIN_EMAIL = "matias@firmaexpress.com";

if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

let currentTenantId = null;
let isSuperAdmin = false;
let listenerEmpresas = null;
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
const btnVaciarHistorial = document.getElementById('btnVaciarHistorial');

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

if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        auth.signOut();
    });
}

function iniciarModoSuperAdmin() {
    detenerListenersCliente();
    if (superAdminDashboard) superAdminDashboard.style.display = 'block';
    if (tenantDashboard) tenantDashboard.style.display = 'none';
    if (btnVolverAdmin) btnVolverAdmin.style.display = 'none';
    if (btnDownloadHeader) btnDownloadHeader.style.display = 'none';
    if (btnVaciarHistorial) btnVaciarHistorial.style.display = 'none';
    if (headerTitle) headerTitle.textContent = "Admin - FirmaExpress Pro";
    currentTenantId = null;
    restaurarBranding();
    cargarEmpresas();
}

async function iniciarModoCliente(tenantUid) {
    if (superAdminDashboard) superAdminDashboard.style.display = 'none';
    if (tenantDashboard) tenantDashboard.style.display = 'block';

    if (isSuperAdmin && btnVolverAdmin) {
        btnVolverAdmin.style.display = 'inline-flex';
    }

    currentTenantId = tenantUid;

    try {
        const doc = await db.collection('empresas').doc(tenantUid).get();
        if (doc.exists) {
            const data = doc.data();
            headerTitle.textContent = `Gestionando: ${data.nombre || 'Empresa'}`;
            aplicarBranding(data);
        } else {
            headerTitle.textContent = 'Gestionando: Empresa';
            restaurarBranding();
        }
    } catch (error) {
        console.error(error);
        headerTitle.textContent = 'Gestionando: Empresa';
    }

    cargarAuditoriasDeEmpresa();
    cargarHistorialDeEmpresa(tenantUid);
}

function detenerListenersCliente() {
    if (listenerAuditorias) {
        listenerAuditorias();
        listenerAuditorias = null;
    }
    if (listenerHistorial) {
        listenerHistorial();
        listenerHistorial = null;
    }
}

function aplicarBranding(data) {
    const root = document.documentElement;
    if (data.color) {
        root.style.setProperty('--primary-color', data.color);
        root.style.setProperty('--primary-hover', data.color);
    }

    const logoImg = document.getElementById('customLogo');
    const defaultIcon = document.getElementById('defaultLogoIcon');
    if (!logoImg || !defaultIcon) return;

    if (data.logoUrl) {
        logoImg.src = data.logoUrl;
        logoImg.style.display = 'block';
        defaultIcon.style.display = 'none';
    } else {
        logoImg.style.display = 'none';
        defaultIcon.style.display = 'block';
    }
}

function restaurarBranding() {
    const root = document.documentElement;
    root.style.removeProperty('--primary-color');
    root.style.removeProperty('--primary-hover');

    const logoImg = document.getElementById('customLogo');
    const defaultIcon = document.getElementById('defaultLogoIcon');
    if (logoImg) logoImg.style.display = 'none';
    if (defaultIcon) defaultIcon.style.display = 'block';
}

window.volverAlAdmin = function() {
    iniciarModoSuperAdmin();
};

window.abrirModalPerfil = function() {
    if (currentTenantId && isSuperAdmin) {
        abrirModalEmpresa(currentTenantId);
    }
};

// ----------------------------------------------------
// 2. GESTIÓN DE EMPRESAS (Solo Admin)
// ----------------------------------------------------

async function cargarEmpresas() {
    const list = document.getElementById('empresasList');
    if (!list) return;

    if (listenerEmpresas) listenerEmpresas();

    listenerEmpresas = db.collection('empresas').onSnapshot((snapshot) => {
        list.innerHTML = '';

        if (snapshot.empty) {
            list.innerHTML = `<tr><td colspan="3">No hay empresas registradas.</td></tr>`;
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${escapeHtml(data.logoUrl || '')}" style="width:30px; height:30px; border-radius:4px; object-fit:contain; background:#f0f0f0;" onerror="this.style.display='none'">
                        <div>
                            <strong>${escapeHtml(data.nombre || 'Sin nombre')}</strong><br>
                            <small style="color:var(--text-secondary)">${escapeHtml(data.whatsapp || 'Sin WhatsApp')}</small>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(data.email || 'Sin email')}</td>
                <td class="td-actions">
                    <button class="icon-btn" title="Gestionar Documentos" onclick="entrarComoEmpresa('${doc.id}')" style="color: var(--primary-color);">
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
    }, (error) => {
        console.error(error);
        list.innerHTML = `<tr><td colspan="3">Error al cargar empresas.</td></tr>`;
    });
}

window.entrarComoEmpresa = (id) => {
    currentTenantId = id;
    iniciarModoCliente(id);
};

window.eliminarEmpresa = async (id) => {
    if (!confirm("¿Eliminar empresa? Esto quita la empresa del panel, pero no borra el usuario de acceso en Firebase Auth.")) return;

    try {
        await db.collection('empresas').doc(id).delete();
    } catch (error) {
        console.error(error);
        alert("No se pudo eliminar la empresa.");
    }
};

window.abrirModalEmpresa = async (id = null) => {
    const modal = document.getElementById('modalEmpresa');
    const form = document.getElementById('formNuevaEmpresa');
    const passwordInput = document.getElementById('empPassword');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('editEmpresaId').value = id || '';
    document.getElementById('modalEmpresaTitle').innerHTML = id ? '<i class="fa-solid fa-pen"></i> Editar Empresa' : '<i class="fa-solid fa-plus"></i> Nueva Empresa';

    if (id) {
        try {
            const doc = await db.collection('empresas').doc(id).get();
            if (!doc.exists) {
                alert("La empresa no existe.");
                return;
            }
            const data = doc.data();
            document.getElementById('empNombre').value = data.nombre || '';
            document.getElementById('empWhatsapp').value = data.whatsapp || '';
            document.getElementById('empEmail').value = data.email || '';
            document.getElementById('empLogoUrl').value = data.logoUrl || '';
            document.getElementById('empColor').value = data.color || '#2563eb';
            document.getElementById('passGroup').style.display = 'none';
            document.getElementById('editActions').style.display = 'block';
            if (passwordInput) passwordInput.required = false;
        } catch (error) {
            console.error(error);
            alert("No se pudo abrir la empresa.");
            return;
        }
    } else {
        document.getElementById('passGroup').style.display = 'block';
        document.getElementById('editActions').style.display = 'none';
        if (passwordInput) passwordInput.required = true;
    }

    modal.style.display = 'flex';
};

window.cerrarModalEmpresa = () => {
    const modal = document.getElementById('modalEmpresa');
    if (modal) modal.style.display = 'none';
};

const formNuevaEmpresa = document.getElementById('formNuevaEmpresa');
if (formNuevaEmpresa) {
    formNuevaEmpresa.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('editEmpresaId').value;
        const submitButton = formNuevaEmpresa.querySelector('button[type="submit"]');
        const data = {
            nombre: document.getElementById('empNombre').value.trim(),
            whatsapp: document.getElementById('empWhatsapp').value.trim(),
            email: document.getElementById('empEmail').value.trim(),
            logoUrl: document.getElementById('empLogoUrl').value.trim(),
            color: document.getElementById('empColor').value || '#2563eb',
            activa: true
        };

        if (!data.nombre || !data.email) {
            alert("Completá el nombre y el email de la empresa.");
            return;
        }

        try {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
            }

            if (id) {
                data.actualizadoEn = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('empresas').doc(id).update(data);
            } else {
                const pass = document.getElementById('empPassword').value;
                if (!pass || pass.length < 6) {
                    alert("La clave debe tener al menos 6 caracteres.");
                    return;
                }

                const userCredential = await crearUsuarioEmpresa(data.email, pass);
                await db.collection('empresas').doc(userCredential.user.uid).set({
                    ...data,
                    uid: userCredential.user.uid,
                    creadoEn: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            cerrarModalEmpresa();
        } catch (error) {
            console.error(error);
            alert("Error al guardar empresa: " + friendlyFirebaseError(error));
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = 'Guardar';
            }
        }
    });
}

async function crearUsuarioEmpresa(email, password) {
    const secondaryName = `empresa-create-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const secondaryApp = firebase.initializeApp(firebaseConfig, secondaryName);
    const secondaryAuth = firebase.auth(secondaryApp);

    try {
        const credential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
        const user = {
            uid: credential.user.uid,
            email: credential.user.email
        };
        await secondaryAuth.signOut();
        return { user };
    } finally {
        await secondaryApp.delete();
    }
}

window.enviarResetClave = async () => {
    const email = document.getElementById('empEmail')?.value.trim();
    if (!email) {
        alert("Primero cargá el email de la empresa.");
        return;
    }

    try {
        await auth.sendPasswordResetEmail(email);
        alert("Se envió el email para reestablecer la clave.");
    } catch (error) {
        console.error(error);
        alert("No se pudo enviar el email de recuperación: " + friendlyFirebaseError(error));
    }
};

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
            if (isSignedFileName(file.name)) {
                rejectSelectedPdf("Este archivo parece ser un PDF ya firmado. Subí el PDF original sin firma.");
                return;
            }

            fileNameDisplay.textContent = file.name;
            fileNameDisplay.style.color = 'var(--primary-color)';
            fileNameDisplay.style.fontWeight = 'bold';
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

        if (!currentTenantId) {
            alert("Error: No se detectó la empresa.");
            return;
        }
        if (!file) {
            alert("Seleccioná un PDF.");
            return;
        }

        const modoFirmaElegido = document.querySelector('input[name="modoFirma"]:checked')?.value || 'misma_hoja';
        const posicionFirma = document.getElementById('posicionFirma')?.value || 'abajo_derecha';

        try {
            btnUpload.disabled = true;
            btnUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';

            const pdfBytes = await fileToArrayBuffer(file);
            const signedReason = await getSignedPdfReason(file, pdfBytes);
            if (signedReason) {
                rejectSelectedPdf(`Este archivo parece ser un PDF ya firmado (${signedReason}). Para evitar que se mezclen firmas de otra empresa o de otro tramite, subi siempre el PDF original sin firma.`);
                return;
            }
            if (isLikelySignedPdf(file, pdfBytes)) {
                rejectSelectedPdf("Este archivo parece ser un PDF ya firmado. Subí siempre el PDF original sin firma.");
                return;
            }

            const base64PDF = arrayBufferToDataUrl(pdfBytes, file.type || 'application/pdf');

            await db.collection('auditorias').add({
                tenantId: currentTenantId,
                modoFirma: modoFirmaElegido,
                posicionFirma,
                nombreArchivo: file.name,
                pdfBase64: base64PDF,
                estado: 'Pendiente',
                fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
                firmaBase64: null
            });

            alert("¡Documento guardado con éxito!");
            uploadForm.reset();
            fileNameDisplay.textContent = 'Seleccionar PDF';
            fileNameDisplay.style.color = '';
            fileNameDisplay.style.fontWeight = '';
            btnUpload.disabled = true;
        } catch (error) {
            console.error(error);
            alert('Error al subir el archivo: ' + friendlyFirebaseError(error));
            btnUpload.disabled = false;
        } finally {
            btnUpload.innerHTML = '<i class="fa-solid fa-link"></i> Generar Link para Cliente';
        }
    });
}

function rejectSelectedPdf(message) {
    alert(message);
    if (pdfInput) pdfInput.value = '';
    if (fileNameDisplay) {
        fileNameDisplay.textContent = 'Seleccionar PDF';
        fileNameDisplay.style.color = '';
        fileNameDisplay.style.fontWeight = '';
    }
    if (btnUpload) {
        btnUpload.disabled = true;
        btnUpload.innerHTML = '<i class="fa-solid fa-link"></i> Generar Link para Cliente';
    }
}

function fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function arrayBufferToDataUrl(buffer, mimeType) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return `data:${mimeType};base64,${btoa(binary)}`;
}

async function getSignedPdfReason(file, buffer) {
    if (isSignedFileName(file?.name || '')) return 'el nombre contiene FIRMADO';
    if (hasRawSignatureMarker(buffer)) return 'contiene una marca de FirmaExpress';

    const pdfText = await extractPdfText(buffer);
    if (hasSignatureStampText(pdfText)) return 'contiene una constancia de firma';

    return '';
}

function isSignedFileName(fileName) {
    return /(^|[._\-\s])firmad[oa]([._\-\s]|\.pdf$|$)/i.test(fileName || '');
}

function hasRawSignatureMarker(buffer) {
    const sampleBytes = new Uint8Array(buffer).subarray(0, 5000000);
    const sampleText = new TextDecoder('latin1').decode(sampleBytes);
    return hasSignatureStampText(sampleText);
}

async function extractPdfText(buffer) {
    if (!window.pdfjsLib) return '';

    try {
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) });
        const pdf = await loadingTask.promise;
        const parts = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const textContent = await page.getTextContent();
            parts.push(textContent.items.map(item => item.str || '').join(' '));
        }

        return parts.join(' ');
    } catch (error) {
        console.warn('No se pudo leer el texto del PDF para validar si ya estaba firmado.', error);
        return '';
    }
}

function hasSignatureStampText(text) {
    const normalized = String(text || '').replace(/\s+/g, ' ');
    if (/FirmaExpress Pro|CONSTANCIA DE FIRMA|Documento firmado con FirmaExpress/i.test(normalized)) return true;
    return /Firmante\s*:/i.test(normalized) && /DNI\s*:/i.test(normalized) && /Fecha\s*:/i.test(normalized);
}

function isLikelySignedPdf(file, buffer) {
    return isSignedFileName(file?.name || '') || hasRawSignatureMarker(buffer);
}

function cargarAuditoriasDeEmpresa() {
    const auditsList = document.getElementById('auditsList');
    if (!auditsList || !currentTenantId) return;

    if (listenerAuditorias) listenerAuditorias();
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

            docs.sort((a, b) => getTime(b.fechaCreacion) - getTime(a.fechaCreacion));

            if (docs.length === 0) {
                auditsList.innerHTML = `<tr><td colspan="3">No hay documentos pendientes.</td></tr>`;
            }

            docs.forEach((data) => {
                const tr = document.createElement('tr');
                const baseURL = window.location.href.substring(0, window.location.href.lastIndexOf("/") + 1);
                const linkACompartir = `${baseURL}firmar.html?id=${data.id}`;
                const fecha = toDate(data.fechaCreacion);

                tr.innerHTML = `
                    <td><strong>${escapeHtml(data.nombreArchivo || 'Documento')}</strong></td>
                    <td>
                        <div class="status-info-container">
                            <span class="badge badge-pending">Pendiente</span>
                            <span class="status-date">${escapeHtml(formatDate(fecha))}</span>
                            <span class="status-age">${escapeHtml(formatRelativeDate(fecha))}</span>
                        </div>
                    </td>
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
        }, (error) => {
            console.error(error);
            auditsList.innerHTML = `<tr><td colspan="3">Error al cargar pendientes.</td></tr>`;
        });
}

function cargarHistorialDeEmpresa(tenantUid) {
    const historyList = document.getElementById('historyList');
    if (!historyList || !tenantUid) return;

    if (listenerHistorial) listenerHistorial();

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

            docs.sort((a, b) => getTime(b.fechaFirma) - getTime(a.fechaFirma));

            if (docs.length === 0) {
                historyList.innerHTML = `<tr><td colspan="4">No hay documentos firmados todavía.</td></tr>`;
                ultimoPDFId = null;
                if (btnDownloadHeader) btnDownloadHeader.style.display = 'none';
                if (btnVaciarHistorial) btnVaciarHistorial.style.display = 'none';
                return;
            }

            ultimoPDFId = docs[0].id;
            if (btnDownloadHeader) btnDownloadHeader.style.display = 'inline-flex';
            if (btnVaciarHistorial) btnVaciarHistorial.style.display = 'inline-flex';

            docs.forEach((data) => {
                const tr = document.createElement('tr');
                const fechaFirma = toDate(data.fechaFirma);

                tr.innerHTML = `
                    <td><strong>${escapeHtml(data.nombreArchivo || 'Documento')}</strong></td>
                    <td>${escapeHtml(formatDateTime(fechaFirma))}</td>
                    <td><span class="badge badge-signed">${escapeHtml(data.afiliadoNombre || 'Firmante')}</span></td>
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
        }, (error) => {
            console.error(error);
            historyList.innerHTML = `<tr><td colspan="4">Error al cargar historial.</td></tr>`;
        });
}

// ----------------------------------------------------
// 4. DESCARGA Y HERRAMIENTAS
// ----------------------------------------------------

window.copiarLink = function(link) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(link).then(() => {
            alert("¡Link copiado!");
        }).catch(() => copiarLinkFallback(link));
        return;
    }

    copiarLinkFallback(link);
};

function copiarLinkFallback(link) {
    const input = document.createElement('textarea');
    input.value = link;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    alert("¡Link copiado!");
}

window.eliminarAuditoria = async function(id) {
    if (!confirm("¿Eliminar este documento del sistema?")) return;

    try {
        await db.collection('auditorias').doc(id).delete();
    } catch (error) {
        console.error(error);
        alert("No se pudo eliminar el documento.");
    }
};

window.vaciarHistorial = async function() {
    if (!currentTenantId) return;
    if (!confirm("¿Vaciar todo el historial de documentos firmados de esta empresa?")) return;

    const buttonText = btnVaciarHistorial?.innerHTML;
    try {
        if (btnVaciarHistorial) {
            btnVaciarHistorial.disabled = true;
            btnVaciarHistorial.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Vaciando...';
        }

        const snapshot = await db.collection('auditorias')
            .where("tenantId", "==", currentTenantId)
            .where("estado", "==", "Firmado")
            .get();

        if (snapshot.empty) {
            alert("No hay documentos firmados para eliminar.");
            return;
        }

        let batch = db.batch();
        let operations = 0;
        const commits = [];

        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
            operations++;
            if (operations === 450) {
                commits.push(batch.commit());
                batch = db.batch();
                operations = 0;
            }
        });

        if (operations > 0) commits.push(batch.commit());
        await Promise.all(commits);
        alert("Historial vaciado.");
    } catch (error) {
        console.error(error);
        alert("No se pudo vaciar el historial.");
    } finally {
        if (btnVaciarHistorial) {
            btnVaciarHistorial.disabled = false;
            btnVaciarHistorial.innerHTML = buttonText || '<i class="fa-solid fa-trash-can"></i> Vaciar Historial';
        }
    }
};

window.descargarUltimoPDF = function() {
    if (ultimoPDFId) descargarPDF(ultimoPDFId);
};

window.descargarPDF = async function(id) {
    try {
        const docSnapshot = await db.collection('auditorias').doc(id).get();
        if (!docSnapshot.exists) {
            alert("El documento ya no existe.");
            return;
        }

        const data = docSnapshot.data();
        if (currentTenantId && data.tenantId !== currentTenantId) {
            alert("Este documento pertenece a otra empresa. Volvé a entrar a la empresa correcta y descargalo desde su historial.");
            return;
        }

        const existingPdfBytes = await fetch(data.pdfBase64).then(res => res.arrayBuffer());
        const pageAnalyses = await analyzePdfPages(existingPdfBytes.slice(0));
        const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes.slice(0));
        const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        const fontNormal = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();
        const modoFirma = data.modoFirma || 'misma_hoja';
        const base64Firma = data.firmaBase64;
        const firmaTransparente = base64Firma ? await makeSignatureBackgroundTransparent(base64Firma) : null;
        const signatureImage = firmaTransparente ? await pdfDoc.embedPng(firmaTransparente) : null;

        if (modoFirma === 'todas_las_hojas') {
            pages.forEach((page, index) => {
                drawSignatureBlock(page, signatureImage, fontBold, fontNormal, data, pageAnalyses[index] || null);
            });
        } else if (modoFirma === 'hoja_nueva') {
            const legalPage = pdfDoc.addPage(PDFLib.PageSizes.A4);
            legalPage.drawText('CONSTANCIA DE FIRMA ELECTRÓNICA', {
                x: 50,
                y: legalPage.getSize().height - 60,
                size: 14,
                font: fontBold
            });
            legalPage.drawText(`Documento original: ${safePdfText(data.nombreArchivo || 'Documento')}`, {
                x: 50,
                y: legalPage.getSize().height - 85,
                size: 9,
                font: fontNormal
            });
            drawSignatureBlock(legalPage, signatureImage, fontBold, fontNormal, data, []);
        } else {
            drawSignatureBlock(pages[pages.length - 1], signatureImage, fontBold, fontNormal, data, pageAnalyses[pages.length - 1] || null);
        }

        const baseName = (data.nombreArchivo || 'documento.pdf').replace(/\.pdf$/i, '').replace(/_FIRMADO$/i, '');
        pdfDoc.setTitle(`${baseName}_FIRMADO.pdf`);
        pdfDoc.setAuthor(safePdfText(data.afiliadoNombre || 'Firmante'));
        pdfDoc.setSubject('Documento firmado con FirmaExpress Pro');
        pdfDoc.setKeywords(['FirmaExpress Pro', 'Documento firmado']);
        pdfDoc.setCreator('FirmaExpress Pro');
        pdfDoc.setProducer('FirmaExpress Pro');

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl;
        link.download = `${baseName}_FIRMADO.pdf`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
        console.error(error);
        alert("Error al generar PDF.");
    }
};

function drawSignatureBlock(page, signatureImage, fontBold, fontNormal, data, pageAnalysis = null) {
    const placement = getSmartSignaturePlacement(page, data.posicionFirma, pageAnalysis);
    const { x, y, signatureWidth, signatureHeight, scale } = placement;
    const fechaFirma = formatDateTime(toDate(data.fechaFirma) || new Date());
    const boldSize = 9 * scale;
    const normalSize = 8 * scale;
    const lineGap = 11 * scale;

    if (signatureImage) {
        page.drawImage(signatureImage, {
            x,
            y,
            width: signatureWidth,
            height: signatureHeight
        });
    }

    const textY = Math.max(24, y - (14 * scale));
    page.drawText(`Firmante: ${safePdfText(data.afiliadoNombre || 'N/A')}`, {
        x,
        y: textY,
        size: boldSize,
        font: fontBold
    });
    page.drawText(`DNI: ${safePdfText(data.afiliadoDNI || '---')}`, {
        x,
        y: textY - lineGap,
        size: normalSize,
        font: fontNormal
    });
    page.drawText(`Fecha: ${safePdfText(fechaFirma)}`, {
        x,
        y: textY - (lineGap * 2),
        size: normalSize,
        font: fontNormal
    });
}

async function analyzePdfPages(buffer) {
    if (!window.pdfjsLib) return [];

    try {
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const pdf = await loadingTask.promise;
        const pages = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 1 });
            const renderScale = 0.75;
            const renderViewport = page.getViewport({ scale: renderScale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(renderViewport.width);
            canvas.height = Math.ceil(renderViewport.height);
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;

            const textContent = await page.getTextContent();
            const textBoxes = textContent.items
                .filter(item => item.str && item.str.trim())
                .map((item) => {
                    const transformed = pdfjsLib.Util.transform(viewport.transform, item.transform);
                    const fontHeight = Math.max(6, Math.abs(transformed[3]) || item.height || 8);
                    const x = transformed[4];
                    const y = viewport.height - transformed[5];
                    const width = Math.max(1, item.width || Math.abs(transformed[0]) || 0);
                    const height = fontHeight;
                    return {
                        x: x - 4,
                        y: y - 6,
                        width: width + 8,
                        height: height + 12
                    };
                });

            pages.push({
                width: viewport.width,
                height: viewport.height,
                renderScale,
                imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
                textBoxes
            });
        }

        return pages;
    } catch (error) {
        console.warn('No se pudo analizar el texto del PDF para ubicar la firma.', error);
        return [];
    }
}

function getSmartSignaturePlacement(page, position, pageAnalysis) {
    const baseWidth = 160;
    const baseHeight = 80;
    const scales = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.45];
    let bestPlacement = null;

    for (const scale of scales) {
        const signatureWidth = baseWidth * scale;
        const signatureHeight = baseHeight * scale;
        const candidates = getSignatureCandidates(page, position, signatureWidth, signatureHeight, scale);

        for (const candidate of candidates) {
            const rect = getSignatureBlockRect(candidate.x, candidate.y, signatureWidth, signatureHeight, scale);
            const score = getPlacementOverlapScore(rect, pageAnalysis) + candidate.distancePenalty;
            const placement = { ...candidate, signatureWidth, signatureHeight, scale, score };
            if (!bestPlacement || score < bestPlacement.score) bestPlacement = placement;
        }
    }

    return bestPlacement || {
        ...getSignatureCoordinates(page, position, baseWidth, baseHeight),
        signatureWidth: baseWidth,
        signatureHeight: baseHeight,
        scale: 1
    };
}

function getSignatureCandidates(page, position, signatureWidth, signatureHeight, scale) {
    const { width, height } = page.getSize();
    const blockHeight = signatureHeight + (42 * scale);
    const normalizedPosition = position || 'abajo_derecha';
    const [, horizontal = 'derecha'] = normalizedPosition.split('_');
    const vertical = normalizedPosition.startsWith('centro') ? 'centro' : normalizedPosition.split('_')[0];
    const base = getSignatureCoordinates(page, position, signatureWidth, signatureHeight);
    const minBlockY = 16;
    const minX = getHorizontalRange(horizontal, width, signatureWidth).min;
    const maxX = getHorizontalRange(horizontal, width, signatureWidth).max;
    const yRange = getVerticalRange(vertical, height, blockHeight, scale);
    const minImageY = yRange.min + (36 * scale);
    const maxImageY = yRange.max + (36 * scale);
    const seen = new Set();
    const candidates = [];
    const stepX = 18;
    const stepY = 12;

    for (let y = minImageY; y <= maxImageY; y += stepY) {
        for (let x = minX; x <= maxX; x += stepX) {
            const clampedX = clamp(x, minX, maxX);
            const clampedY = clamp(y, minBlockY + (36 * scale), maxImageY);
            const key = `${Math.round(clampedX)}:${Math.round(clampedY)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            candidates.push({
                x: clampedX,
                y: clampedY,
                distancePenalty: getPlacementDistancePenalty(base.x, base.y, clampedX, clampedY, scale)
            });
        }
    }

    for (const point of [
        { x: base.x, y: base.y },
        { x: base.x, y: minImageY },
        { x: base.x, y: maxImageY },
        { x: minX, y: base.y },
        { x: maxX, y: base.y }
    ]) {
        const x = clamp(point.x, minX, maxX);
        const y = clamp(point.y, minImageY, maxImageY);
        const key = `${Math.round(x)}:${Math.round(y)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({
            x,
            y,
            distancePenalty: getPlacementDistancePenalty(base.x, base.y, x, y, scale)
        });
    }

    return candidates.sort((a, b) => a.distancePenalty - b.distancePenalty);
}

function getHorizontalRange(horizontal, pageWidth, signatureWidth) {
    const margin = 20;
    const maxX = Math.max(margin, pageWidth - signatureWidth - margin);
    if (horizontal === 'izquierda') {
        return { min: margin, max: Math.max(margin, Math.min(maxX, pageWidth * 0.45)) };
    }
    if (horizontal === 'centro') {
        return {
            min: Math.max(margin, (pageWidth - signatureWidth) * 0.25),
            max: Math.min(maxX, (pageWidth - signatureWidth) * 0.75)
        };
    }
    return { min: Math.max(margin, pageWidth * 0.52), max: maxX };
}

function getVerticalRange(vertical, pageHeight, blockHeight, scale) {
    const margin = 16;
    const maxBlockY = Math.max(margin, pageHeight - blockHeight - margin);
    if (vertical === 'arriba') {
        return { min: Math.max(margin, pageHeight * 0.55), max: maxBlockY };
    }
    if (vertical === 'centro') {
        return {
            min: Math.max(margin, pageHeight * 0.22),
            max: Math.min(maxBlockY, pageHeight * 0.78)
        };
    }
    return { min: margin, max: Math.min(maxBlockY, pageHeight * 0.45) };
}

function getPlacementDistancePenalty(baseX, baseY, x, y, scale) {
    const distance = Math.hypot(baseX - x, baseY - y);
    return distance * 0.05 + (1 - scale) * 3;
}

function getSignatureBlockRect(x, y, signatureWidth, signatureHeight, scale) {
    const padding = 5;
    return {
        x: x - padding,
        y: y - (36 * scale) - padding,
        width: signatureWidth + (padding * 2),
        height: signatureHeight + (36 * scale) + (padding * 2)
    };
}

function getPlacementOverlapScore(rect, pageAnalysis) {
    if (!pageAnalysis) return 0;

    const textBoxes = pageAnalysis.textBoxes || [];
    const textScore = textBoxes.reduce((score, box) => score + getOverlapArea(rect, box), 0);
    const pixelScore = getRenderedContentScore(rect, pageAnalysis);
    return (textScore * 20) + pixelScore;
}

function getRenderedContentScore(rect, pageAnalysis) {
    const imageData = pageAnalysis?.imageData;
    if (!imageData) return 0;

    const scale = pageAnalysis.renderScale || 1;
    const pageHeight = pageAnalysis.height || (imageData.height / scale);
    const x0 = clamp(Math.floor(rect.x * scale), 0, imageData.width - 1);
    const x1 = clamp(Math.ceil((rect.x + rect.width) * scale), 0, imageData.width);
    const y0 = clamp(Math.floor((pageHeight - rect.y - rect.height) * scale), 0, imageData.height - 1);
    const y1 = clamp(Math.ceil((pageHeight - rect.y) * scale), 0, imageData.height);
    const pixels = imageData.data;
    let contentPixels = 0;
    const step = 2;

    for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
            const index = ((y * imageData.width) + x) * 4;
            const red = pixels[index];
            const green = pixels[index + 1];
            const blue = pixels[index + 2];
            const alpha = pixels[index + 3];
            if (alpha > 10 && (red < 248 || green < 248 || blue < 248)) {
                contentPixels++;
            }
        }
    }

    return contentPixels;
}

function getOverlapArea(a, b) {
    const left = Math.max(a.x, b.x);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.max(a.y, b.y);
    const top = Math.min(a.y + a.height, b.y + b.height);
    if (right <= left || top <= bottom) return 0;
    return (right - left) * (top - bottom);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

async function makeSignatureBackgroundTransparent(dataUrl) {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth || image.width;
            canvas.height = image.naturalHeight || image.height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;
            for (let i = 0; i < pixels.length; i += 4) {
                const red = pixels[i];
                const green = pixels[i + 1];
                const blue = pixels[i + 2];
                const alpha = pixels[i + 3];
                if (alpha > 0 && red > 245 && green > 245 && blue > 245) {
                    pixels[i + 3] = 0;
                }
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        image.onerror = () => resolve(dataUrl);
        image.src = dataUrl;
    });
}

function getSignatureCoordinates(page, position, signatureWidth, signatureHeight) {
    const { width, height } = page.getSize();
    const normalizedPosition = position || 'abajo_derecha';
    const [, horizontal = 'derecha'] = normalizedPosition.split('_');
    const vertical = normalizedPosition.startsWith('centro') ? 'centro' : normalizedPosition.split('_')[0];
    const marginX = 50;
    const marginBottom = 70;

    let x = marginX;
    if (horizontal === 'centro') x = (width - signatureWidth) / 2;
    if (horizontal === 'derecha') x = width - signatureWidth - marginX;

    let y = marginBottom;
    if (vertical === 'centro') y = (height - signatureHeight) / 2;
    if (vertical === 'arriba') y = height - signatureHeight - marginBottom;

    return {
        x: Math.max(20, x),
        y: Math.max(70, y)
    };
}

// ----------------------------------------------------
// 5. UTILIDADES
// ----------------------------------------------------

function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.toMillis === 'function') return new Date(value.toMillis());
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getTime(value) {
    const date = toDate(value);
    return date ? date.getTime() : 0;
}

function formatDate(date) {
    if (!date) return 'Fecha pendiente';
    return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatDateTime(date) {
    if (!date) return 'Recién';
    return date.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatRelativeDate(date) {
    if (!date) return 'Recién';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (isSameDay(now, date)) return 'Hoy';
    if (diffDays === 1 || isYesterday(now, date)) return 'Ayer';
    if (diffMinutes < 60) return diffMinutes <= 1 ? 'Hace 1 minuto' : `Hace ${diffMinutes} minutos`;
    if (diffHours < 24) return diffHours === 1 ? 'Hace 1 hora' : `Hace ${diffHours} horas`;
    return diffDays === 1 ? 'Hace 1 día' : `Hace ${diffDays} días`;
}

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

function isYesterday(now, date) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return isSameDay(yesterday, date);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safePdfText(value) {
    return String(value).replace(/[^\x20-\x7EÀ-ÿ]/g, '');
}

function friendlyFirebaseError(error) {
    const code = error?.code || '';
    if (code.includes('auth/email-already-in-use')) return 'ese email ya está registrado.';
    if (code.includes('auth/invalid-email')) return 'el email no es válido.';
    if (code.includes('auth/weak-password')) return 'la clave es demasiado débil.';
    if (code.includes('permission-denied')) return 'no tenés permisos para hacer esta acción.';
    return error?.message || 'error desconocido.';
}

// TEMA
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.setAttribute('data-theme', savedTheme);
document.documentElement.setAttribute('data-theme', savedTheme);

if (themeToggle) {
    themeToggle.innerHTML = savedTheme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeToggle.innerHTML = newTheme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    });
}
