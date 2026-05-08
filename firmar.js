// Configuración de Firebase (debe ser idéntica a app.js)
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

// Obtener ID de la URL
const urlParams = new URLSearchParams(window.location.search);
const docId = urlParams.get('id');

const loadingMessage = document.getElementById('loadingMessage');
const documentSection = document.getElementById('documentSection');
const successSection = document.getElementById('successSection');
const pdfViewer = document.getElementById('pdfViewer');
const btnClear = document.getElementById('btnClear');
const btnDone = document.getElementById('btnDone');
const btnSubmit = document.getElementById('btnSubmit');

// Configurar Signature Pad
const canvas = document.getElementById('signaturePad');

// Ajustar el canvas al tamaño real del celular
function resizeCanvas() {
    const ratio =  Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
}
window.onresize = resizeCanvas;
// Llamamos para ajustar inicialmente
setTimeout(resizeCanvas, 100);

const signaturePad = new SignaturePad(canvas, {
    penColor: "rgb(0, 0, 150)" // Tinta azul sobre fondo transparente
});

// Configurar PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
if (!docId) {
    loadingMessage.innerHTML = '<i class="fa-solid fa-triangle-exclamation fa-3x" style="color: var(--danger-color);"></i><p style="margin-top:1rem; color:var(--text-primary);">Error: Documento no encontrado. Link inválido.</p>';
} else {
    // Buscar y Cargar documento desde la base de datos secreta
    db.collection('auditorias').doc(docId).get().then(async (doc) => {
        if (doc.exists) {
            const data = doc.data();
            if (data.estado === 'Firmado') {
                loadingMessage.style.display = 'none';
                successSection.style.display = 'block';
                successSection.innerHTML = '<i class="fa-solid fa-circle-check" style="font-size: 4rem; color: var(--success-color); margin-bottom: 1rem;"></i><h2>Este documento ya fue firmado</h2><p class="subtitle">No es necesario volver a firmarlo.</p>';
            } else if (await isLikelySignedDocument(data)) {
                loadingMessage.innerHTML = '<i class="fa-solid fa-triangle-exclamation fa-3x" style="color: var(--danger-color);"></i><p style="margin-top:1rem; color:var(--text-primary);">Este PDF parece ser un documento ya firmado. Pedile a quien lo envio que suba el PDF original sin firma.</p>';
            } else {
                // Si está pendiente, renderizar en canvas (para móviles)
                renderizarPDFenMovil(data.pdfBase64);
            }
        } else {
            loadingMessage.innerHTML = '<i class="fa-solid fa-triangle-exclamation fa-3x" style="color: var(--danger-color);"></i><p style="margin-top:1rem; color:var(--text-primary);">Error: Documento no encontrado o fue eliminado.</p>';
        }
    }).catch((error) => {
        loadingMessage.innerHTML = `<i class="fa-solid fa-triangle-exclamation fa-3x" style="color: var(--danger-color);"></i><p style="margin-top:1rem; color:var(--text-primary);">Error de conexión: ${error.message}</p>`;
    });
}

// ---- Función Mágica para Celulares y Validación 2 en 1 ----
async function isLikelySignedDocument(data) {
    if (isSignedFileName(data?.nombreArchivo || '')) return true;

    try {
        const base64 = (data?.pdfBase64 || '').split(',')[1] || '';
        const sample = atob(base64.slice(0, 900000));
        if (hasSignatureStampText(sample)) return true;

        const bytes = base64ToUint8Array(base64);
        const pdfText = await extractPdfText(bytes);
        return hasSignatureStampText(pdfText);
    } catch (error) {
        return false;
    }
}

function isSignedFileName(fileName) {
    return /(^|[._\-\s])firmad[oa]([._\-\s]|\.pdf$|$)/i.test(fileName || '');
}

function hasSignatureStampText(text) {
    const normalized = String(text || '').replace(/\s+/g, ' ');
    if (/FirmaExpress Pro|CONSTANCIA DE FIRMA|Documento firmado con FirmaExpress/i.test(normalized)) return true;
    return /Firmante\s*:/i.test(normalized) && /DNI\s*:/i.test(normalized) && /Fecha\s*:/i.test(normalized);
}

function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function extractPdfText(bytes) {
    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    const parts = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        parts.push(textContent.items.map(item => item.str || '').join(' '));
    }

    return parts.join(' ');
}

