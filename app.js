'use strict';
/* "use strict" (requisito del enunciado): activa el modo estricto. Convierte errores
   silenciosos en excepciones (variables sin declarar, asignar a constantes, etc.).
   Debe ser la PRIMERA sentencia del fichero para que surta efecto. */

/* ==========================================================================
   Utilidades
   ========================================================================== */
const $ = (id) => document.getElementById(id); // atajo para no repetir document.getElementById

/* Datos simulados del socio. Están pensados para activar TODOS los valores por defecto
   del Bloque 1.4: apodo vacío, suscripción null y saldo undefined. */
const socio = {
  email: '  Juan.Perez@CineVerse.ES  ', // espacios y mayúsculas a propósito, para probar la limpieza
  codigo: 4821,                          // número: se rellenará con ceros hasta 6 dígitos
  apodo: '',
  suscripcion: null,
  entradasRegalo: undefined,
};

/* ==========================================================================
   BLOQUE 1 · Acceso, diagnóstico del entorno y perfil
   ========================================================================== */

/* 1.2 Identificación de la sesión */
function leerSesion() {
  // URLSearchParams lee los parámetros de la URL: index.html?usuario=Ana&rol=vip
  const params = new URLSearchParams(window.location.search);
  return {
    // "||" -> si el parámetro no existe (get devuelve null) se usa el valor por defecto
    usuario: params.get('usuario') || 'invitado',
    rol: params.get('rol') || 'socio',
    idioma: navigator.language,     // p. ej. "es-ES"
    online: navigator.onLine,       // true/false en el momento de la carga
    // randomUUID usa el generador criptográficamente seguro del navegador
    // (Math.random NO es seguro para identificadores de sesión)
    sesionId: crypto.randomUUID(),
    // Fecha en texto extendido en español: "lunes, 28 de septiembre de 2026"
    fecha: new Date().toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }),
  };
}

/* 1.3 Limpieza del correo */
function limpiarCorreo(correoBruto) {
  // trim() quita espacios de los extremos; toLowerCase() normaliza a minúsculas
  const correo = correoBruto.trim().toLowerCase();
  // Desestructuración: split('@') devuelve ["juan.perez", "cineverse.es"]
  const [nombre, dominio] = correo.split('@');
  return { correo, nombre, dominio };
}

/* padStart solo existe en strings: por eso String(codigo) antes de rellenar.
   4821 -> "004821" */
const formatearCodigo = (codigo) => String(codigo).padStart(6, '0');

/* 1.4 Asignación de preferencias.
   OJO a la diferencia entre operadores (es lo que evalúa la rúbrica):
   - ||=  sustituye cualquier valor "falsy" ('' , 0, null, undefined, false)
   - ??=  sustituye SOLO null o undefined (respeta 0 y '')            */
function aplicarPreferencias(datos) {
  datos.apodo ||= 'Espectador VIP';   // '' es falsy -> se sustituye
  datos.suscripcion ??= 'Básica';     // null/undefined -> "Básica"
  // Con ||= un saldo de 0 pasaría a 2 (error). Con ??= el 0 se respeta,
  // tal como pide el enunciado.
  datos.entradasRegalo ??= 2;
  return datos;
}

function actualizarEstadoRed(online) {
  const el = $('estado-red');
  el.textContent = online ? 'Conectado' : 'Sin conexión';
  // toggle(clase, condición): añade o quita la clase. El color lo decide el CSS.
  el.classList.toggle('estado-red--online', online);
  el.classList.toggle('estado-red--offline', !online);
}

function renderPerfil(sesion, correo) {
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
  for (const [etiqueta, valor] of filas) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = etiqueta;
    // textContent (no innerHTML): el usuario viene de la URL, es entrada NO confiable.
    // Con innerHTML, ?usuario=<img onerror=...> sería una inyección XSS.
    dd.textContent = valor;
    perfil.append(dt, dd);
  }
}

/* ==========================================================================
   BLOQUE 2 · Taquilla, tarifas y facturación
   ========================================================================== */
const IVA = 0.21;
// Intl.NumberFormat da el formato regional: 12,10 €  (coma decimal y símbolo detrás)
const formatoEuro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
let idTicket = 1000; // último ticket emitido

