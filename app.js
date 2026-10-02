'use strict';
// Activa el modo estricto: los errores silenciosos pasan a lanzar excepciones.

// ============================================================
// Utilidades
// ============================================================
// Atajo para buscar un elemento del HTML por su id.
const $ = (id) => document.getElementById(id);

// Datos de ejemplo del socio, preparados para probar los valores por defecto.
const socio = {
  email: '  Juan.Perez@CineVerse.ES  ', // con espacios y mayúsculas para probar la limpieza
  codigo: 4821,                          // se rellenará con ceros hasta 6 dígitos
  apodo: '',                             // vacío -> tomará el apodo por defecto
  suscripcion: null,                     // null -> tomará la suscripción por defecto
  entradasRegalo: undefined,             // undefined -> tomará las entradas por defecto
};

// ============================================================
// BLOQUE 1 · Acceso, diagnóstico del entorno y perfil
// ============================================================

// Recoge los datos de la sesión actual (URL y navegador).
function leerSesion() {
  // Lee los parámetros de la URL (ej: ?usuario=Ana&rol=vip).
  const params = new URLSearchParams(window.location.search);
  return {
    // Si el parámetro no existe, usa el valor por defecto.
    usuario: params.get('usuario') || 'invitado',
    rol: params.get('rol') || 'socio',
    idioma: navigator.language,     // idioma del navegador
    online: navigator.onLine,       // true si hay conexión al cargar
    // Genera un identificador único y seguro para la sesión.
    sesionId: crypto.randomUUID(),
    // Fecha actual en texto largo en español.
    fecha: new Date().toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }),
  };
}

// Normaliza el correo y lo separa en nombre y dominio.
function limpiarCorreo(correoBruto) {
  // Quita los espacios de los extremos y pasa a minúsculas.
  const correo = correoBruto.trim().toLowerCase();
  // Separa el correo por la arroba en nombre y dominio.
  const [nombre, dominio] = correo.split('@');
  return { correo, nombre, dominio };
}

// Convierte el código en texto y lo rellena con ceros hasta 6 dígitos (4821 -> "004821").
const formatearCodigo = (codigo) => String(codigo).padStart(6, '0');

// Rellena con valores por defecto los datos que faltan.
function aplicarPreferencias(datos) {
  datos.apodo ||= 'Espectador VIP';   // sustituye cualquier valor "falsy" (como '')
  datos.suscripcion ??= 'Básica';     // sustituye solo null o undefined
  // Sustituye solo null o undefined, así un 0 se respeta.
  datos.entradasRegalo ??= 2;
  return datos;
}

// Muestra si el usuario tiene conexión o no.
function actualizarEstadoRed(online) {
  const el = $('estado-red');
  el.textContent = online ? 'Conectado' : 'Sin conexión';
  // Añade o quita la clase según haya conexión; el color lo decide el CSS.
  el.classList.toggle('estado-red--online', online);
  el.classList.toggle('estado-red--offline', !online);
}

// Muestra en pantalla los datos del perfil del socio.
function renderPerfil(sesion, correo) {
  // Cada fila es [etiqueta, valor].
  const filas = [
    ['Usuario', sesion.usuario],
    ['Rol', sesion.rol],
    ['Apodo', socio.apodo],
    ['Suscripción', socio.suscripcion],
    ['Entradas de regalo', socio.entradasRegalo],
    ['Nº de socio', formatearCodigo(socio.codigo)],
    ['Usuario de correo', correo.nombre],
    ['Dominio', correo.dominio],
    ['Idioma', sesion.idioma],
    ['Sesión', sesion.sesionId],
    ['Fecha', sesion.fecha],
  ];
  const perfil = $('perfil');
  // Crea un título (dt) y un valor (dd) por cada fila y los añade a la lista.
  for (const [etiqueta, valor] of filas) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = etiqueta;
    // textContent inserta texto plano, así el HTML de la URL no se ejecuta (anti-XSS).
    dd.textContent = valor;
    perfil.append(dt, dd);
  }
}