async function renderizarPDFenMovil(base64Data) {
    try {
        const base64Mudo = base64Data.split(',')[1];
        const pdfDataString = atob(base64Mudo);
        const uint8Array = new Uint8Array(pdfDataString.length);
        for (let i = 0; i < pdfDataString.length; i++) {
            uint8Array[i] = pdfDataString.charCodeAt(i);
        }
        
        const loadingTask = pdfjsLib.getDocument({data: uint8Array});
        const pdf = await loadingTask.promise;
        const container = document.getElementById('pdfViewer');
        container.innerHTML = '';
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({scale: 1.5}); // Alta calidad sin pesar en movil
            
            const canvasObj = document.createElement('canvas');
            const ctx = canvasObj.getContext('2d');
            canvasObj.height = viewport.height;
            canvasObj.width = viewport.width;
            canvasObj.style.width = '100%';
            canvasObj.style.maxWidth = viewport.width + 'px';
            canvasObj.style.marginBottom = '10px';
            canvasObj.style.boxShadow = 'var(--shadow-md)';
            
            container.appendChild(canvasObj);
            await page.render({canvasContext: ctx, viewport: viewport}).promise;

        }
        
        loadingMessage.style.display = 'none';
        documentSection.style.display = 'block';
        resizeCanvas();

    } catch (error) {
        console.error("Error renderizando PDF:", error);
        loadingMessage.innerHTML = '<i class="fa-solid fa-triangle-exclamation fa-3x" style="color: var(--danger-color);"></i><p style="margin-top:1rem; color:var(--text-primary);">Error al abrir el documento.</p>';
    }
}

// Lógica de botones de firma
btnClear.addEventListener('click', () => {
    signaturePad.clear();
    
    // Habilitar campos nuevamente
    document.getElementById('chkConformidad').disabled = false;
    document.getElementById('afiliadoNombre').disabled = false;
    document.getElementById('afiliadoDNI').disabled = false;
    
    btnSubmit.style.display = 'none';
    btnDone.disabled = false;
    signaturePad.on(); // Volver a habilitar dibujo
});

btnDone.addEventListener('click', () => {
    const chkConformidad = document.getElementById('chkConformidad');
    const afiliadoNombre = document.getElementById('afiliadoNombre');
    const afiliadoDNI = document.getElementById('afiliadoDNI');

    if (!chkConformidad.checked) {
        alert("Debe tildar la casilla de conformidad al principio del recuadro para poder continuar.");
        return;
    }
    if (afiliadoNombre.value.trim() === '') {
        alert("Por favor, ingrese su Nombre y Apellido.");
        afiliadoNombre.focus();
        return;
    }
    // Lógica para validar que el DNI no esté vacío
    const valorDniLimpio = afiliadoDNI.value.trim().replace(/\./g, '');
    if (valorDniLimpio === '') {
        alert("Por favor, ingrese su DNI.");
        afiliadoDNI.focus();
        return;
    }

    if (signaturePad.isEmpty()) {
        alert("Por favor, dibuje su firma en el recuadro antes de presionar HECHO.");
        return;
    }
    
    // Bloquear campos para que no los modifiquen despues de darle a hecho
    chkConformidad.disabled = true;
    afiliadoNombre.disabled = true;
    afiliadoDNI.disabled = true;
    signaturePad.off();
    
    btnDone.disabled = true;
    
    // Mostrar el botón definitivo de Enviar
    btnSubmit.style.display = 'block';
    
    // Auto-scroll hacia abajo para que el botón de Enviar se vea sí o sí en móviles
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
});

btnSubmit.addEventListener('click', async () => {
    try {
        // Estado de "Enviando..."
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ENVIANDO...';
        btnClear.disabled = true;
        
        // Guardamos la firma como imagen invisible (Base64)
        const firmaDataUrl = signaturePad.toDataURL("image/png");
        
        // Configuramos los datos a modificar
        await db.collection('auditorias').doc(docId).update({
            estado: 'Firmado',
            firmaBase64: firmaDataUrl,
            afiliadoNombre: document.getElementById('afiliadoNombre').value.trim(),
            afiliadoDNI: document.getElementById('afiliadoDNI').value.trim(),
            conformidad: true,
            fechaFirma: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Mostrar cartel de éxito
        documentSection.style.display = 'none';
        successSection.style.display = 'block';
    } catch (error) {
        console.error("Error al guardar la firma:", error);
        alert("Hubo un error al enviar la firma. Por favor verifique su conexión a internet e intente de nuevo.");
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> ENVIAR DOCUMENTO FIRMADO';
        btnClear.disabled = false;
    }
});
