//enableIndexedDbPersistence(db).catch(err => console.log(err));
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence, collection, doc, setDoc, addDoc, getDocs, serverTimestamp, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {

  apiKey: "AIzaSyCciTDpwCtt2li_xfJ-caIM5at6ri_DMqg",

  authDomain: "gestor-expedientes-623d4.firebaseapp.com",

  projectId: "gestor-expedientes-623d4",

  storageBucket: "gestor-expedientes-623d4.firebasestorage.app",

  messagingSenderId: "283491430295",

  appId: "1:283491430295:web:a89c26b2650d580a291ed2"

};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
enableIndexedDbPersistence(db).catch(err => console.log(err));

// --- 1. CREAR Y ACTUALIZAR EXPEDIENTES (MANUAL) ---
document.getElementById('btn-crear-manual').addEventListener('click', async () => {
    const cliente = document.getElementById('nuevo-cliente')?.value.trim() || "Sin cliente asignado";
    const exp = document.getElementById('nuevo-expediente').value.trim();
    const anio = document.getElementById('nuevo-anio').value.trim();
    const fuero = document.getElementById('nuevo-competencia').value;
    const materia = document.getElementById('nuevo-materia').value;
    const estadoRep = (fuero === "Foraneo") ? (document.getElementById('nuevo-estado-republica')?.value.trim() || "No especificado") : "";
    const juzgado = document.getElementById('nuevo-juzgado').value.trim() || "Único";

    if(!exp || !anio) return alert("Ingresa el número de expediente y el año.");

    const idUnico = `${exp}-${anio}-${fuero}-${juzgado}`.replace(/\s/g, '').replace(/\//g, '-').toLowerCase();

    await setDoc(doc(db, "expedientes", idUnico), {
        cliente: cliente,
        numero: `${exp}/${anio}`, 
        fuero: fuero, 
        materia: materia, 
        estado_republica: estadoRep, 
        juzgado: juzgado,
        estado_actual: "Asunto Creado", 
        fecha_actualizacion: new Date().toLocaleDateString('es-MX'), 
        timestamp: serverTimestamp()
    });

    if(document.getElementById('nuevo-cliente')) document.getElementById('nuevo-cliente').value = "";
    document.getElementById('nuevo-expediente').value = ""; 
    document.getElementById('nuevo-anio').value = ""; 
    document.getElementById('nuevo-juzgado').value = "";
    if(document.getElementById('nuevo-estado-republica')) {
        document.getElementById('nuevo-estado-republica').value = "";
        document.getElementById('grupo-estado-nuevo').style.display = 'none';
    }
    document.getElementById('modal-nuevo').style.display = 'none';
});

document.getElementById('btn-actualizar-manual').addEventListener('click', async () => {
    const exp = document.getElementById('act-expediente').value.trim();
    const anio = document.getElementById('act-anio').value.trim();
    const fuero = document.getElementById('act-fuero').value;
    const juzgado = document.getElementById('act-juzgado').value.trim() || "Único";
    const estado = document.getElementById('act-estado').value.trim();

    if(!exp || !anio || !estado) return alert("Llena todos los campos.");

    const idUnico = `${exp}-${anio}-${fuero}-${juzgado}`.replace(/\s/g, '').replace(/\//g, '-').toLowerCase();
    const fechaHoy = new Date().toLocaleDateString('es-MX');

    await addDoc(collection(db, "expedientes", idUnico, "historial"), { actuacion: estado, fecha: fechaHoy, timestamp: serverTimestamp() });
    await setDoc(doc(db, "expedientes", idUnico), { estado_actual: estado, fecha_actualizacion: fechaHoy, numero: `${exp}/${anio}`, fuero: fuero, juzgado: juzgado }, { merge: true });

    document.getElementById('act-expediente').value = ""; document.getElementById('act-anio').value = ""; document.getElementById('act-estado').value = ""; document.getElementById('act-juzgado').value = "";
    document.getElementById('modal-actualizar').style.display = 'none';
});


// --- 2. CEREBRO DE VOZ UNIFICADO (CON SISTEMA DE CORRECCIÓN) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = 'es-MX';
recognition.continuous = false;
recognition.interimResults = false;

const synth = window.speechSynthesis;

let modoVoz = ""; 
let pasoActual = 0;
let datosVoz = {};

function preguntar(texto) {
    document.querySelectorAll('.status-voz').forEach(e => e.innerText = texto);
    synth.cancel(); // Detener cualquier lectura previa
    
    let mensaje = new SpeechSynthesisUtterance(texto);
    mensaje.lang = 'es-MX'; 
    mensaje.rate = 1.1;
    
    mensaje.onend = () => {
        try {
            recognition.start();
        } catch(e) {
            console.log("El micrófono ya estaba encendido o requiere reintento.");
        }
    };
    
    synth.speak(mensaje);
}

function lanzarPreguntaPorPaso(modo, paso) {
    if(modo === "crear") {
        if(paso === 1) preguntar("Para crear, ¿cuál es el nombre del cliente?");
        if(paso === 2) preguntar("Dime el número de expediente.");
        if(paso === 3) preguntar("¿De qué año es?");
        if(paso === 4) preguntar("¿Es local en Hidalgo, federal, foráneo o prejudicial?");
        if(paso === 5 && datosVoz.competencia === "Foraneo") {
            preguntar("¿En qué Estado de la República está radicado?");
        } else if(paso === 5) {
            pasoActual = 6; // Saltar el estado si no es foráneo
            lanzarPreguntaPorPaso(modo, pasoActual);
            return;
        }
        if(paso === 6) preguntar("¿De qué materia es?");
        if(paso === 7) preguntar("¿Qué número de juzgado, sala o mesa es? Di único si no aplica.");
    } else if(modo === "actualizar") {
        if(paso === 1) preguntar("¿Qué número de expediente vas a actualizar?");
        if(paso === 2) preguntar("¿De qué año es?");
        if(paso === 3) preguntar("¿Es local, federal o foráneo?");
        if(paso === 4) preguntar("¿Qué número de juzgado o sala es?");
        if(paso === 5) preguntar("¿Qué fecha le pongo? Puedes decir hoy.");
        if(paso === 6) preguntar("¿Qué actuación se registró?");
    } else if(modo === "buscar") {
        if(paso === 1) preguntar("¿Qué número de expediente buscas?");
        if(paso === 2) preguntar("¿De qué año?");
        if(paso === 3) preguntar("¿Juzgado o sala?");
    }
}

// CAPTURA Y PROCESAMIENTO DE VOZ
recognition.onresult = async (event) => {
    const textoEscuchado = event.results[0][0].transcript.trim().toLowerCase();
    document.querySelectorAll('.trans-voz').forEach(e => e.innerText = `Escuchado: "${textoEscuchado}"`);

    // Comando de corrección rápido
    if (textoEscuchado.includes("corregir") || textoEscuchado.includes("repetir")) {
        lanzarPreguntaPorPaso(modoVoz, pasoActual);
        return;
    }

    if (modoVoz === "crear") {
        if (pasoActual === 1) datosVoz.cliente = textoEscuchado.charAt(0).toUpperCase() + textoEscuchado.slice(1);
        else if (pasoActual === 2) datosVoz.numero = textoEscuchado.replace(/\D/g, '') || textoEscuchado;
        else if (pasoActual === 3) datosVoz.anio = textoEscuchado.replace(/\D/g, '') || textoEscuchado;
        else if (pasoActual === 4) {
            if (textoEscuchado.includes("federal")) datosVoz.competencia = "Federal";
            else if (textoEscuchado.includes("foraneo") || textoEscuchado.includes("foráneo")) datosVoz.competencia = "Foraneo";
            else if (textoEscuchado.includes("prejudicial") || textoEscuchado.includes("pre judicial")) datosVoz.competencia = "Prejudicial";
            else datosVoz.competencia = "Local";
        }
        else if (pasoActual === 5 && datosVoz.competencia === "Foraneo") {
            datosVoz.estado_republica = textoEscuchado.charAt(0).toUpperCase() + textoEscuchado.slice(1);
        }
        else if (pasoActual === 6) datosVoz.materia = textoEscuchado.charAt(0).toUpperCase() + textoEscuchado.slice(1);
        else if (pasoActual === 7) datosVoz.juzgado = textoEscuchado;

        pasoActual++;
        if (pasoActual <= 7) {
            lanzarPreguntaPorPaso(modoVoz, pasoActual);
        } else {
            document.querySelectorAll('.status-voz').forEach(e => e.innerText = "Guardando expediente...");
            await procesarCreacionVoz();
        }

    } else if (modoVoz === "actualizar") {
        if (pasoActual === 1) datosVoz.numero = textoEscuchado.replace(/\D/g, '') || textoEscuchado;
        else if (pasoActual === 2) datosVoz.anio = textoEscuchado.replace(/\D/g, '') || textoEscuchado;
        else if (pasoActual === 3) {
            if (textoEscuchado.includes("federal")) datosVoz.competencia = "Federal";
            else if (textoEscuchado.includes("foraneo") || textoEscuchado.includes("foráneo")) datosVoz.competencia = "Foraneo";
            else datosVoz.competencia = "Local";
        }
        else if (pasoActual === 4) datosVoz.juzgado = textoEscuchado;
        else if (pasoActual === 5) datosVoz.fecha = textoEscuchado.includes("hoy") ? new Date().toLocaleDateString('es-MX') : textoEscuchado;
        else if (pasoActual === 6) datosVoz.actuacion = textoEscuchado;

        pasoActual++;
        if (pasoActual <= 6) {
            lanzarPreguntaPorPaso(modoVoz, pasoActual);
        } else {
            document.querySelectorAll('.status-voz').forEach(e => e.innerText = "Actualizando expediente...");
            await procesarActualizacionVoz();
        }

    } else if (modoVoz === "buscar") {
        document.getElementById('buscador').value = textoEscuchado;
        document.getElementById('buscador').dispatchEvent(new Event('input'));
        document.getElementById('buscador').placeholder = "Buscar expediente...";
    }
};

// Funciones manuales de rescate para botones
window.cancelarVoz = function() {
    synth.cancel();
    try { recognition.stop(); } catch(e){}
    cerrarModal('modal-nuevo');
    cerrarModal('modal-actualizar');
    document.getElementById('buscador').placeholder = "Buscar expediente...";
};

window.repetirPasoVoz = function() {
    synth.cancel();
    try { recognition.stop(); } catch(e){}
    lanzarPreguntaPorPaso(modoVoz, pasoActual);
};

function mostrarControlesVoz() {
    document.querySelectorAll('.voz-controles').forEach(e => e.style.display = 'flex');
}

// Inicios de Voz
document.getElementById('btn-act-voz').addEventListener('click', () => { 
    document.getElementById('act-opciones').style.display = 'none'; 
    mostrarControlesVoz(); 
    modoVoz = "actualizar"; pasoActual = 1; datosVoz = {}; 
    lanzarPreguntaPorPaso(modoVoz, pasoActual); 
});

document.getElementById('btn-crear-voz').addEventListener('click', () => { 
    document.getElementById('nuevo-opciones').style.display = 'none'; 
    mostrarControlesVoz(); 
    modoVoz = "crear"; pasoActual = 1; datosVoz = {}; 
    lanzarPreguntaPorPaso(modoVoz, pasoActual); 
});

document.getElementById('btn-buscar-voz').addEventListener('click', () => { 
    modoVoz = "buscar"; pasoActual = 1; datosVoz = {}; 
    document.getElementById('buscador').placeholder = "Escuchando..."; 
    preguntar("¿Qué número de expediente buscas?");
});

// Manejo de apagado automático (Timeout)
recognition.onerror = (event) => { 
    if (event.error === 'no-speech') {
        document.querySelectorAll('.status-voz').forEach(e => e.innerText = "Micrófono pausado por inactividad. Usa el botón 'Escuchar de nuevo'.");
    } else {
        document.querySelectorAll('.status-voz').forEach(e => e.innerText = "Error de reconocimiento. Intenta con 'Escuchar de nuevo'.");
    }
};

async function procesarCreacionVoz() {
    const idUnico = `${datosVoz.numero}-${datosVoz.anio}-${datosVoz.competencia}-${datosVoz.juzgado}`.replace(/\s/g, '').replace(/\//g, '-').toLowerCase();
    await setDoc(doc(db, "expedientes", idUnico), {
        cliente: datosVoz.cliente || "Sin cliente asignado",
        numero: `${datosVoz.numero}/${datosVoz.anio}`, 
        fuero: datosVoz.competencia, 
        materia: datosVoz.materia, 
        estado_republica: datosVoz.estado_republica || "",
        juzgado: datosVoz.juzgado,
        estado_actual: "Creado por voz", 
        fecha_actualizacion: new Date().toLocaleDateString('es-MX'), 
        timestamp: serverTimestamp()
    });
    setTimeout(() => { cerrarModal('modal-nuevo'); }, 1500);
}

async function procesarActualizacionVoz() {
    const idUnico = `${datosVoz.numero}-${datosVoz.anio}-${datosVoz.competencia}-${datosVoz.juzgado}`.replace(/\s/g, '').replace(/\//g, '-').toLowerCase();
    await addDoc(collection(db, "expedientes", idUnico, "historial"), { actuacion: datosVoz.actuacion, fecha: datosVoz.fecha, timestamp: serverTimestamp() });
    await setDoc(doc(db, "expedientes", idUnico), { estado_actual: datosVoz.actuacion, fecha_actualizacion: datosVoz.fecha, numero: `${datosVoz.numero}/${datosVoz.anio}`, fuero: datosVoz.competencia, juzgado: datosVoz.juzgado }, { merge: true });
    setTimeout(() => { cerrarModal('modal-actualizar'); }, 1500);
}

// --- 3. DIBUJAR DASHBOARD Y VER HISTORIAL ---
const listas = {
    "Federal": document.getElementById('lista-federal'),
    "Local": document.getElementById('lista-local'),
    "Prejudicial": document.getElementById('lista-prejudicial'),
    "Foraneo": document.getElementById('lista-foraneo')
};

const q = query(collection(db, "expedientes"), orderBy("timestamp", "desc"));

onSnapshot(q, (snapshot) => {
    Object.values(listas).forEach(l => { if(l) { l.innerHTML = ""; l.dataset.count = 0; } });

    const archFed = document.getElementById('archivo-federal');
    const archLoc = document.getElementById('archivo-local');
    const archPre = document.getElementById('archivo-prejudicial');
    const archFor = document.getElementById('archivo-foraneo');
    
    if(archFed) archFed.innerHTML = ""; 
    if(archLoc) archLoc.innerHTML = ""; 
    if(archPre) archPre.innerHTML = "";
    if(archFor) archFor.innerHTML = "";

    snapshot.forEach((docSnap) => {
        const exp = docSnap.data();
        const idPadre = docSnap.id;
        const estadoTag = (exp.fuero === 'Foraneo' && exp.estado_republica) ? ` | 📍 ${exp.estado_republica}` : '';
        
        const tarjeta = document.createElement('div');
        tarjeta.className = "tarjeta-expediente";
        tarjeta.style.cssText = "background: var(--bg-color); padding: 15px; margin-bottom: 15px; border-radius: 8px; border-left: 4px solid var(--primary); cursor: pointer;";
        
        tarjeta.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <span style="font-size:12px; background:var(--panel-bg); padding:3px 8px; border-radius:10px;">${exp.materia || "Sin materia"}${estadoTag} | Juzgado: ${exp.juzgado || "Único"}</span>
                <span style="font-size:12px; color:var(--text-muted);">${exp.fecha_actualizacion}</span>
            </div>
            <h4 style="margin: 5px 0 2px 0; font-size:16px;">Exp: ${exp.numero}</h4>
            <p style="margin: 0 0 5px 0; font-size: 13px; color: var(--primary); font-weight: bold;">👤 ${exp.cliente || "Sin cliente asignado"}</p>
            <p style="margin: 0; font-size: 13px; color: var(--text-muted);"><strong>Último estado:</strong> ${exp.estado_actual}</p>
        `;

        if (exp.archivado) {
            tarjeta.style.borderLeftColor = "#f59e0b";
            tarjeta.onclick = () => {
                if(confirm("¿Deseas reactivar este expediente al tablero principal?")) {
                    reactivarExpediente(idPadre);
                } else {
                    cargarHistorial(idPadre, exp.numero);
                }
            };
            let destinoArchivados = exp.fuero === 'Federal' ? archFed : (exp.fuero === 'Foraneo' ? archFor : (exp.fuero === 'Prejudicial' ? archPre : archLoc));
            if(destinoArchivados) destinoArchivados.appendChild(tarjeta);
        } 
        else {
            let destino = listas[exp.fuero] || listas["Local"]; 
            if(destino) {
                destino.dataset.count = (parseInt(destino.dataset.count) || 0) + 1;
                let count = destino.dataset.count;

                if (count > 3) {
                    tarjeta.classList.add("oculta-por-limite");
                    let btnId = destino.id === 'lista-federal' ? 'btn-fed' : (destino.id === 'lista-local' ? 'btn-loc' : (destino.id === 'lista-foraneo' ? 'btn-for' : 'btn-pre'));
                    let btnElem = document.getElementById(btnId);
                    if(btnElem) btnElem.style.display = 'block';
                }
                tarjeta.onclick = () => cargarHistorial(idPadre, exp.numero);
                destino.appendChild(tarjeta);
            }
        }
    });
});

// Función global para el botón "Ver Todos"
window.mostrarTodos = function(listaId, btnId) {
    const contenedor = document.getElementById(listaId);
    if(contenedor) {
        contenedor.querySelectorAll('.oculta-por-limite').forEach(t => t.classList.remove('oculta-por-limite'));
    }
    const btn = document.getElementById(btnId);
    if(btn) btn.style.display = 'none';
}

async function cargarHistorial(idExpediente, numeroLegible) {
    document.getElementById('titulo-historial').innerText = `Historial: ${numeroLegible}`;
    const contenedor = document.getElementById('contenido-historial');
    contenedor.innerHTML = "<p>Cargando historial...</p>";
    document.getElementById('modal-historial').style.display = 'flex';

    const qHistorial = query(collection(db, "expedientes", idExpediente, "historial"), orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(qHistorial);

    contenedor.innerHTML = `
        <div style="display:flex; gap:10px; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:10px;">
            <button class="btn btn-outline" style="flex:1; font-size:13px; border-color:#f59e0b; color:#f59e0b;" onclick="archivarExpediente('${idExpediente}')">📂 Archivar Asunto</button>
            <button class="btn btn-outline" style="flex:1; font-size:13px; border-color:#ef4444; color:#ef4444;" onclick="eliminarExpediente('${idExpediente}')">🗑️ Eliminar</button>
        </div>
    `;

    if(querySnapshot.empty) {
        contenedor.innerHTML += "<p style='color:var(--text-muted);'>No hay actuaciones registradas.</p>";
        return;
    }

    querySnapshot.forEach((docSnap) => {
        const acto = docSnap.data();
        contenedor.innerHTML += `
            <div class="historial-item">
                <small style="color:var(--text-muted);">${acto.fecha}</small>
                <p style="margin:5px 0 0 0;">${acto.actuacion}</p>
            </div>
        `;
    });
}

// Buscador
document.getElementById('buscador').addEventListener('input', (e) => {
    const txt = e.target.value.toLowerCase();
    document.querySelectorAll('.tarjeta-expediente').forEach(t => {
        t.style.display = t.innerText.toLowerCase().includes(txt) ? 'block' : 'none';
    });
});

// --- FUNCIONES DE CICLO DE VIDA (ARCHIVAR, ELIMINAR, REACTIVAR) ---
window.archivarExpediente = async function(id) {
    if(confirm("¿Deseas archivar este expediente?")) {
        await setDoc(doc(db, "expedientes", id), { archivado: true }, { merge: true });
        cerrarModal('modal-historial');
    }
}

window.reactivarExpediente = async function(id) {
    if(confirm("¿Deseas reactivar este expediente al tablero principal?")) {
        await setDoc(doc(db, "expedientes", id), { archivado: false }, { merge: true });
        cerrarVistaArchivo();
    }
}

window.eliminarExpediente = async function(id) {
    if(confirm("⚠️ ATENCIÓN: ¿Estás seguro de eliminar permanentemente este expediente y todo su historial? Esta acción no se puede deshacer.")) {
        // Nota: Para borrar subcolecciones limpiamente en Firestore se requiere script, pero podemos marcarlo o borrar el documento principal
        await deleteDoc(doc(db, "expedientes", id));
        cerrarModal('modal-historial');
        alert("Expediente eliminado.");
    }
}

// Control de la interfaz de Archivo
window.abrirVistaArchivo = function() {
    document.querySelector('.container > .dashboard-grid').style.display = 'none';
    document.getElementById('vista-archivo').style.display = 'block';
}
window.cerrarVistaArchivo = function() {
    document.getElementById('vista-archivo').style.display = 'none';
    document.querySelector('.container > .dashboard-grid').style.display = 'grid';
}