// ============================================================
// BLOQUE 2 · Taquilla, tarifas y facturación
// ============================================================
const IVA = 0.21; // 21 % de IVA
// Formateador de moneda en euros con estilo español (12,10 €).
const formatoEuro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
let idTicket = 1000; // último número de ticket emitido

// Lee los precios del HTML (atributo data-precio) y los convierte de texto a número.
function leerPrecios() {
  return [...document.querySelectorAll('[data-precio]')]
    // parseFloat convierte "8.50€" en 8.5.
    .map((el) => parseFloat(el.dataset.precio));
}

// Calcula subtotal, descuento, IVA y total. Devuelve null si algún dato no es válido.
function calcularFactura(precios, codigoPromo) {
  // Suma todos los precios.
  const subtotal = precios.reduce((acc, p) => acc + p, 0);
  // Si algún precio no era un número, el subtotal no es válido.
  if (!Number.isFinite(subtotal)) return null;

  // El código promocional es el importe a descontar.
  const descuento = Number(codigoPromo);
  // Descuento no numérico o negativo: no se puede calcular.
  if (!Number.isFinite(descuento) || descuento < 0) return null;

  // Primero se resta el descuento y después se aplica el IVA; la base nunca es negativa.
  const base = Math.max(0, subtotal - descuento);
  const iva = base * IVA;
  return {
    subtotal,
    descuento: Math.min(descuento, subtotal), // descuento realmente aplicado
    iva,
    total: base + iva,
  };
}

// Calcula la factura y muestra el desglose (o un aviso si hay error).
function renderResumen() {
  const resumen = $('resumen');
  const aviso = $('aviso-resumen');
  const factura = calcularFactura(leerPrecios(), $('codigo-promo').value);
  resumen.replaceChildren(); // vacía el desglose anterior

  aviso.hidden = factura !== null; // el aviso solo se ve si hubo error
  if (!factura) {
    aviso.textContent = 'No se puede calcular: revisa los precios o introduce un descuento numérico válido.';
    return;
  }

  // Cada fila es [etiqueta, importe].
  const filas = [
    ['Subtotal', factura.subtotal],
    ['Descuento', -factura.descuento], // en negativo para que se lea como resta
    ['IVA (21 %)', factura.iva],
    ['Total a pagar', factura.total],
  ];
  // Crea título y valor por cada fila, con el importe en formato euro.
  for (const [etiqueta, importe] of filas) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = etiqueta;
    dd.textContent = formatoEuro.format(importe);
    // La fila del total lleva una clase extra para destacarla.
    if (etiqueta === 'Total a pagar') {
      dt.classList.add('total');
      dd.classList.add('total');
    }
    resumen.append(dt, dd);
  }
}

// Genera un nuevo número de ticket y confirma la reserva.
function confirmarReserva() {
  // ++idTicket suma 1 antes de usar el valor, así no se repite el último ticket emitido.
  $('reserva').textContent = `Reserva confirmada · Ticket nº ${++idTicket}`;
}

// ============================================================
// BLOQUE 3 · Promoción "Venta Anticipada" (temporizador)
// ============================================================
const DURACION_FLASH = 20; // segundos que dura la promoción
// Guarda el id del intervalo activo (null = no hay cuenta atrás en marcha).
let temporizadorId = null;

// Inicia la cuenta atrás de la promoción.
function activarDescuentoFlash() {
  // Si ya hay una cuenta atrás en marcha, se ignora el clic.
  if (temporizadorId !== null) return;

  let restante = DURACION_FLASH;
  const pantalla = $('cuenta-atras');
  const boton = $('btn-flash');
  pantalla.textContent = restante; // muestra el valor inicial
  boton.disabled = true;           // bloquea el botón mientras corre la cuenta

  // Cada segundo resta 1 y actualiza la pantalla.
  temporizadorId = setInterval(() => {
    restante -= 1;
    pantalla.textContent = restante;

    // Al llegar a 0: para el intervalo, libera la variable de control y reactiva el botón.
    if (restante <= 0) {
      clearInterval(temporizadorId);
      temporizadorId = null;
      boton.disabled = false;
      // El setTimeout deja que el navegador pinte el "0" antes de mostrar el alert.
      setTimeout(() => alert('La promoción de venta anticipada ha caducado.'), 50);
    }
  }, 1000);
}

