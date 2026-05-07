/* Configuración de Firebase */
const firebaseConfig = {
    apiKey: "AIzaSyBwwELPPJ4klVTcqTcZzAPfUR-q5A4_ZDk",
    authDomain: "firmaexpress-pro.firebaseapp.com",
    projectId: "firmaexpress-pro",
    storageBucket: "firmaexpress-pro.firebasestorage.app",
    messagingSenderId: "101193300557",
    appId: "1:101193300557:web:e8d8dab3d86b6cf2caba04",
    measurementId: "G-3DK87KPXHZ"
};

// Iniciar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Variables globales de entorno SaaS
let currentUser = null;
const SUPER_ADMIN_EMAIL = "matias@firmaexpress.com"; // <-- ESTE ES TU EMAIL MAESTRO
let currentTenantId = null; // ID de la empresa que se esta gestionando (tuya o de un cliente)
let listenerAuditorias = null; // Guardamos el listener para poder apagarlo al cambiar de vista

// Referencias UI Principales
const superAdminDashboard = document.getElementById('superAdminDashboard');
const tenantDashboard = document.getElementById('tenantDashboard');
const btnVolverAdmin = document.getElementById('btnVolverAdmin');
const headerTitle = document.getElementById('headerTitle');
const btnPerfil = document.getElementById('btnPerfil');
const btnDownloadHeader = document.getElementById('btnDownloadPDF');
const historyCounter = document.getElementById('historyCounter');

// ----------------------------------------------------
// 1. SISTEMA DE RUTEO Y AUTENTICACIÓN (EL CEREBRO)
// ----------------------------------------------------
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        const userEmailDisplay = document.getElementById('userEmailDisplay');
        if(userEmailDisplay) userEmailDisplay.textContent = user.email;
        
        // Decidir a dónde lo mandamos según quién es
        if (user.email === SUPER_ADMIN_EMAIL) {
            iniciarModoSuperAdmin();
        } else {
            // Es un cliente, su ID de base de datos es su UID de autenticacion
            currentTenantId = user.uid; 
            iniciarModoCliente(user.uid);
        }
    } else {
        window.location.href = 'login.html';
    }
});

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        auth.signOut();
    });
}

// ----------------------------------------------------
// 2. LÓGICA DEL SUPER ADMINISTRADOR (VOS)
// ----------------------------------------------------
function iniciarModoSuperAdmin() {
    currentTenantId = null; // No estamos viendo ningun cliente especifico
    superAdminDashboard.style.display = 'block';
    tenantDashboard.style.display = 'none';
    btnVolverAdmin.style.display = 'none';
    headerTitle.textContent = "FirmaExpress Pro - Panel Central";
    
    cargarListaEmpresas();
}

