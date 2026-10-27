/* tecnoLSM · Simulador de redes — modo examen
 * 5 enunciados (de data/redes_datos.json) con validación contra la solución esperada.
 * Expone window.ModoExamen.
 */
(function (global) {
  'use strict';
  var CLAVE = 'tecnolsm-redes-examen-v1';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(seg) {
    var m = Math.floor(seg / 60), s = seg % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* Definición de cada ejercicio: tipo de respuesta y validación. */
  var E = function () { return global.RedEngine; };

  var DEFS = {
    ex1: {
      tipo: 'config',
      ayuda: 'Selecciona cada PC en el diagrama, escribe su IP en el panel «Configuración» y pulsa «Aplicar configuración». Usa las IP 192.168.1.10 a 192.168.1.13 (una distinta en cada PC).',
      preparar: function (api) { api.cargarTopologia('estrella', { vaciarIps: ['pc1', 'pc2', 'pc3', 'pc4'] }); },
      validar: function (api) {
        var red = api.getRed(), fallos = [];
        if (!red || red.id !== 'estrella') return ['la topología cargada no es la estrella (vuelve a pulsar «Empezar»)'];
        var esperadas = ['192.168.1.10', '192.168.1.11', '192.168.1.12', '192.168.1.13'], usadas = {};
        ['pc1', 'pc2', 'pc3', 'pc4'].forEach(function (id) {
          var n = red.nodos[id], ip = n ? n.cfg.ip : '';
          if (!ip) fallos.push(n.nombre + ' no tiene IP');
          else if (esperadas.indexOf(ip) === -1) fallos.push('la IP de ' + n.nombre + ' (' + ip + ') no está entre 192.168.1.10 y 192.168.1.13');
          else if (usadas[ip]) fallos.push('hay dos PC con la IP ' + ip);
          else usadas[ip] = true;
          if (n && n.cfg.mask !== '255.255.255.0') fallos.push('la máscara de ' + n.nombre + ' debería ser 255.255.255.0');
          if (n && ip && E().validarConfig(red, id, n.cfg).some(function (v) { return v.nivel === 'error'; })) fallos.push('la configuración de ' + n.nombre + ' tiene errores');
        });
        if (red.nodos.router1.cfg.ip !== '192.168.1.1') fallos.push('la IP del router debe ser 192.168.1.1');
        return fallos;
      }
    },
    ex2: {
      tipo: 'campos',
      campos: [
        { id: 'red', etq: 'Dirección de red' },
        { id: 'bc', etq: 'Dirección de broadcast' },
        { id: 'primero', etq: 'Primer host' },
        { id: 'ultimo', etq: 'Último host' },
        { id: 'hosts', etq: 'Número de hosts' }
      ],
      validar: function (api, v) {
        var s = E().calcSubred('192.168.1.50', 24), f = [];
        if ((v.red || '').trim() !== s.red) f.push('la dirección de red (los bits de equipo a 0)');
        if ((v.bc || '').trim() !== s.broadcast) f.push('el broadcast (los bits de equipo a 1)');
        if ((v.primero || '').trim() !== s.primerHost) f.push('el primer host (red + 1)');
        if ((v.ultimo || '').trim() !== s.ultimoHost) f.push('el último host (broadcast − 1)');
        if (String(v.hosts || '').trim() !== String(s.hosts)) f.push('el número de hosts (2^bits de equipo − 2)');
        return f;
      }
    },
    ex3: {
      tipo: 'opciones',
      opciones: [
        'Responde el router con un mensaje de error de formato',
        'Se agota el tiempo de espera: el paquete se envía pero nadie responde',
        'El ping funciona igual, pero más lento',
        'El switch responde en nombre del equipo'
      ],
      correcta: 1,
      error: 'cuando no existe un equipo con esa IP, nadie contesta al paquete'
    },
    ex4: {
      tipo: 'opciones',
      opciones: [
        'El switch trabaja en capa 3 y el router en capa 2',
        'Ambos trabajan en capa 1 (física)',
        'El switch conecta equipos de una misma red (capa 2) y el router conecta redes distintas (capa 3)',
        'No hay diferencia: son el mismo aparato'
      ],
      correcta: 2,
      error: 'el switch usa direcciones MAC (capa 2, enlace) y el router usa direcciones IP (capa 3, red)'
    },
    ex5: {
      tipo: 'campos',
      campos: [
        { id: 'mascara', etq: 'Máscara de cada subred (/26 o 255.255.255.192)' },
        { id: 'hosts', etq: 'Hosts por subred' }
      ],
      validar: function (api, v) {
        var d = E().dividirEnSubredes('192.168.1.0', 24, 4), f = [];
        var m = E().parseMascara(v.mascara || '');
        if (!m || m.prefijo !== d.nuevoPrefijo) f.push('la máscara (para 4 subredes necesitas 2 bits más que /24)');
        if (String(v.hosts || '').trim() !== String(d.hostsPorSubred)) f.push('los hosts por subred (2^bits de equipo − 2)');
        return f;
      }
    }
  };

  function ModoExamen(contenedor, enunciados, api) {
    this.cont = contenedor;
    this.enunciados = enunciados;
    this.api = api;
    this.actual = null;
    this.estado = this._cargar();
    this.timer = null;
    this.render();
  }

  ModoExamen.prototype._cargar = function () {
    try {
      var s = JSON.parse(global.localStorage.getItem(CLAVE));
      if (s && s.intentos) return s;
    } catch (e) { /* ignorar */ }
    return { intentos: {}, tiempo: {}, resueltos: {} };
  };
  ModoExamen.prototype._guardar = function () {
    try { global.localStorage.setItem(CLAVE, JSON.stringify(this.estado)); } catch (e) { /* ignorar */ }
  };

  ModoExamen.prototype.render = function () {
    var self = this, h = '';
    h += '<p class="nota">Elige un ejercicio, pulsa «Empezar», resuélvelo y pulsa «Comprobar». Cuenta intentos y tiempo.</p>';
    h += '<ol class="examen-lista">';
    this.enunciados.forEach(function (ex, i) {
      var ok = self.estado.resueltos[ex.id];
      h += '<li><button type="button" class="examen-item' + (self.actual === ex.id ? ' activo' : '') + '" data-ex="' + esc(ex.id) + '">' +
        '<span class="examen-num">' + (i + 1) + '</span><span class="examen-tit">Ejercicio ' + (i + 1) + ' · ' + esc(ex.dificultad) + '</span>' +
        '<span class="examen-estado">' + (ok ? '✔ Correcto' : (self.estado.intentos[ex.id] ? self.estado.intentos[ex.id] + ' intento(s)' : 'Sin empezar')) + '</span></button></li>';
    });
    h += '</ol><div class="examen-detalle" id="examen-detalle"></div>';
    this.cont.innerHTML = h;
    Array.prototype.forEach.call(this.cont.querySelectorAll('.examen-item'), function (b) {
      b.addEventListener('click', function () { self.abrir(b.getAttribute('data-ex')); });
    });
    if (this.actual) this._detalle();
  };

  ModoExamen.prototype.abrir = function (id) {
    this._parar();
    this.actual = id;
    this.render();
  };

  ModoExamen.prototype._detalle = function () {
    var self = this, id = this.actual;
    var ex = this.enunciados.filter(function (e) { return e.id === id; })[0];
    var def = DEFS[id];
    var det = this.cont.querySelector('#examen-detalle');
    if (!ex || !def) return;
    var h = '<h3>Enunciado</h3><p class="enunciado">' + esc(ex.enunciado) + '</p>';
    h += '<div class="examen-meta"><span>Intentos: <strong id="ex-intentos">' + (this.estado.intentos[id] || 0) + '</strong></span>' +
      '<span>Tiempo: <strong id="ex-tiempo">' + fmt(this.estado.tiempo[id] || 0) + '</strong></span></div>';
    if (def.tipo === 'config') {
      h += '<button type="button" class="btn" id="ex-empezar">Empezar (preparar la red)</button>';
      h += '<p class="nota">' + esc(def.ayuda) + '</p>';
    } else if (def.tipo === 'campos') {
      h += '<div class="form-rejilla">';
      def.campos.forEach(function (c) {
        h += '<label for="exc-' + c.id + '">' + esc(c.etq) + '</label><input type="text" class="mono" id="exc-' + c.id + '" autocomplete="off" spellcheck="false">';
      });
      h += '</div>';
    } else {
      h += '<fieldset class="opciones"><legend class="sr-only">Respuestas</legend>';
      def.opciones.forEach(function (o, i) {
        h += '<label class="opcion"><input type="radio" name="ex-op" value="' + i + '"> <span>' + esc(o) + '</span></label>';
      });
      h += '</fieldset>';
    }
    h += '<div class="fila-botones"><button type="button" class="btn btn-primario" id="ex-comprobar">Comprobar</button>' +
      '<button type="button" class="btn" id="ex-pista">Ver pista</button></div>';
    h += '<p class="pista" id="ex-pista-txt" hidden>' + esc(ex.pista || '') + '</p>';
    h += '<div class="feedback" id="ex-feedback" role="status" aria-live="polite"></div>';
    det.innerHTML = h;

    var fb = det.querySelector('#ex-feedback');
    if (this.estado.resueltos[id]) { fb.className = 'feedback ok'; fb.textContent = 'Correcto. Ejercicio completado.'; }

    var bEmp = det.querySelector('#ex-empezar');
    if (bEmp) bEmp.addEventListener('click', function () { def.preparar(self.api); self._arrancar(); });
    det.querySelector('#ex-pista').addEventListener('click', function () {
      det.querySelector('#ex-pista-txt').hidden = false;
    });
    det.querySelector('#ex-comprobar').addEventListener('click', function () { self.comprobar(); });
    if (def.tipo !== 'config') this._arrancar();
  };

  ModoExamen.prototype._arrancar = function () {
    var self = this, id = this.actual;
    this._parar();
    if (this.estado.resueltos[id]) return;
    this.timer = global.setInterval(function () {
      if (document.hidden) return;
      self.estado.tiempo[id] = (self.estado.tiempo[id] || 0) + 1;
      var t = self.cont.querySelector('#ex-tiempo');
      if (t) t.textContent = fmt(self.estado.tiempo[id]);
      if (self.estado.tiempo[id] % 5 === 0) self._guardar();
    }, 1000);
  };

  ModoExamen.prototype._parar = function () {
    if (this.timer) { global.clearInterval(this.timer); this.timer = null; }
    this._guardar();
  };

  ModoExamen.prototype.comprobar = function () {
    var id = this.actual, def = DEFS[id], det = this.cont.querySelector('#examen-detalle');
    var fb = det.querySelector('#ex-feedback'), fallos = [];
    if (def.tipo === 'campos') {
      var v = {};
      def.campos.forEach(function (c) { v[c.id] = det.querySelector('#exc-' + c.id).value; });
      if (def.campos.every(function (c) { return v[c.id].trim() === ''; })) {
        fb.className = 'feedback aviso'; fb.textContent = 'Escribe tus respuestas antes de comprobar.'; return;
      }
      fallos = def.validar(this.api, v);
    } else if (def.tipo === 'opciones') {
      var sel = det.querySelector('input[name="ex-op"]:checked');
      if (!sel) { fb.className = 'feedback aviso'; fb.textContent = 'Elige una respuesta antes de comprobar.'; return; }
      if (Number(sel.value) !== def.correcta) fallos = [def.error];
    } else {
      fallos = def.validar(this.api);
    }
    this.estado.intentos[id] = (this.estado.intentos[id] || 0) + 1;
    det.querySelector('#ex-intentos').textContent = this.estado.intentos[id];
    if (fallos.length === 0) {
      this.estado.resueltos[id] = true;
      fb.className = 'feedback ok';
      fb.textContent = 'Correcto. ¡Bien hecho! Intentos: ' + this.estado.intentos[id] + ' · Tiempo: ' + fmt(this.estado.tiempo[id] || 0) + '.';
      this._parar();
    } else {
      fb.className = 'feedback error';
      fb.textContent = 'Incorrecto: revisa ' + fallos.join('; ') + '.';
    }
    this._guardar();
    var lista = this.cont.querySelectorAll('.examen-item');
    var ids = this.enunciados.map(function (e) { return e.id; });
    var self = this;
    Array.prototype.forEach.call(lista, function (b, i) {
      var est = b.querySelector('.examen-estado');
      est.textContent = self.estado.resueltos[ids[i]] ? '✔ Correcto' : (self.estado.intentos[ids[i]] ? self.estado.intentos[ids[i]] + ' intento(s)' : 'Sin empezar');
    });
  };

  ModoExamen.prototype.reiniciar = function () {
    this._parar();
    this.estado = { intentos: {}, tiempo: {}, resueltos: {} };
    this._guardar();
    this.actual = null;
    this.render();
  };

  ModoExamen.DEFS = DEFS;
  global.ModoExamen = ModoExamen;
})(window);
