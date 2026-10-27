/* tecnoLSM · Simulador de redes — diagrama SVG animado
 * Nodos arrastrables, paquetes en tránsito y resaltado de ruta. Expone window.DiagramaRed.
 */
(function (global) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var ANCHO = 440, ALTO = 400;

  function el(nombre, attrs, padre) {
    var e = document.createElementNS(NS, nombre);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (padre) padre.appendChild(e);
    return e;
  }

  function DiagramaRed(svg, opciones) {
    this.svg = svg;
    this.op = opciones || {};
    this.red = null;
    this.sel = null;
    this.paquetes = [];
    this.nodosEl = {};
    this.enlacesEl = [];
    this.animId = 0;
    this.ultimoAmbiente = 0;
    this.reducido = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    svg.setAttribute('viewBox', '0 0 ' + ANCHO + ' ' + ALTO);
    svg.setAttribute('role', 'img');
    this.gEnlaces = el('g', { 'class': 'capa-enlaces' }, svg);
    this.gPaquetes = el('g', { 'class': 'capa-paquetes' }, svg);
    this.gNodos = el('g', { 'class': 'capa-nodos' }, svg);
    var self = this;
    this._bucle = function (t) { self._frame(t); global.requestAnimationFrame(self._bucle); };
    global.requestAnimationFrame(this._bucle);
  }

  DiagramaRed.prototype.setRed = function (red) {
    this.red = red;
    this.sel = null;
    this.animId++;
    this.paquetes.forEach(function (p) { if (p.el.parentNode) p.el.parentNode.removeChild(p.el); });
    this.paquetes = [];
    this.render();
  };

  DiagramaRed.prototype.render = function () {
    var self = this, red = this.red;
    while (this.gEnlaces.firstChild) this.gEnlaces.removeChild(this.gEnlaces.firstChild);
    while (this.gNodos.firstChild) this.gNodos.removeChild(this.gNodos.firstChild);
    this.nodosEl = {}; this.enlacesEl = [];
    if (!red) return;
    this.svg.setAttribute('aria-label', 'Diagrama de la red ' + red.nombre + ' con ' + red.orden.length + ' nodos y ' + red.conexiones.length + ' conexiones');

    red.conexiones.forEach(function (c) {
      var a = red.nodos[c.from], b = red.nodos[c.to];
      if (!a || !b) return;
      var ln = el('line', { 'class': 'enlace', x1: a.x, y1: a.y, x2: b.x, y2: b.y }, self.gEnlaces);
      self.enlacesEl.push({ from: c.from, to: c.to, el: ln });
    });

    red.orden.forEach(function (id) {
      var n = red.nodos[id];
      var g = el('g', { 'class': 'nodo nodo-' + n.tipo, transform: 'translate(' + n.x + ' ' + n.y + ')', tabindex: '0', role: 'button', 'data-id': id }, self.gNodos);
      el('circle', { 'class': 'halo', r: 28 }, g);
      self._icono(g, n.tipo);
      var t1 = el('text', { 'class': 'nodo-nombre', y: 38, 'text-anchor': 'middle' }, g);
      t1.textContent = n.nombre;
      var t2 = el('text', { 'class': 'nodo-ip', y: 51, 'text-anchor': 'middle' }, g);
      t2.textContent = n.tipo === 'switch' ? 'capa 2' : (n.cfg.ip || 'sin IP');
      g.setAttribute('aria-label', n.nombre + (n.tipo === 'switch' ? '' : ', IP ' + (n.cfg.ip || 'sin configurar')));
      self.nodosEl[id] = { g: g, ip: t2 };
      self._enlazarEventos(g, id);
    });
    if (this.sel) this.seleccionar(this.sel, true);
  };

  DiagramaRed.prototype._icono = function (g, tipo) {
    if (tipo === 'pc') {
      el('rect', { 'class': 'forma', x: -16, y: -16, width: 32, height: 22, rx: 3 }, g);
      el('rect', { 'class': 'pantalla', x: -12, y: -12, width: 24, height: 14, rx: 1 }, g);
      el('line', { 'class': 'trazo', x1: 0, y1: 6, x2: 0, y2: 12 }, g);
      el('line', { 'class': 'trazo', x1: -9, y1: 13, x2: 9, y2: 13 }, g);
    } else if (tipo === 'switch') {
      el('rect', { 'class': 'forma', x: -20, y: -9, width: 40, height: 18, rx: 3 }, g);
      for (var i = 0; i < 4; i++) el('rect', { 'class': 'puerto', x: -14 + i * 8, y: -3, width: 5, height: 6, rx: 1 }, g);
    } else {
      el('rect', { 'class': 'forma', x: -19, y: -6, width: 38, height: 16, rx: 3 }, g);
      el('line', { 'class': 'trazo', x1: -11, y1: -6, x2: -15, y2: -17 }, g);
      el('line', { 'class': 'trazo', x1: 11, y1: -6, x2: 15, y2: -17 }, g);
      el('circle', { 'class': 'led', cx: -11, cy: 2, r: 1.8 }, g);
      el('circle', { 'class': 'led', cx: -5, cy: 2, r: 1.8 }, g);
      el('rect', { 'class': 'puerto', x: 3, y: -1, width: 12, height: 6, rx: 1 }, g);
    }
  };

  DiagramaRed.prototype._punto = function (e) {
    var pt = this.svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    var m = this.svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  };

  DiagramaRed.prototype._enlazarEventos = function (g, id) {
    var self = this, arrastrando = false, movido = false;
    g.addEventListener('pointerdown', function (e) {
      arrastrando = true; movido = false;
      g.setPointerCapture(e.pointerId);
      g.classList.add('arrastrando');
      self.seleccionar(id);
      e.preventDefault();
    });
    g.addEventListener('pointermove', function (e) {
      if (!arrastrando) return;
      var p = self._punto(e);
      movido = true;
      self.mover(id, p.x, p.y);
    });
    function fin(e) {
      if (!arrastrando) return;
      arrastrando = false;
      g.classList.remove('arrastrando');
      try { g.releasePointerCapture(e.pointerId); } catch (x) { /* nada */ }
      if (movido && self.op.onMover) self.op.onMover(self.red);
    }
    g.addEventListener('pointerup', fin);
    g.addEventListener('pointercancel', fin);
    g.addEventListener('keydown', function (e) {
      var d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
      if (d) {
        var n = self.red.nodos[id];
        self.mover(id, n.x + d[0], n.y + d[1]);
        if (self.op.onMover) self.op.onMover(self.red);
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === ' ') {
        self.seleccionar(id); e.preventDefault();
      }
    });
  };

  DiagramaRed.prototype.mover = function (id, x, y) {
    var n = this.red.nodos[id];
    n.x = Math.max(24, Math.min(ANCHO - 24, Math.round(x)));
    n.y = Math.max(30, Math.min(ALTO - 60, Math.round(y)));
    this.nodosEl[id].g.setAttribute('transform', 'translate(' + n.x + ' ' + n.y + ')');
    this.enlacesEl.forEach(function (l) {
      if (l.from === id) { l.el.setAttribute('x1', n.x); l.el.setAttribute('y1', n.y); }
      if (l.to === id) { l.el.setAttribute('x2', n.x); l.el.setAttribute('y2', n.y); }
    });
  };

  DiagramaRed.prototype.seleccionar = function (id, silencioso) {
    var self = this;
    this.sel = id;
    Object.keys(this.nodosEl).forEach(function (k) {
      self.nodosEl[k].g.classList.toggle('seleccionado', k === id);
    });
    if (!silencioso && this.op.onSeleccion) this.op.onSeleccion(id);
  };

  /** Actualiza los textos de IP tras cambiar la configuración. */
  DiagramaRed.prototype.refrescarEtiquetas = function () {
    var self = this;
    if (!this.red) return;
    this.red.orden.forEach(function (id) {
      var n = self.red.nodos[id], e = self.nodosEl[id];
      if (e && n.tipo !== 'switch') {
        e.ip.textContent = n.cfg.ip || 'sin IP';
        e.g.setAttribute('aria-label', n.nombre + ', IP ' + (n.cfg.ip || 'sin configurar'));
      }
    });
  };

  /* ---------- Ruta ---------- */
  DiagramaRed.prototype.resaltarRuta = function (ids, ok) {
    this.limpiarRuta();
    var self = this;
    for (var i = 0; i < ids.length - 1; i++) {
      var a = ids[i], b = ids[i + 1];
      this.enlacesEl.forEach(function (l) {
        if ((l.from === a && l.to === b) || (l.from === b && l.to === a)) {
          l.el.classList.add(ok === false ? 'ruta-error' : 'ruta');
        }
      });
    }
    ids.forEach(function (id) {
      if (self.nodosEl[id]) self.nodosEl[id].g.classList.add(ok === false ? 'en-ruta-error' : 'en-ruta');
    });
  };

  DiagramaRed.prototype.limpiarRuta = function () {
    this.enlacesEl.forEach(function (l) { l.el.classList.remove('ruta'); l.el.classList.remove('ruta-error'); });
    var self = this;
    Object.keys(this.nodosEl).forEach(function (k) {
      self.nodosEl[k].g.classList.remove('en-ruta'); self.nodosEl[k].g.classList.remove('en-ruta-error');
    });
  };

  /* ---------- Paquetes ---------- */
  DiagramaRed.prototype._lanzar = function (idA, idB, dur, clase, alTerminar) {
    var a = this.red.nodos[idA], b = this.red.nodos[idB];
    if (!a || !b) { if (alTerminar) alTerminar(); return; }
    var c = el('circle', { 'class': 'paquete ' + (clase || ''), r: 5, cx: a.x, cy: a.y }, this.gPaquetes);
    this.paquetes.push({ el: c, a: idA, b: idB, t0: null, dur: dur, fin: alTerminar });
  };

  DiagramaRed.prototype._frame = function (ahora) {
    if (!this.red) return;
    var self = this;
    if (!this.reducido && !document.hidden && ahora - this.ultimoAmbiente > 1100 && this.red.conexiones.length && this.paquetes.length < 6) {
      this.ultimoAmbiente = ahora;
      var c = this.red.conexiones[Math.floor(Math.random() * this.red.conexiones.length)];
      var inv = Math.random() < 0.5;
      this._lanzar(inv ? c.to : c.from, inv ? c.from : c.to, 1400, 'ambiente');
    }
    this.paquetes = this.paquetes.filter(function (p) {
      if (p.t0 === null) p.t0 = ahora;
      var k = (ahora - p.t0) / p.dur;
      var a = self.red.nodos[p.a], b = self.red.nodos[p.b];
      if (!a || !b || k >= 1) {
        if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
        if (p.fin) p.fin();
        return false;
      }
      p.el.setAttribute('cx', a.x + (b.x - a.x) * k);
      p.el.setAttribute('cy', a.y + (b.y - a.y) * k);
      return true;
    });
  };

  /**
   * Anima un paquete a lo largo de la ruta (ida) y, si ok, la respuesta (vuelta).
   * Devuelve una promesa que se resuelve al terminar.
   */
  DiagramaRed.prototype.animarRuta = function (ids, ok) {
    var self = this, id = ++this.animId;
    this.resaltarRuta(ids, ok);
    return new Promise(function (resolver) {
      if (ids.length < 2) { resolver(); return; }
      var dur = this_dur(ids.length);
      function tramo(lista, i, clase, fin) {
        if (id !== self.animId) { resolver(); return; }
        if (i >= lista.length - 1) { fin(); return; }
        self._lanzar(lista[i], lista[i + 1], dur, clase, function () { tramo(lista, i + 1, clase, fin); });
      }
      tramo(ids, 0, '', function () {
        if (ok === false) {
          var ultimo = self.nodosEl[ids[ids.length - 1]];
          if (ultimo) {
            ultimo.g.classList.add('fallo');
            global.setTimeout(function () { ultimo.g.classList.remove('fallo'); }, 1200);
          }
          resolver();
          return;
        }
        tramo(ids.slice().reverse(), 0, 'respuesta', resolver);
      });
    });
    function this_dur(n) { return Math.max(250, Math.min(600, 2400 / n)); }
  };

  global.DiagramaRed = DiagramaRed;
})(window);