function cargarListaEmpresas() {
    const empresasList = document.getElementById('empresasList');
    if (!empresasList) return;

    db.collection('empresas').orderBy('fechaCreacion', 'desc').onSnapshot(snapshot => {
        empresasList.innerHTML = '';
        if (snapshot.empty) {
            empresasList.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-secondary);">No tenés ninguna empresa cliente registrada todavía.</td></tr>';
            return;
        }
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const tr = document.createElement('tr');
            
            // Si no existe la propiedad activa, asumimos true por compatibilidad
            const isActiva = data.activa !== false; 
            
            const btnActivarStr = isActiva
                ? `<button class="btn" style="padding: 5px 15px; font-size: 0.9rem; background: var(--danger-color); color: white;" onclick="toggleEstadoEmpresa('${doc.id}', true)">
                       <i class="fa-solid fa-ban"></i> Suspender
                   </button>`
                : `<button class="btn" style="padding: 5px 15px; font-size: 0.9rem; background: var(--success-color); color: white;" onclick="toggleEstadoEmpresa('${doc.id}', false)">
                       <i class="fa-solid fa-check"></i> Activar
                   </button>`;

            tr.innerHTML = `
                <td>
                    <strong>${data.nombre}</strong> ${!isActiva ? '<span style="color:red; font-size: 0.8rem; margin-left: 5px;">(Suspendida)</span>' : ''}
                    <br>
                    <a href="https://wa.me/${data.whatsapp}" target="_blank" style="font-size: 0.8rem; color: var(--success-color); text-decoration: none;">
                        <i class="fa-brands fa-whatsapp"></i> ${data.whatsapp || 'Sin WhatsApp'}
                    </a>
                </td>
                <td>${data.email}</td>
                <td style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="btn btn-primary" style="padding: 5px 12px; font-size: 0.8rem;" onclick="entrarComoEmpresa('${doc.id}', '${data.nombre}')">
                        <i class="fa-solid fa-eye"></i> Entrar
                    </button>
                    <button class="btn" style="padding: 5px 12px; font-size: 0.8rem; background: var(--text-secondary); color: white;" onclick="abrirModalEmpresa('${doc.id}')">
                        <i class="fa-solid fa-pen-to-square"></i> Editar
                    </button>
                    ${btnActivarStr}
                    <button class="btn" style="padding: 5px 12px; font-size: 0.8rem; background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color);" onclick="eliminarEmpresa('${doc.id}', '${data.nombre}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;
            empresasList.appendChild(tr);
        });
    });
}

window.eliminarEmpresa = async function(id, nombre) {
    if (confirm(`⚠️ MODO DIOS: ¿Estás ABSOLUTAMENTE seguro de eliminar a "${nombre}"?\n\nEsta acción borrará su perfil y no podrá volver a entrar al sistema.`)) {
        try {
            await db.collection('empresas').doc(id).delete();
            alert("Cuenta eliminada correctamente.");
        } catch (error) {
            alert("Error al eliminar: " + error.message);
        }
    }
}

window.toggleEstadoEmpresa = async function(id, estadoActual) {
    const accion = estadoActual ? 'suspender' : 'activar';
    if(confirm(`¿Estás seguro que querés ${accion} el acceso a esta empresa?`)) {
        try {
            await db.collection('empresas').doc(id).update({
                activa: !estadoActual
            });
        } catch (error) {
            alert("Error al cambiar el estado: " + error.message);
        }
    }
}

// Lógica del Modal para crear/editar clientes
window.abrirModalEmpresa = async (id = null) => {
    const modal = document.getElementById('modalEmpresa');
    const form = document.getElementById('formNuevaEmpresa');
    const title = document.getElementById('modalEmpresaTitle');
    const sub = document.getElementById('modalEmpresaSub');
    const passGroup = document.getElementById('passGroup');
    const editActions = document.getElementById('editActions');
    const btnGuardar = document.getElementById('btnGuardarEmpresa');
    
    form.reset();
    document.getElementById('editEmpresaId').value = id || '';
    
    if (id) {
        title.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar Cliente';
        sub.innerText = 'Modificá los datos comerciales de este cliente.';
        passGroup.style.display = 'none'; // No se cambia la clave por acá
        editActions.style.display = 'block';
        btnGuardar.textContent = "Guardar Cambios";
        
        // Cargar datos
        const doc = await db.collection('empresas').doc(id).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('empNombre').value = data.nombre || '';
            document.getElementById('empEmail').value = data.email || '';
            document.getElementById('empWhatsapp').value = data.whatsapp || '';
            document.getElementById('empLogoUrl').value = data.logoUrl || '';
            document.getElementById('empColor').value = data.color || '#2563eb'; // Color por defecto si no tiene
            document.getElementById('empEmail').disabled = true; // El email es el ID de auth, mejor no tocarlo
            
            // Mostrar preview si ya tiene logo
            if (data.logoUrl) {
                document.getElementById('logoPreview').src = data.logoUrl;
                document.getElementById('logoPreviewContainer').style.display = 'block';
            } else {
                document.getElementById('logoPreviewContainer').style.display = 'none';
            }
        }
    } else {
        title.innerHTML = '<i class="fa-solid fa-building"></i> Dar de Alta Cliente';
        sub.innerText = 'Creá el usuario para que el estudio/empresa pueda ingresar a su propio panel privado.';
        passGroup.style.display = 'block';
        editActions.style.display = 'none';
        document.getElementById('empEmail').disabled = false;
        btnGuardar.textContent = "Crear Cliente y Panel";
    }
    
    modal.style.display = 'flex';
}

window.cerrarModalEmpresa = () => {
    document.getElementById('modalEmpresa').style.display = 'none';
    document.getElementById('formNuevaEmpresa').reset();
    document.getElementById('logoPreview').src = '';
    document.getElementById('logoPreviewContainer').style.display = 'none';
}

// Manejo de carga de logo local
const empLogoFile = document.getElementById('empLogoFile');
if (empLogoFile) {
    empLogoFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const base64 = await fileToBase64(file);
                document.getElementById('logoPreview').src = base64;
                document.getElementById('logoPreviewContainer').style.display = 'block';
                document.getElementById('empLogoUrl').value = ''; // Limpiamos URL si sube archivo
            } catch (error) {
                alert("Error al cargar la imagen");
            }
        }
    });
}

window.quitarLogoPreview = () => {
    document.getElementById('logoPreview').src = '';
    document.getElementById('logoPreviewContainer').style.display = 'none';
    document.getElementById('empLogoFile').value = '';
    document.getElementById('empLogoUrl').value = '';
};

// Enviar email de reset de clave (para el Super Admin)
window.mandarResetClave = async () => {
    const email = document.getElementById('empEmail').value;
    if (confirm(`¿Querés enviarle un email a ${email} para que reestablezca su contraseña?`)) {
        try {
            await auth.sendPasswordResetEmail(email);
            alert("Email enviado correctamente.");
        } catch (error) {
            alert("Error: " + error.message);
        }
    }
}

const formNuevaEmpresa = document.getElementById('formNuevaEmpresa');
if (formNuevaEmpresa) {
    formNuevaEmpresa.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnGuardar = document.getElementById('btnGuardarEmpresa');
        const id = document.getElementById('editEmpresaId').value;
        
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        
        const nombre = document.getElementById('empNombre').value;
        const email = document.getElementById('empEmail').value;
        const whatsapp = document.getElementById('empWhatsapp').value;
        const color = document.getElementById('empColor').value;
        
        // Lógica de Logo: Prioridad al archivo subido (Base64) o URL manual
        let logoUrl = document.getElementById('empLogoUrl').value;
        const previewSrc = document.getElementById('logoPreview').src;
        
        // Si el preview tiene un Base64 o la URL manual está vacía pero hay preview, usamos el preview
        if (previewSrc && (previewSrc.startsWith('data:') || !logoUrl)) {
            logoUrl = previewSrc;
        }
        
        try {
            if (id) {
                // ACTUALIZAR EXISTENTE
                await db.collection('empresas').doc(id).update({
                    nombre: nombre,
                    whatsapp: whatsapp,
                    logoUrl: logoUrl,
                    color: color
                });
                alert("Cliente actualizado correctamente.");
            } else {
                // CREAR NUEVO
                const password = document.getElementById('empPassword').value;
                if (!password) {
                    alert("Debes asignar una contraseña inicial.");
                    btnGuardar.disabled = false;
                    btnGuardar.textContent = "Crear Cliente y Panel";
                    return;
                }

                const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
                    method: 'POST',
                    body: JSON.stringify({ email, password, returnSecureToken: true }),
                    headers: { 'Content-Type': 'application/json' }
                });
                const userData = await res.json();
                
                if (userData.error) {
                    alert("Error al crear usuario: " + userData.error.message);
                    btnGuardar.disabled = false;
                    btnGuardar.textContent = "Crear Cliente y Panel";
                    return;
                }
                
                const nuevoUid = userData.localId; 
                
                await db.collection('empresas').doc(nuevoUid).set({
                    nombre: nombre,
                    email: email,
                    whatsapp: whatsapp,
                    logoUrl: logoUrl,
                    color: color,
                    activa: true,
                    fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                alert(`¡Éxito! El panel para ${nombre} fue creado.`);
            }
            
            cerrarModalEmpresa();
        } catch (error) {
            console.error(error);
            alert("Ocurrió un error: " + error.message);
        } finally {
            btnGuardar.disabled = false;
            btnGuardar.textContent = id ? "Guardar Cambios" : "Crear Cliente y Panel";
        }
    });
}

// MODO DIOS: Vos entrando al panel de un cliente para auditar o subir algo por ellos
window.entrarComoEmpresa = async (empresaId, nombreEmpresa) => {
    currentTenantId = empresaId;
    superAdminDashboard.style.display = 'none';
    tenantDashboard.style.display = 'block';
    
    btnVolverAdmin.style.display = 'inline-block';
    headerTitle.textContent = `Gestionando: ${nombreEmpresa}`;

    // Aplicar color de empresa si existe
    const doc = await db.collection('empresas').doc(empresaId).get();
    if(doc.exists && doc.data().color) {
        aplicarColorCorporativo(doc.data().color);
    }
    
    cargarAuditoriasDeEmpresa();
}

window.volverAlAdmin = () => {
    if(listenerAuditorias) listenerAuditorias(); // Apagar la escucha de base de datos del cliente
    restaurarColorOriginal();
    iniciarModoSuperAdmin();
}

// Función mágica para Marca Blanca
function aplicarColorCorporativo(color) {
    if(!color) return;
    // Aplicamos a ambos para asegurar que sobreescriba cualquier regla del CSS
    document.documentElement.style.setProperty('--primary-color', color, 'important');
    document.documentElement.style.setProperty('--primary-hover', ajustarBrillo(color, -20), 'important');
    document.body.style.setProperty('--primary-color', color, 'important');
    document.body.style.setProperty('--primary-hover', ajustarBrillo(color, -20), 'important');
}

function restaurarColorOriginal() {
    document.documentElement.style.removeProperty('--primary-color');
    document.documentElement.style.removeProperty('--primary-hover');
    document.body.style.removeProperty('--primary-color');
    document.body.style.removeProperty('--primary-hover');
}

// Función auxiliar para oscurecer el color del botón al pasar el mouse
function ajustarBrillo(hex, percent) {
    const num = parseInt(hex.replace("#",""),16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) + amt,
    G = (num >> 8 & 0x00FF) + amt,
    B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
}


// ----------------------------------------------------
// 3. LÓGICA DE CLIENTE / TENANT (Lo que ven las empresas)
// ----------------------------------------------------
function iniciarModoCliente(tenantUid) {
    // Buscar los datos de la empresa (Nombre y estado activo)
    db.collection('empresas').doc(tenantUid).get().then(doc => {
        if(doc.exists) {
            const data = doc.data();
            
            // Echarlo si la empresa está suspendida
            if (data.activa === false) {
                alert("Tu cuenta se encuentra suspendida temporalmente por falta de pago o revisión administrativa.\nPor favor, contactate con el administrador del sistema.");
                auth.signOut();
                return;
            }
            
            superAdminDashboard.style.display = 'none';
            tenantDashboard.style.display = 'block';
            btnVolverAdmin.style.display = 'none'; 
            btnPerfil.style.display = 'inline-block'; // Mostrar botón de perfil
            headerTitle.textContent = data.nombre;

            // Marca Blanca: Color
            if (data.color) {
                aplicarColorCorporativo(data.color);
            }

            // Logo Personalizado
            const customLogo = document.getElementById('customLogo');
            const defaultIcon = document.getElementById('defaultLogoIcon');
            if (data.logoUrl) {
                customLogo.src = data.logoUrl;
                customLogo.style.display = 'block';
                defaultIcon.style.display = 'none';
            } else {
                customLogo.style.display = 'none';
                defaultIcon.style.display = 'block';
            }
            
            cargarAuditoriasDeEmpresa();
            cargarHistorialDeEmpresa(tenantUid);
        }
    }).catch(err => {
        console.error("Error validando empresa:", err);
    });
}

// Lógica de Perfil de Cliente
window.abrirModalPerfil = () => document.getElementById('modalPerfil').style.display = 'flex';
window.cerrarModalPerfil = () => document.getElementById('modalPerfil').style.display = 'none';

if (document.getElementById('formCambiarClave')) {
    document.getElementById('formCambiarClave').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pass = document.getElementById('newPassword').value;
        const confirm = document.getElementById('newPasswordConfirm').value;

        if (pass !== confirm) return alert("Las contraseñas no coinciden.");
        
        try {
            await auth.currentUser.updatePassword(pass);
            alert("Contraseña actualizada con éxito.");
            cerrarModalPerfil();
            e.target.reset();
        } catch (error) {
            alert("Error: " + error.message + "\nSi hace mucho que no inicias sesión, por seguridad cerrá y volvé a entrar antes de cambiar la clave.");
        }
    });
}

// Manejo de la subida del PDF en la interfaz
const pdfInput = document.getElementById('pdfFile');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const btnUpload = document.getElementById('btnUpload');

if (pdfInput && fileNameDisplay) {
    pdfInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileNameDisplay.textContent = e.target.files[0].name;
            fileNameDisplay.style.color = 'var(--primary-color)';
            fileNameDisplay.style.fontWeight = '600';
            btnUpload.disabled = false;
        } else {
            fileNameDisplay.textContent = 'Hacé clic para seleccionar el PDF';
            fileNameDisplay.style.color = 'var(--text-secondary)';
            fileNameDisplay.style.fontWeight = 'normal';
            btnUpload.disabled = true;
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

// Evento de subir un documento para firmar
const uploadForm = document.getElementById('uploadForm');
if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = pdfInput.files[0];
        
        // Seguridad vital: no subir si no sabemos de que empresa es
        if (!file || !currentTenantId) return; 

        // Leer que eligió el usuario para ESTE documento
        const modoFirmaElegido = document.querySelector('input[name="modoFirma"]:checked').value;
        const posicionFirma = document.getElementById('posicionFirma') ? document.getElementById('posicionFirma').value : 'abajo_izquierda';

        try {
            btnUpload.disabled = true;
            btnUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo seguro a la nube...';

            const base64PDF = await fileToBase64(file);

            // Al guardar en Firestore, guardamos a quien pertenece (tenantId) y cómo se firma
            const docRef = await db.collection('auditorias').add({
                tenantId: currentTenantId, 
                modoFirma: modoFirmaElegido, 
                posicionFirma: posicionFirma,
                nombreArchivo: file.name,
                pdfBase64: base64PDF,
                estado: 'Pendiente',
                fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
                firmaBase64: null
            });
            
            const baseURL = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
            const linkUnico = `${baseURL}firmar.html?id=${docRef.id}`;
            
            alert(`¡Documento guardado con éxito!\n\nPodés copiar el link haciendo clic en el ícono de WhatsApp en la tabla de abajo.`);
            uploadForm.reset();
            fileNameDisplay.textContent = 'Hacé clic para seleccionar el PDF';
            fileNameDisplay.style.color = 'var(--text-secondary)';
            fileNameDisplay.style.fontWeight = 'normal';

        } catch (error) {
            console.error(error);
            alert('¡Ups! Hubo un error de conexión al subir el archivo.');
        } finally {
            btnUpload.innerHTML = '<i class="fa-solid fa-link"></i> Generar Link Único para el Cliente';
            btnUpload.disabled = true;
        }
    });
}

// Listar los documentos de LA EMPRESA ACTUAL SOLAMENTE
function cargarAuditoriasDeEmpresa() {
    const auditsList = document.getElementById('auditsList');
    if (!auditsList || !currentTenantId) return;
    
    if(listenerAuditorias) listenerAuditorias(); // Resetear viejo
    
    const pendingCounter = document.getElementById('pendingCounter');

    // Filtramos solo por tenantId para evitar errores de índice complejos
    listenerAuditorias = db.collection('auditorias')
        .where("tenantId", "==", currentTenantId)
        .orderBy('fechaCreacion', 'desc')
        .onSnapshot((snapshot) => {
            
        auditsList.innerHTML = '';
        let pendingCount = 0;
        
        if (snapshot.empty) {
            auditsList.innerHTML = `<tr class="empty-state"><td colspan="3">Aún no procesaste ningún documento.</td></tr>`;
            if (pendingCounter) pendingCounter.style.display = 'none';
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            
            // FILTRADO CLIENT-SIDE PARA EVITAR ERROR DE ÍNDICE
            if (data.estado !== "Pendiente") return;
            
            pendingCount++;
            const baseURL = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
            const linkACompartir = `${baseURL}firmar.html?id=${doc.id}`;

            const tr = document.createElement('tr');
            const badgeClass = 'badge-pending';
            
            // Etiqueta visual del modo de firma
            let etiquetaFirma = 'Anexa';
            if (data.modoFirma === 'misma_hoja') etiquetaFirma = 'Misma Hoja';
            if (data.modoFirma === 'todas_las_hojas') etiquetaFirma = 'Todas las Hojas';
            
            let infoExtra = '';
            
            if (data.fechaCreacion) {
                try {
                    const fecha = data.fechaCreacion.toDate();
                    const hoy = new Date();
                    const diffTime = Math.abs(hoy - fecha);
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                    const fechaLegible = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const diasTexto = diffDays === 0 ? 'Hoy' : `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;

                    infoExtra += `
                        <span class="status-date" style="display:block; font-size:0.8rem; margin-top:6px; color:var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${fechaLegible}</span>
                        <span class="status-age" style="display:block; font-size:0.8rem; color:var(--warning-color); margin-top:2px;"><i class="fa-regular fa-clock"></i> ${diasTexto}</span>
                    `;
                } catch (e) {
                    console.warn(e);
                }
            }
            infoExtra += `<div style="font-size:0.8rem; margin-top:4px; font-weight: 500; color:var(--text-secondary);"><i class="fa-solid fa-file-invoice"></i> Tipo: ${etiquetaFirma}</div>`;
            
            let estadoHtml = `<div class="status-info-container"><span class="badge ${badgeClass}">${data.estado}</span>${infoExtra}</div>`;
            
            let botonesAccion = `
                <button class="icon-btn" title="Copiar link para enviar por WhatsApp" onclick="copiarLink('${linkACompartir}')" style="color: #25D366;">
                    <i class="fa-brands fa-whatsapp"></i>
                </button>
                <button class="icon-btn" title="Eliminar registro" onclick="eliminarAuditoria('${doc.id}')" style="color: var(--danger-color);">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;

            tr.innerHTML = `
                <td><strong>${data.nombreArchivo}</strong></td>
                <td>${estadoHtml}</td>
                <td class="td-actions">${botonesAccion}</td>
            `;
            auditsList.appendChild(tr);
        });

        if (pendingCount === 0) {
            auditsList.innerHTML = `<tr class="empty-state"><td colspan="3">No hay documentos pendientes.</td></tr>`;
        }

        if (pendingCounter) {
            if (pendingCount > 0) {
                pendingCounter.textContent = pendingCount;
                pendingCounter.style.display = 'inline-block';
            } else {
                pendingCounter.style.display = 'none';
            }
        }
    }, (error) => {
        console.error("Error BD:", error);
    });
}

// NUEVA FUNCIÓN: Cargar Historial (Documentos ya firmados)
let listenerHistorial = null;
let ultimoPDFId = null;

function cargarHistorialDeEmpresa(tenantUid) {
    const historyList = document.getElementById('historyList');
    if (!historyList || !tenantUid) return;
    
    if(listenerHistorial) listenerHistorial();
    
    const historyCounter = document.getElementById('historyCounter');
    const btnDownloadHeader = document.getElementById('btnDownloadPDF');

    listenerHistorial = db.collection('auditorias')
        .where("tenantId", "==", tenantUid)
        .orderBy('fechaCreacion', 'desc')
        .onSnapshot((snapshot) => {
            
        historyList.innerHTML = '';
        let historyCount = 0;
        
        if (snapshot.empty) {
            historyList.innerHTML = `<tr class="empty-state"><td colspan="4">No hay documentos firmados en el historial.</td></tr>`;
            if (historyCounter) historyCounter.style.display = 'none';
            if (btnDownloadHeader) btnDownloadHeader.style.display = 'none';
            ultimoPDFId = null;
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            
            // FILTRADO CLIENT-SIDE
            if (data.estado !== "Firmado") return;
            
            historyCount++;
            const tr = document.createElement('tr');
            
            // El primero que encontremos será el más reciente
            if (!ultimoPDFId) {
                ultimoPDFId = doc.id;
                if (btnDownloadHeader) btnDownloadHeader.style.display = 'inline-flex';
            }

            let fechaFirmaStr = '---';
            if (data.fechaFirma) {
                fechaFirmaStr = data.fechaFirma.toDate().toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            }

            tr.innerHTML = `
                <td><i class="fa-solid fa-file-pdf" style="color: #e11d48; margin-right: 8px;"></i> ${data.nombreArchivo}</td>
                <td>${fechaFirmaStr}</td>
                <td><strong>${data.afiliadoNombre || 'N/A'}</strong><br><small style="color: var(--text-secondary)">DNI: ${data.afiliadoDNI || '---'}</small></td>
                <td>
                    <button class="icon-btn" title="Descargar PDF firmado" onclick="descargarPDF('${doc.id}')" style="color: var(--success-color);">
                        <i class="fa-solid fa-download"></i>
                    </button>
                    <button class="icon-btn" title="Eliminar registro" onclick="eliminarAuditoria('${doc.id}')" style="color: var(--danger-color);">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            historyList.appendChild(tr);
        });

        if (historyCount === 0) {
            historyList.innerHTML = `<tr class="empty-state"><td colspan="4">No hay documentos firmados en el historial.</td></tr>`;
            if (btnDownloadHeader) btnDownloadHeader.style.display = 'none';
            ultimoPDFId = null;
        }

        if (historyCounter) {
            historyCounter.textContent = historyCount;
            historyCounter.style.display = historyCount > 0 ? 'inline-block' : 'none';
        }
    }, (error) => {
        console.error("Error Historial:", error);
    });
}

