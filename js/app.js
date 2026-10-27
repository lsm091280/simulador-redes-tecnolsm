/* tecnoLSM · Simulador de redes — lógica principal */
(function () {
  'use strict';
  var E = window.RedEngine;
  var CLAVE_BORRADOR = 'tecnolsm-redes-borrador-v1';
  var CLAVE_TEMA = 'tecnolsm-theme';

  var estado = { datos: null, red: null, sel: null, diagrama: null, consola: null, examen: null, ejemplos: [] };

  function $(id) { return document.getElementById(id); }
  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function ls(accion, clave, valor) {
    try {
      if (accion === 'get') return window.localStorage.getItem(clave);
      if (accion === 'set') window.localStorage.setItem(clave, valor);
      if (accion === 'del') window.localStorage.removeItem(clave);
    } catch (e) { /* localStorage no disponible */ }
    return null;
  }

  /* ---------- Tema ---------- */
  function iniciarTema() {
    $('btn-tema').addEventListener('click', function () {
      var raiz = document.documentElement;
      var nuevo = raiz.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      raiz.setAttribute('data-theme', nuevo);
      ls('set', CLAVE_TEMA, nuevo);
    });
  }

  /* ---------- Pestañas ---------- */
  function iniciarPestanas() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
    function activar(tab, foco) {
      tabs.forEach(function (t) {
        var activa = t === tab;
        t.setAttribute('aria-selected', activa ? 'true' : 'false');
        t.setAttribute('tabindex', activa ? '0' : '-1');
        $(t.getAttribute('aria-controls')).hidden = !activa;
      });
      if (foco) tab.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { activar(t); });
      t.addEventListener('keydown', function (e) {
        var j = null;
        if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') j = (i + tabs.length - 1) % tabs.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = tabs.length - 1;
        if (j !== null) { activar(tabs[j], true); e.preventDefault(); }
      });
    });
    window.irAPestana = function (id) { activar($(id)); };
  }

  /* ---------- Carga / persistencia de la red ---------- */
  function serializar(red) {
    return {
      app: 'tecnolsm-simulador-redes', version: 1,
      topologia: red.id, nombre: red.nombre, descripcion: red.descripcion,
      guardado: new Date().toISOString(),
      nodos: red.orden.map(function (id) {
        var n = red.nodos[id];
        return { id: n.id, tipo: n.tipo, nombre: n.nombre, x: n.x, y: n.y, cfg: clonar(n.cfg) };
      }),
      conexiones: clonar(red.conexiones)
    };
  }

  function guardarBorrador() {
    if (estado.red) ls('set', CLAVE_BORRADOR, JSON.stringify(serializar(estado.red)));
  }

  function validarObjeto(o) {
    if (!o || typeof o !== 'object') return 'El archivo no tiene el formato esperado.';
    if (!Array.isArray(o.nodos) || o.nodos.length < 1 || o.nodos.length > 40) return 'El archivo debe incluir entre 1 y 40 nodos.';
    if (!Array.isArray(o.conexiones)) return 'Faltan las conexiones.';
    var ids = {};
    for (var i = 0; i < o.nodos.length; i++) {
      var n = o.nodos[i];
      if (!n || typeof n.id !== 'string' || !n.id || ids[n.id]) return 'Hay nodos sin id o con id repetido.';
      if (['pc', 'switch', 'router'].indexOf(n.tipo) === -1) return 'Tipo de nodo no válido: ' + String(n.tipo).slice(0, 20);
      if (!isFinite(n.x) || !isFinite(n.y)) return 'El nodo ' + n.id + ' no tiene posición válida.';
      if (n.cfg) {
        var ks = ['ip', 'mask', 'gw', 'dns'];
        for (var k = 0; k < ks.length; k++) {
          if (n.cfg[ks[k]] !== undefined && (typeof n.cfg[ks[k]] !== 'string' || n.cfg[ks[k]].length > 64)) return 'Configuración no válida en ' + n.id + '.';
        }
      }
      ids[n.id] = true;
    }
    for (var c = 0; c < o.conexiones.length; c++) {
      var cn = o.conexiones[c];
      if (!cn || !ids[cn.from] || !ids[cn.to]) return 'Hay conexiones que apuntan a nodos inexistentes.';
    }
    return null;
  }

  function topoDesdeObjeto(o) {
    return {
      id: String(o.topologia || 'personalizada').slice(0, 30),
      nombre: String(o.nombre || 'Red importada').slice(0, 60),
      descripcion: String(o.descripcion || '').slice(0, 300),
      nodos: o.nodos.map(function (n) {
        var cfg = n.cfg ? { ip: n.cfg.ip || '', mask: n.cfg.mask || '', gw: n.cfg.gw || '', dns: n.cfg.dns || '' } : null;
        return { id: n.id, tipo: n.tipo, nombre: String(n.nombre || n.id).slice(0, 30), x: Number(n.x), y: Number(n.y), cfg: cfg };
      }),
      conexiones: o.conexiones.map(function (c) { return { from: c.from, to: c.to }; })
    };
  }

  function rawTopologia(id) {
    return estado.datos.topologias.filter(function (t) { return t.id === id; })[0] || null;
  }

  function instalarRed(red, selId) {
    estado.red = red;
    estado.diagrama.setRed(red);
    var pc = red.orden.filter(function (id) { return red.nodos[id].tipo === 'pc'; })[0];
    seleccionarNodo(selId && red.nodos[selId] ? selId : (pc || red.orden[0]));
    pintarResumen();
    actualizarBotonesRapidos();
    estado.consola.actualizarPrompt();
    $('sel-topologia').value = rawTopologia(red.id) ? red.id : $('sel-topologia').value;
  }

  function cargarTopologia(id, opciones) {
    opciones = opciones || {};
    var raw = rawTopologia(id);
    if (!raw) return;
    var red = E.crearRed(clonar(raw));
    if (opciones.vaciarIps) {
      opciones.vaciarIps.forEach(function (nid) {
        if (red.nodos[nid]) { red.nodos[nid].cfg.ip = ''; red.nodos[nid].orig.ip = ''; }
      });
    }
    instalarRed(red, opciones.seleccion);
    guardarBorrador();
  }

  function cargarObjeto(o, desdeBorrador) {
    var topo = topoDesdeObjeto(o);
    var red = E.crearRed(topo);
    // El "original" de una red conocida es su configuración por defecto
    var raw = rawTopologia(topo.id);
    if (raw) {
      var base = E.crearRed(clonar(raw));
      Object.keys(red.nodos).forEach(function (k) {
        if (base.nodos[k]) { red.nodos[k].orig = clonar(base.nodos[k].orig); red.nodos[k].x0 = base.nodos[k].x0; red.nodos[k].y0 = base.nodos[k].y0; }
      });
    }
    instalarRed(red);
    if (!desdeBorrador) guardarBorrador();
  }

  function pintarResumen() {
    var r = estado.red, cont = $('resumen-topologia');
    cont.innerHTML = '';
    var nombre = document.createElement('strong'); nombre.textContent = r.nombre;
    var nn = document.createElement('span'); nn.textContent = r.orden.length + ' nodos';
    var nc = document.createElement('span'); nc.textContent = r.conexiones.length + ' conexiones';
    var d = document.createElement('span'); d.className = 'desc'; d.textContent = r.descripcion;
    cont.appendChild(nombre); cont.appendChild(nn); cont.appendChild(nc); cont.appendChild(d);
  }

  function actualizarBotonesRapidos() {
    var r = estado.red, btn = document.querySelector('[data-cmd^="ping "]');
    if (!btn) return;
    var objetivo = r.orden.filter(function (id) { return id !== estado.sel && r.nodos[id].tipo === 'router' && r.nodos[id].cfg.ip; })[0] ||
      r.orden.filter(function (id) { return id !== estado.sel && r.nodos[id].tipo === 'pc' && r.nodos[id].cfg.ip; })[0];
    var ip = objetivo ? r.nodos[objetivo].cfg.ip : '192.168.1.1';
    btn.setAttribute('data-cmd', 'ping ' + ip);
    btn.textContent = 'ping ' + ip;
  }

  /* ---------- Selección y panel de configuración ---------- */
  function seleccionarNodo(id) {
    estado.sel = id;
    estado.diagrama.seleccionar(id, true);
    estado.diagrama.limpiarRuta();
    rellenarConfig();
    var n = estado.red.nodos[id];
    $('chip-nodo').textContent = n ? n.nombre : '—';
    if (estado.consola) estado.consola.actualizarPrompt();
    actualizarBotonesRapidos();
  }

  var CAMPOS = { ip: 'cfg-ip', mask: 'cfg-mask', gw: 'cfg-gw', dns: 'cfg-dns' };

  function rellenarConfig() {
    var n = estado.red.nodos[estado.sel];
    var sw = !n || n.tipo === 'switch';
    Object.keys(CAMPOS).forEach(function (k) {
      var inp = $(CAMPOS[k]);
      inp.value = sw ? '' : (n.cfg[k] || '');
      inp.disabled = sw;
      inp.removeAttribute('aria-invalid');
    });
    $('btn-aplicar').disabled = sw;
    $('btn-restaurar').disabled = sw;
    $('config-nodo').textContent = !n ? 'Selecciona un equipo en el diagrama.' :
      (sw ? n.nombre + ': los switches trabajan en capa 2 y no tienen dirección IP.' : 'Equipo seleccionado: ' + n.nombre + ' (' + (n.tipo === 'router' ? 'router' : 'PC') + ')');
    $('config-mensajes').innerHTML = '';
    if (!sw) validarEnVivo();
  }

  function candidata() {
    var mraw = $('cfg-mask').value.trim();
    var pm = E.parseMascara(mraw);
    return { ip: $('cfg-ip').value.trim(), mask: pm ? pm.mascara : mraw, gw: $('cfg-gw').value.trim(), dns: $('cfg-dns').value.trim() };
  }

  function pintarMensajes(cont, lista) {
    cont.innerHTML = '';
    lista.forEach(function (v) {
      var d = document.createElement('div');
      d.className = 'msg ' + v.nivel;
      var p = document.createElement('div');
      p.textContent = (v.nivel === 'error' ? 'Error: ' : 'Aviso: ') + v.msg;
      d.appendChild(p);
      if (v.explica) {
        var det = document.createElement('details');
        var sm = document.createElement('summary'); sm.textContent = '¿Qué significa esto?';
        var pe = document.createElement('p'); pe.textContent = v.explica;
        det.appendChild(sm); det.appendChild(pe); d.appendChild(det);
      }
      cont.appendChild(d);
    });
  }

  function validarEnVivo() {
    var n = estado.red.nodos[estado.sel];
    if (!n || n.tipo === 'switch') return [];
    var cfg = candidata();
    var v = E.validarConfig(estado.red, n.id, cfg);
    Object.keys(CAMPOS).forEach(function (k) {
      var malo = v.some(function (x) { return x.campo === k && x.nivel === 'error'; });
      if (malo) $(CAMPOS[k]).setAttribute('aria-invalid', 'true'); else $(CAMPOS[k]).removeAttribute('aria-invalid');
    });
    if (!v.length) v = [{ nivel: 'ok', msg: 'La configuración es coherente.', explica: '' }];
    pintarMensajes($('config-mensajes'), v.map(function (x) { return x.nivel === 'ok' ? { nivel: 'ok', msg: x.msg, explica: '' } : x; }));
    return v;
  }

  function aplicarConfig() {
    var n = estado.red.nodos[estado.sel];
    if (!n || n.tipo === 'switch') return;
    var v = validarEnVivo();
    if (v.some(function (x) { return x.nivel === 'error'; })) return;
    n.cfg = candidata();
    estado.diagrama.refrescarEtiquetas();
    actualizarBotonesRapidos();
    guardarBorrador();
    var cont = $('config-mensajes');
    var ok = document.createElement('div');
    ok.className = 'msg ok'; ok.textContent = 'Configuración aplicada a ' + n.nombre + '. Prueba un ping desde la consola.';
    cont.appendChild(ok);
  }

  function restaurarConfig() {
    var n = estado.red.nodos[estado.sel];
    if (!n || n.tipo === 'switch') return;
    n.cfg = clonar(n.orig);
    rellenarConfig();
    estado.diagrama.refrescarEtiquetas();
    actualizarBotonesRapidos();
    guardarBorrador();
  }

  /* ---------- Calculadora ---------- */
  function leerCalc() {
    var ip = $('calc-ip').value.trim();
    var pm = E.parseMascara($('calc-mask').value);
    var sal = $('calc-salida');
    sal.innerHTML = '';
    var err = null;
    if (!E.esIpValida(ip)) err = 'La IP «' + ip.slice(0, 40) + '» no es válida. Escribe 4 números del 0 al 255 separados por puntos.';
    else if (!pm) err = 'La máscara no es válida. Usa /24, 24 o 255.255.255.0 (unos seguidos de ceros).';
    if (err) {
      var d = document.createElement('div'); d.className = 'msg error'; d.textContent = 'Error: ' + err;
      sal.appendChild(d);
      return null;
    }
    return { ip: ip, prefijo: pm.prefijo };
  }

  function filaDatos(dl, k, v) {
    var dt = document.createElement('dt'); dt.textContent = k;
    var dd = document.createElement('dd'); dd.textContent = v;
    dl.appendChild(dt); dl.appendChild(dd);
  }

  function pintarCalc(s, cont) {
    var dl = document.createElement('dl'); dl.className = 'calc-datos';
    filaDatos(dl, 'Dirección de red', s.red + '/' + s.prefijo);
    filaDatos(dl, 'Máscara', s.mascara);
    filaDatos(dl, 'Broadcast', s.broadcast);
    filaDatos(dl, 'Primer host', s.primerHost);
    filaDatos(dl, 'Último host', s.ultimoHost);
    filaDatos(dl, 'Hosts', String(s.hosts));
    filaDatos(dl, 'Clase', s.clase + (s.privada ? ' · privada' : ' · pública'));
    cont.appendChild(dl);
  }

  function calcular() {
    var d = leerCalc(); if (!d) return;
    var s = E.calcSubred(d.ip, d.prefijo);
    pintarCalc(s, $('calc-salida'));
    var nota = document.createElement('p'); nota.className = 'nota';
    nota.textContent = 'Hay ' + (32 - d.prefijo) + ' bits para equipos: 2^' + (32 - d.prefijo) + ' − 2 = ' + s.hosts + ' hosts.';
    $('calc-salida').appendChild(nota);
  }

  function dividir() {
    var d = leerCalc(); if (!d) return;
    var sal = $('calc-salida');
    var r = E.dividirEnSubredes(d.ip, d.prefijo, Number($('calc-n').value));
    if (r.error) {
      var m = document.createElement('div'); m.className = 'msg error'; m.textContent = 'Error: ' + r.error;
      sal.appendChild(m); return;
    }
    var dl = document.createElement('dl'); dl.className = 'calc-datos';
    filaDatos(dl, 'Red original', r.base.red + '/' + r.base.prefijo);
    filaDatos(dl, 'Bits prestados', String(r.bitsPrestados));
    filaDatos(dl, 'Nueva máscara', '/' + r.nuevoPrefijo + ' (' + r.mascara + ')');
    filaDatos(dl, 'Subredes', String(r.cantidad));
    filaDatos(dl, 'Hosts por subred', String(r.hostsPorSubred));
    sal.appendChild(dl);
    if (r.redondeado) {
      var nt = document.createElement('p'); nt.className = 'nota';
      nt.textContent = 'Pediste ' + r.solicitadas + ' subredes; como solo se puede dividir en potencias de 2, salen ' + r.cantidad + '.';
      sal.appendChild(nt);
    }
    var wrap = document.createElement('div'); wrap.className = 'tabla-wrap';
    var tb = document.createElement('table'); tb.className = 'tabla';
    var cap = document.createElement('caption'); cap.className = 'sr-only'; cap.textContent = 'Subredes resultantes';
    tb.appendChild(cap);
    var th = document.createElement('tr');
    ['#', 'Red', 'Primer host', 'Último host', 'Broadcast'].forEach(function (t) {
      var c = document.createElement('th'); c.scope = 'col'; c.textContent = t; th.appendChild(c);
    });
    var thead = document.createElement('thead'); thead.appendChild(th); tb.appendChild(thead);
    var body = document.createElement('tbody');
    var MAX = 64;
    r.subredes.slice(0, MAX).forEach(function (s) {
      var tr = document.createElement('tr');
      [String(s.indice), s.red + '/' + s.prefijo, s.primerHost, s.ultimoHost, s.broadcast].forEach(function (t) {
        var td = document.createElement('td'); td.textContent = t; tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    tb.appendChild(body); wrap.appendChild(tb); sal.appendChild(wrap);
    if (r.subredes.length > MAX) {
      var mas = document.createElement('p'); mas.className = 'nota';
      mas.textContent = '…y ' + (r.subredes.length - MAX) + ' subredes más.'; sal.appendChild(mas);
    }
  }

  /* ---------- Conceptos y ejemplos ---------- */
  function pintarConceptos() {
    var cont = $('lista-conceptos');
    window.EjemplosRedes.CONCEPTOS.forEach(function (c) {
      var d = document.createElement('details'); d.id = 'concepto-' + c.id;
      var s = document.createElement('summary'); s.textContent = c.t;
      var p = document.createElement('p'); p.textContent = c.d;
      d.appendChild(s); d.appendChild(p); cont.appendChild(d);
    });
  }

  function pintarEjemplos() {
    estado.ejemplos = window.EjemplosRedes.combinar(estado.datos.ejemplos);
    var ol = $('lista-ejemplos');
    estado.ejemplos.forEach(function (ej) {
      var li = document.createElement('li');
      var c = document.createElement('span'); c.className = 'ej-concepto'; c.textContent = ej.concepto;
      var t = document.createElement('span'); t.className = 'ej-titulo'; t.textContent = ej.titulo;
      var d = document.createElement('span'); d.className = 'ej-desc'; d.textContent = ej.descripcion;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = 'Cargar';
      b.setAttribute('aria-label', 'Cargar ejemplo: ' + ej.titulo);
      b.addEventListener('click', function () { cargarEjemplo(ej); });
      li.appendChild(c); li.appendChild(t); li.appendChild(d); li.appendChild(b);
      ol.appendChild(li);
    });
  }

  function cargarEjemplo(ej) {
    var a = ej.accion || {};
    var cont = $('ejemplo-pasos');
    cont.innerHTML = '';
    var h = document.createElement('h3'); h.textContent = ej.titulo; cont.appendChild(h);
    var ol = document.createElement('ol');
    (a.pasos || []).forEach(function (p) { var li = document.createElement('li'); li.textContent = p; ol.appendChild(li); });
    cont.appendChild(ol);

    if (a.tipo === 'calculadora') {
      $('calc-ip').value = a.ip; $('calc-mask').value = a.mascara;
      window.irAPestana('tab-calc');
      if (a.subredes) { $('calc-n').value = a.subredes; dividir(); } else calcular();
      return;
    }
    if (a.topologia) cargarTopologia(a.topologia, { seleccion: a.nodo });
    if (a.tipo === 'consola') {
      (a.comandos || []).forEach(function (c) { estado.consola.enviar(c); });
    }
  }

  /* ---------- Exportación / importación ---------- */
  function descargar(nombre, texto, mime) {
    var blob = new Blob([texto], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function msgArchivo(texto, nivel) {
    var c = $('archivo-msg');
    c.innerHTML = '';
    var d = document.createElement('div'); d.className = 'msg ' + (nivel || 'ok'); d.textContent = texto; c.appendChild(d);
  }

  function iniciarArchivo() {
    $('btn-exportar').addEventListener('click', function () {
      descargar('red_' + estado.red.id + '.json', JSON.stringify(serializar(estado.red), null, 2), 'application/json');
      msgArchivo('Configuración exportada.');
    });
    $('btn-importar').addEventListener('click', function () { $('archivo-importar').click(); });
    $('archivo-importar').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      if (f.size > 500000) { msgArchivo('El archivo es demasiado grande para ser una red del simulador.', 'error'); return; }
      var rd = new FileReader();
      rd.onload = function () {
        var o;
        try { o = JSON.parse(String(rd.result)); } catch (x) { msgArchivo('El archivo no es un JSON válido.', 'error'); return; }
        var err = validarObjeto(o);
        if (err) { msgArchivo('No se pudo importar: ' + err, 'error'); return; }
        cargarObjeto(o, false);
        msgArchivo('Configuración importada: ' + estado.red.nombre + '.');
      };
      rd.readAsText(f);
      e.target.value = '';
    });
    $('btn-exportar-ping').addEventListener('click', function () {
      var txt = 'tecnoLSM · Simulador de redes — resultados de consola\n' + new Date().toLocaleString('es-ES') + '\n\n' + estado.consola.textoRegistro() + '\n';
      descargar('resultados_ping.txt', txt, 'text/plain');
      msgArchivo('Resultados exportados.');
    });
    $('btn-descartar').addEventListener('click', function () {
      ls('del', CLAVE_BORRADOR);
      var id = rawTopologia(estado.red.id) ? estado.red.id : $('sel-topologia').value;
      cargarTopologia(id);
      msgArchivo('Borrador descartado y topología recargada.');
    });
  }

  /* ---------- Arranque ---------- */
  function iniciar() {
    iniciarTema();
    iniciarPestanas();

    estado.diagrama = new window.DiagramaRed($('svg-red'), {
      onSeleccion: function (id) { seleccionarNodo(id); },
      onMover: function () { guardarBorrador(); }
    });
    estado.consola = new window.Consola($('terminal'), {
      getRed: function () { return estado.red; },
      getNodoId: function () { return estado.sel; },
      onRuta: function (ruta, ok) { estado.diagrama.animarRuta(ruta, ok); },
      onCambioConfig: function () {
        estado.diagrama.refrescarEtiquetas(); rellenarConfig(); actualizarBotonesRapidos(); guardarBorrador();
      }
    });

    ['cfg-ip', 'cfg-mask', 'cfg-gw', 'cfg-dns'].forEach(function (id) { $(id).addEventListener('input', validarEnVivo); });
    $('form-config').addEventListener('submit', function (e) { e.preventDefault(); aplicarConfig(); });
    $('btn-aplicar').addEventListener('click', aplicarConfig);
    $('btn-restaurar').addEventListener('click', restaurarConfig);
    $('btn-calc').addEventListener('click', calcular);
    $('btn-dividir').addEventListener('click', dividir);
    $('form-calc').addEventListener('submit', function (e) { e.preventDefault(); calcular(); });
    $('btn-reset-pos').addEventListener('click', function () {
      var r = estado.red;
      r.orden.forEach(function (id) { r.nodos[id].x = r.nodos[id].x0; r.nodos[id].y = r.nodos[id].y0; });
      estado.diagrama.render();
      guardarBorrador();
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-cmd]'), function (b) {
      b.addEventListener('click', function () { estado.consola.enviar(b.getAttribute('data-cmd')); });
    });
    iniciarArchivo();

    fetch('data/redes_datos.json').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (datos) {
      estado.datos = datos;
      var sel = $('sel-topologia');
      datos.topologias.forEach(function (t) {
        var o = document.createElement('option'); o.value = t.id; o.textContent = t.nombre; sel.appendChild(o);
      });
      sel.addEventListener('change', function () { cargarTopologia(sel.value); });
      pintarConceptos();
      pintarEjemplos();
      estado.examen = new window.ModoExamen($('examen-contenedor'), datos.examenes, {
        getRed: function () { return estado.red; },
        cargarTopologia: cargarTopologia
      });
      $('btn-reiniciar-examen').addEventListener('click', function () { estado.examen.reiniciar(); });

      var borrador = null;
      try { borrador = JSON.parse(ls('get', CLAVE_BORRADOR)); } catch (e) { borrador = null; }
      if (borrador && !validarObjeto(borrador)) cargarObjeto(borrador, true);
      else cargarTopologia(datos.topologias[0].id);
    }).catch(function () {
      var av = $('aviso-datos');
      av.hidden = false;
      av.textContent = 'No se pudieron cargar los datos (data/redes_datos.json). Si abriste el archivo index.html directamente, sírvelo desde un servidor web (por ejemplo, con la extensión «Live Server» o desde el sitio publicado).';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