/* 2.1 Los precios llegan como TEXTO ("8.50€") y hay que convertirlos a número */
function leerPrecios() {
  return [...document.querySelectorAll('[data-precio]')]
    // parseFloat lee hasta donde puede: "8.50€" -> 8.5 (Number("8.50€") daría NaN)
    .map((el) => parseFloat(el.dataset.precio));
}

/* 2.2 Cálculo con validación. Devuelve null si algún dato no es computable. */
function calcularFactura(precios, codigoPromo) {
  const subtotal = precios.reduce((acc, p) => acc + p, 0);
  // Number.isFinite es false para NaN e Infinity: un solo precio inválido contamina toda la suma
  if (!Number.isFinite(subtotal)) return null;

  // El código promocional también llega como texto ("3"). Number("") = 0, Number("abc") = NaN
  const descuento = Number(codigoPromo);
  if (!Number.isFinite(descuento) || descuento < 0) return null;

  // Orden pedido: primero se resta el descuento y DESPUÉS se aplica el IVA sobre ese resultado.
  // Math.max evita bases negativas si el descuento supera al subtotal.
  const base = Math.max(0, subtotal - descuento);
  const iva = base * IVA;
  return {
    subtotal,
    descuento: Math.min(descuento, subtotal), // lo que realmente se descuenta
    iva,
    total: base + iva,
  };
}

/* 2.4 Desglose con formato de moneda */
function renderResumen() {
  const resumen = $('resumen');
  const aviso = $('aviso-resumen');
  const factura = calcularFactura(leerPrecios(), $('codigo-promo').value);
  resumen.replaceChildren(); // vacía el contenido anterior antes de repintar

  aviso.hidden = factura !== null; // muestra el aviso solo si hubo error
  if (!factura) {
    aviso.textContent = 'No se puede calcular: revisa los precios o introduce un descuento numérico válido.';
    return;
  }

  const filas = [
    ['Subtotal', factura.subtotal],
    ['Descuento', -factura.descuento], // en negativo para que se lea como resta
    ['IVA (21 %)', factura.iva],
    ['Total a pagar', factura.total],
  ];
  for (const [etiqueta, importe] of filas) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = etiqueta;
    dd.textContent = formatoEuro.format(importe);
    if (etiqueta === 'Total a pagar') {
      dt.classList.add('total');
      dd.classList.add('total');
    }
    resumen.append(dt, dd);
  }
}

/* 2.3 Número de reserva */
function confirmarReserva() {
  // PRE-incremento (++x): suma 1 y devuelve el valor YA incrementado -> 1001.
  // Con post-incremento (x++) devolvería el valor antiguo (1000), que ya estaba emitido.
  $('reserva').textContent = `Reserva confirmada · Ticket nº ${++idTicket}`;
}

/* ==========================================================================
   BLOQUE 3 · Promoción "Venta Anticipada" (temporizador)
   ========================================================================== */
const DURACION_FLASH = 20;
/* Variable de control: guarda el id del setInterval activo.
   null = no hay cuenta atrás en marcha. Es la clave de todo el bloque. */
let temporizadorId = null;

function activarDescuentoFlash() {
  // 3.2 Control de concurrencia: si ya hay un intervalo en marcha, se ignora el clic.
  // Sin este guard, cada clic crearía OTRO intervalo y la cuenta bajaría 2, 3... veces por segundo.
  if (temporizadorId !== null) return;

  let restante = DURACION_FLASH;
  const pantalla = $('cuenta-atras');
  const boton = $('btn-flash');
  pantalla.textContent = restante;
  boton.disabled = true; // refuerzo visual; la protección real es el guard de arriba

  temporizadorId = setInterval(() => {
    restante -= 1;
    pantalla.textContent = restante;

    // 3.3 Expiración: parar el intervalo Y limpiar la variable de control
    if (restante <= 0) {
      clearInterval(temporizadorId); // si no se para, seguiría corriendo en segundo plano
      temporizadorId = null;         // sin esto el botón quedaría bloqueado para siempre
      boton.disabled = false;
      // alert() bloquea el hilo: el setTimeout deja que el navegador pinte primero el "0"
      setTimeout(() => alert('La promoción de venta anticipada ha caducado.'), 50);
    }
  }, 1000);
}