window.descargarUltimoPDF = function() {
    if (ultimoPDFId) {
        window.descargarPDF(ultimoPDFId);
    } else {
        alert("No hay documentos firmados para descargar.");
    }
}

// ----------------------------------------------------
// 4. FUNCIONES GLOBALES (INYECCIÓN DE FIRMA Y HERRAMIENTAS)
// ----------------------------------------------------

window.compartirWhatsApp = function(id, nombreArchivo) {
    const baseURL = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    const linkUnico = `${baseURL}firmar.html?id=${id}`;
    const mensaje = `Hola! Te envío el documento "${nombreArchivo}" para firmar electrónicamente. Podés hacerlo desde tu celular entrando acá: ${linkUnico}`;
    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

window.copiarLink = function(link) {
    navigator.clipboard.writeText(link).then(() => {
        alert("¡Link copiado con éxito!\n\nYa podés pegarlo en el chat de WhatsApp de tu cliente.");
    }).catch(err => {
        alert("No se pudo copiar automáticamente. Por favor, copiá este enlace manualmente:\n\n" + link); 
    });
}

window.eliminarAuditoria = async function(id) {
    if(confirm("Atención: ¿Estás seguro que querés eliminar esto permanentemente?")) {
        await db.collection('auditorias').doc(id).delete();
    }
}

// LA NUEVA FUNCIÓN MAGICA DE DESCARGA: 2 MODOS DE INYECCIÓN
window.descargarPDF = async function(id) {
    try {
        alert("Procesando PDF final con inyección de firma...\nEspere un momento por favor.");

        const docSnapshot = await db.collection('auditorias').doc(id).get();
        if (!docSnapshot.exists) return;
        
        const data = docSnapshot.data();
        const base64PDFOriginal = data.pdfBase64;
        const base64Firma = data.firmaBase64;
        
        const existingPdfBytes = await fetch(base64PDFOriginal).then(res => res.arrayBuffer());
        const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
        
        const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        
        const marginLeft = 50;
        let page;
        let currentY;
        let startX = marginLeft; // Posición X por defecto

        // ==========================================
        // LÓGICA DE DÓNDE PONER LA FIRMA SEGÚN EL MODO
        // ==========================================
        const pos = data.posicionFirma || 'abajo_izquierda';

        if (data.modoFirma === 'misma_hoja' || data.modoFirma === 'todas_las_hojas') {
            
            const pages = pdfDoc.getPages();
            const pagesToSign = data.modoFirma === 'todas_las_hojas' ? pages : [pages[pages.length - 1]];

            for (const pageItem of pagesToSign) {
                const { height, width } = pageItem.getSize();
                let startX = 50;
                let currentY = 150;

                // Calcular Y
                if (pos.startsWith('arriba')) currentY = height - 100;
                else if (pos.startsWith('centro')) currentY = height / 2;
                else currentY = 150; // abajo

                // Calcular X
                if (pos.endsWith('derecha')) startX = width - 210;
                else if (pos.endsWith('centro') || pos === 'centro') startX = (width - 160) / 2;
                else startX = 50; // izquierda

                // Inyectar Firma
                if (base64Firma) {
                    const signatureImage = await pdfDoc.embedPng(base64Firma);
                    pageItem.drawImage(signatureImage, { x: startX, y: currentY, width: 160, height: 80 });
                }

                // Textos del firmante
                const textYStart = currentY - 15;
                pageItem.drawText(`Firmado electrónicamente por: ${data.afiliadoNombre || 'N/A'}`, { x: startX, y: textYStart, size: 9, font: fontBold });
                pageItem.drawText(`DNI: ${data.afiliadoDNI || '---'}`, { x: startX, y: textYStart - 12, size: 8, font: font });
                pageItem.drawText(`Fecha: ${data.fechaFirma ? data.fechaFirma.toDate().toLocaleString('es-AR') : new Date().toLocaleString('es-AR')}`, { x: startX, y: textYStart - 22, size: 8, font: font });
                
                // Línea divisoria
                pageItem.drawLine({
                    start: { x: startX, y: currentY + 20 },
                    end: { x: startX + 160, y: currentY + 20 },
                    thickness: 1,
                    color: PDFLib.rgb(0.8, 0.8, 0.8),
                });
            }

        } else {
            // MODO HOJA ANEXA (Se mantiene igual)
            const page = pdfDoc.addPage(PDFLib.PageSizes.A4);
            const { height } = page.getSize();
            let currentY = height - 70;
            
            page.drawText('DECLARACIÓN DE CONFORMIDAD', { x: marginLeft, y: currentY, size: 14, font: fontBold });
            currentY -= 40;
            const parrafoLegal = 'Estoy consciente de haber leído y comprendido lo que estoy firmando \ncon total conformidad. Asimismo, manifiesto mi acuerdo con \nsu contenido y acepto su validación mediante mi firma electrónica.';
            page.drawText(parrafoLegal, { x: marginLeft, y: currentY, size: 11, font: font, lineHeight: 16 });
            currentY -= 80;
            page.drawText('DATOS DE CONFIRMACIÓN', { x: marginLeft, y: currentY, size: 14, font: fontBold });
            currentY -= 30;

            if (base64Firma) {
                const signatureImage = await pdfDoc.embedPng(base64Firma);
                page.drawImage(signatureImage, { x: marginLeft, y: currentY - 80, width: 160, height: 80 });
                currentY -= 110;
            }

            page.drawText(`Nombre: ${data.afiliadoNombre || 'N/A'}`, { x: marginLeft, y: currentY, size: 10, font: fontBold });
            page.drawText(`DNI: ${data.afiliadoDNI || '---'}`, { x: marginLeft, y: currentY - 15, size: 10, font: font });
            page.drawText(`Fecha: ${data.fechaFirma ? data.fechaFirma.toDate().toLocaleString('es-AR') : new Date().toLocaleString('es-AR')}`, { x: marginLeft, y: currentY - 30, size: 10, font: font });
        }

        // ==========================================
        // IMPRIMIR DATOS DEL USUARIO Y LA FIRMA
        // ==========================================
        
        // Ajustamos tamaños dependiendo de qué modo es (más chico si es misma_hoja)
        const textS = data.modoFirma === 'misma_hoja' ? 10 : 12;
        
        page.drawText(`Firmante: ${data.afiliadoNombre}`, { x: startX, y: currentY, size: textS, font: fontBold });
        currentY -= 20;
        page.drawText(`DNI: ${data.afiliadoDNI}`, { x: startX, y: currentY, size: textS, font: fontBold });
        currentY -= 30;
        
        // Inyectar imagen
        if (base64Firma) {
            const signatureImageBytes = await fetch(base64Firma).then(res => res.arrayBuffer());
            const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
            page.drawImage(signatureImage, {
                x: startX,
                y: currentY - 50,
                width: 160,
                height: 60,
            });
        }
        
        // Timestamp inyectado al final
        currentY -= 70;
        const fechaObj = data.fechaFirma ? data.fechaFirma.toDate() : new Date();
        page.drawText(`Validación electrónica y timestamp: ${fechaObj.toLocaleString('es-AR')}`, { x: startX, y: currentY, size: 8, font: font, color: PDFLib.rgb(0.5, 0.5, 0.5) });

        // Guardar y descargar
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const linkURL = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = linkURL;
        link.download = `${data.nombreArchivo.replace('.pdf', '')}_FIRMADO.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (error) {
        console.error("Error al inyectar PDF:", error);
        alert("Hubo un error al generar el PDF. " + error.message);
    }
}

// ----------------------------------------------------
// 5. TEMA CLARO / OSCURO
// ----------------------------------------------------
const themeToggle = document.getElementById('themeToggle');
const body = document.body;
const html = document.documentElement;
const savedTheme = localStorage.getItem('theme') || 'light';

// Aplicar el tema guardado al iniciar
body.setAttribute('data-theme', savedTheme);
html.setAttribute('data-theme', savedTheme);
actualizarIconoTema(savedTheme);

if(themeToggle){
    themeToggle.addEventListener('click', () => {
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        body.setAttribute('data-theme', newTheme);
        html.setAttribute('data-theme', newTheme);
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