// ============================================================
// BLOQUE 4 · Reseñas, seguridad y persistencia
// ============================================================
const CLAVE_RESENAS = 'cineverse:resenas'; // clave con la que se guardan en localStorage

// Recupera las reseñas guardadas; si algo falla devuelve una lista vacía.
function cargarResenas() {
  try {
    // Lee el texto guardado (o '[]' si no hay nada) y lo convierte en datos.
    const guardadas = JSON.parse(localStorage.getItem(CLAVE_RESENAS) ?? '[]');
    // Comprueba que el resultado sea realmente una lista.
    return Array.isArray(guardadas) ? guardadas : [];
  } catch (error) {
    // Se llega aquí si el JSON está corrupto o localStorage está bloqueado.
    console.error('No se pudieron recuperar las reseñas:', error);
    return [];
  }
}

// Guarda las reseñas en localStorage como texto JSON.
function guardarResenas(resenas) {
  try {
    localStorage.setItem(CLAVE_RESENAS, JSON.stringify(resenas));
  } catch (error) {
    // Puede fallar por cuota llena o modo privado.
    console.error('No se pudieron guardar las reseñas:', error);
  }
}

// Dibuja la lista de reseñas en pantalla.
function renderResenas(resenas) {
  const lista = $('lista-resenas');
  lista.replaceChildren(); // vacía la lista antes de repintar

  // Crea un elemento de lista por cada reseña.
  for (const { socio: autor, hora, opinion } of resenas) {
    const li = document.createElement('li');
    const cabecera = document.createElement('p'); // autor y hora
    const texto = document.createElement('p');    // opinión
    cabecera.className = 'resena-meta';
    cabecera.textContent = `${autor} · ${hora}`;
    // textContent inserta texto plano, así el HTML escrito por el usuario no se ejecuta (anti-XSS).
    texto.textContent = opinion;
    li.append(cabecera, texto);
    lista.append(li);
  }
}

// Gestiona el envío del formulario: crea, guarda y muestra la reseña.
function publicarResena(evento, resenas, autor) {
  evento.preventDefault(); // evita que el formulario recargue la página
  const campo = $('opinion');
  const opinion = campo.value.trim(); // quita espacios sobrantes
  if (!opinion) return; // no se publican reseñas vacías

  // Añade la nueva reseña a la lista.
  resenas.push({
    timestamp: Date.now(),                          // momento de creación en milisegundos
    socio: autor,                                   // quién la escribe
    hora: new Date().toLocaleTimeString('es-ES'),   // hora local de envío
    opinion,
  });
  guardarResenas(resenas); // guarda antes de repintar
  renderResenas(resenas);
  campo.value = '';        // vacía el campo de texto
}

// ============================================================
// Arranque
// ============================================================

// Prepara toda la página y conecta los eventos.
function iniciar() {
  const sesion = leerSesion();
  const correo = limpiarCorreo(socio.email);
  aplicarPreferencias(socio);

  actualizarEstadoRed(sesion.online);
  // Mantiene el indicador de conexión actualizado sin recargar la página.
  window.addEventListener('online', () => actualizarEstadoRed(true));
  window.addEventListener('offline', () => actualizarEstadoRed(false));
  renderPerfil(sesion, correo);

  renderResumen(); // calcula el desglose al cargar
  $('codigo-promo').addEventListener('input', renderResumen); // recalcula al escribir el código
  $('btn-reservar').addEventListener('click', confirmarReserva);

  $('btn-flash').addEventListener('click', activarDescuentoFlash);

  // Las reseñas se cargan una vez y el mismo array se reutiliza al publicar.
  const resenas = cargarResenas();
  renderResenas(resenas);
  $('form-resena').addEventListener('submit', (e) => publicarResena(e, resenas, sesion.usuario));
}

// Se ejecuta directamente porque el script se carga con "defer" y el DOM ya está listo.
iniciar();