/* ==========================================================================
   BLOQUE 4 · Reseñas, seguridad y persistencia
   ========================================================================== */
const CLAVE_RESENAS = 'cineverse:resenas'; // clave en localStorage (prefijo para evitar colisiones)

/* 4.3 Lectura con gestión de excepciones */
function cargarResenas() {
  try {
    // localStorage solo guarda strings: se serializa con JSON.
    // getItem devuelve null si la clave no existe -> "??" lo convierte en '[]'
    const guardadas = JSON.parse(localStorage.getItem(CLAVE_RESENAS) ?? '[]');
    // Defensa extra: el JSON puede ser válido pero no ser un array
    return Array.isArray(guardadas) ? guardadas : [];
  } catch (error) {
    // JSON.parse lanza excepción si el contenido está corrupto (o localStorage está bloqueado).
    // Sin el try/catch, la página entera dejaría de funcionar.
    console.error('No se pudieron recuperar las reseñas:', error);
    return [];
  }
}

function guardarResenas(resenas) {
  try {
    localStorage.setItem(CLAVE_RESENAS, JSON.stringify(resenas));
  } catch (error) {
    // Puede fallar por cuota llena o modo privado
    console.error('No se pudieron guardar las reseñas:', error);
  }
}

/* 4.4 Renderizado SEGURO (protección XSS) */
function renderResenas(resenas) {
  const lista = $('lista-resenas');
  lista.replaceChildren();

  for (const { socio: autor, hora, opinion } of resenas) {
    const li = document.createElement('li');
    const cabecera = document.createElement('p');
    const texto = document.createElement('p');
    cabecera.className = 'resena-meta';
    cabecera.textContent = `${autor} · ${hora}`;
    // CLAVE DE SEGURIDAD: textContent inserta el valor como TEXTO PLANO.
    // Si la opinión es "<script>alert(1)</script>", se ve literal y NO se ejecuta.
    // Con innerHTML el navegador lo interpretaría como HTML (vulnerabilidad XSS).
    texto.textContent = opinion;
    li.append(cabecera, texto);
    lista.append(li);
  }
}

/* 4.1 y 4.2 Publicación: construye el objeto de registro pedido */
function publicarResena(evento, resenas, autor) {
  evento.preventDefault(); // evita que el formulario recargue la página
  const campo = $('opinion');
  const opinion = campo.value.trim();
  if (!opinion) return; // no se publican reseñas vacías

  resenas.push({
    timestamp: Date.now(),                          // marca de tiempo de creación (ms)
    socio: autor,
    hora: new Date().toLocaleTimeString('es-ES'),   // hora local de envío
    opinion,
  });
  guardarResenas(resenas); // persiste ANTES de repintar
  renderResenas(resenas);
  campo.value = '';
}

/* ==========================================================================
   Arranque
   Se llama directamente (sin DOMContentLoaded) porque el script se carga con
   "defer": cuando se ejecuta, el DOM ya está construido.
   ========================================================================== */
function iniciar() {
  const sesion = leerSesion();
  const correo = limpiarCorreo(socio.email);
  aplicarPreferencias(socio);

  actualizarEstadoRed(sesion.online);
  // Los eventos online/offline mantienen el indicador actualizado sin recargar
  window.addEventListener('online', () => actualizarEstadoRed(true));
  window.addEventListener('offline', () => actualizarEstadoRed(false));
  renderPerfil(sesion, correo);

  renderResumen();
  $('codigo-promo').addEventListener('input', renderResumen); // recalcula al teclear
  $('btn-reservar').addEventListener('click', confirmarReserva);

  $('btn-flash').addEventListener('click', activarDescuentoFlash);

  // Las reseñas se cargan UNA vez y el mismo array se reutiliza al publicar
  const resenas = cargarResenas();
  renderResenas(resenas);
  $('form-resena').addEventListener('submit', (e) => publicarResena(e, resenas, sesion.usuario));
}

iniciar();