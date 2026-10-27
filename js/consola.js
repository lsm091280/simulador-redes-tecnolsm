/* tecnoLSM · Simulador de redes — consola simulada
 * Comandos: ping, traceroute/tracert, ipconfig/ifconfig, nslookup, arp -a, help, clear, history.
 * Expone window.Consola.
 */
(function (global) {
  'use strict';
  var COMANDOS = ['arp', 'clear', 'cls', 'dhclient', 'help', 'history', 'ifconfig', 'ipconfig', 'nslookup', 'ping', 'tracert', 'traceroute'];

  function dormir(ms) { return new Promise(function (r) { global.setTimeout(r, ms); }); }

  /**
   * ctx: { getRed(), getNodoId(), onRuta(ruta, ok), onCambioConfig(), onComando(cmd) }
   */
  function Consola(contenedor, ctx) {
    this.ctx = ctx;
    this.historial = [];
    this.posHist = 0;
    this.registro = [];
    this.cola = Promise.resolve();
    this.reducido = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    contenedor.innerHTML = '';
    this.salida = document.createElement('div');
    this.salida.className = 'term-salida';
    this.salida.setAttribute('role', 'log');
    this.salida.setAttribute('aria-live', 'polite');
    this.form = document.createElement('form');
    this.form.className = 'term-linea';
    this.form.setAttribute('autocomplete', 'off');
    this.prompt = document.createElement('label');
    this.prompt.className = 'term-prompt';
    this.prompt.setAttribute('for', 'term-entrada');
    this.entrada = document.createElement('input');
    this.entrada.id = 'term-entrada';
    this.entrada.type = 'text';
    this.entrada.className = 'term-entrada';
    this.entrada.spellcheck = false;
    this.entrada.setAttribute('autocapitalize', 'off');
    this.entrada.setAttribute('aria-label', 'Línea de comandos');
    this.form.appendChild(this.prompt);
    this.form.appendChild(this.entrada);
    contenedor.appendChild(this.salida);
    contenedor.appendChild(this.form);
    contenedor.addEventListener('click', function (e) {
      if (!global.getSelection || String(global.getSelection()) === '') this.entrada.focus();
    }.bind(this));

    var self = this;
    this.form.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = self.entrada.value;
      self.entrada.value = '';
      self.enviar(t);
    });
    this.entrada.addEventListener('keydown', function (e) { self._tecla(e); });

    this.actualizarPrompt();
    this.imprimir('tecnoLSM Consola de red — escribe «help» para ver los comandos.', 'ayuda');
  }

  Consola.prototype.actualizarPrompt = function () {
    var red = this.ctx.getRed(), id = this.ctx.getNodoId();
    var n = red && id ? red.nodos[id] : null;
    this.prompt.textContent = (n ? n.nombre : '—') + '>';
  };

  Consola.prototype.imprimir = function (txt, clase) {
    var d = document.createElement('div');
    d.className = 'term-l' + (clase ? ' term-' + clase : '');
    d.textContent = txt === '' ? '\u00A0' : txt;
    this.salida.appendChild(d);
    this.salida.scrollTop = this.salida.scrollHeight;
    this.registro.push(txt);
  };

  Consola.prototype.limpiar = function () { this.salida.innerHTML = ''; };

  Consola.prototype._tecla = function (e) {
    if (e.key === 'ArrowUp') {
      if (this.historial.length && this.posHist > 0) { this.posHist--; this.entrada.value = this.historial[this.posHist]; }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (this.posHist < this.historial.length - 1) { this.posHist++; this.entrada.value = this.historial[this.posHist]; }
      else { this.posHist = this.historial.length; this.entrada.value = ''; }
      e.preventDefault();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this._autocompletar();
    }
  };

  Consola.prototype._autocompletar = function () {
    var v = this.entrada.value;
    var partes = v.split(/\s+/);
    if (partes.length === 1) {
      var pref = partes[0].toLowerCase();
      var c = COMANDOS.filter(function (x) { return x.indexOf(pref) === 0; });
      if (c.length === 1) this.entrada.value = c[0] + ' ';
      else if (c.length > 1) this.imprimir(c.join('   '), 'ayuda');
    } else if (partes.length === 2 && /^(ping|tracert|traceroute|nslookup)$/i.test(partes[0])) {
      var p2 = partes[1].toLowerCase();
      var d = Object.keys(global.RedEngine.DOMINIOS).filter(function (x) { return p2 && x.indexOf(p2) === 0; });
      if (d.length === 1) this.entrada.value = partes[0] + ' ' + d[0];
      else if (d.length > 1) this.imprimir(d.join('   '), 'ayuda');
    }
  };

  /** Encola la ejecución para que los comandos no se mezclen. */
  Consola.prototype.enviar = function (texto) {
    var self = this;
    this.cola = this.cola.then(function () { return self.ejecutar(texto); });
    return this.cola;
  };

  Consola.prototype._volcar = function (lineas, lento) {
    var self = this;
    var retardo = lento && !this.reducido ? 220 : 0;
    var p = Promise.resolve();
    lineas.forEach(function (l) {
      p = p.then(function () {
        self.imprimir(l.t, l.c);
        return retardo ? dormir(retardo) : null;
      });
    });
    return p;
  };

  Consola.prototype.ejecutar = function (texto) {
    var self = this, ctx = this.ctx, E = global.RedEngine;
    var t = (texto || '').trim();
    this.actualizarPrompt();
    var red = ctx.getRed(), id = ctx.getNodoId();
    var nodo = red && id ? red.nodos[id] : null;
    this.imprimir((nodo ? nodo.nombre : '') + '> ' + t, 'cmd');
    if (t === '') return Promise.resolve();
    this.historial.push(t);
    this.posHist = this.historial.length;
    if (ctx.onComando) ctx.onComando(t);

    var args = t.split(/\s+/), cmd = args[0].toLowerCase();
    if (cmd === 'clear' || cmd === 'cls') { this.limpiar(); return Promise.resolve(); }
    if (cmd === 'help' || cmd === '?') {
      return this._volcar([
        { t: 'Comandos disponibles:', c: 'ok' },
        { t: '  ping <ip|dominio>        Comprueba si un equipo responde (tiempo y TTL).' },
        { t: '  traceroute <ip|dominio>  Muestra los saltos hasta el destino (alias: tracert).' },
        { t: '  ipconfig                 Muestra la configuración IP del equipo (alias: ifconfig).' },
        { t: '  ipconfig /renew          Pide una IP al servidor DHCP (alias: dhclient).' },
        { t: '  ipconfig /release        Libera la IP actual.' },
        { t: '  nslookup <dominio>       Pregunta al DNS qué IP tiene un nombre.' },
        { t: '  arp -a                   Tabla ARP: IP ↔ dirección MAC conocidas.' },
        { t: '  history                  Comandos anteriores (también flechas ↑ ↓).' },
        { t: '  clear                    Limpia la pantalla.' },
        { t: 'Truco: pulsa Tab para autocompletar. Prueba «ping 192.168.1.1».', c: 'ayuda' }
      ], false);
    }
    if (cmd === 'history') {
      return this._volcar(this.historial.map(function (h, i) { return { t: '  ' + (i + 1) + '  ' + h, c: '' }; }), false);
    }
    if (COMANDOS.indexOf(cmd) === -1) {
      return this._volcar([
        { t: '«' + args[0] + '» no se reconoce como un comando.', c: 'err' },
        { t: 'Pista: escribe «help» para ver la lista de comandos disponibles.', c: 'ayuda' }
      ], false);
    }
    if (!nodo || nodo.tipo === 'switch') {
      return this._volcar([
        { t: 'Selecciona un PC o un router en el diagrama para usar su consola (el switch no tiene consola).', c: 'warn' }
      ], false);
    }

    var res, lento = false;
    if (cmd === 'ping') {
      if (!args[1]) return this._volcar([{ t: 'Uso: ping <ip|dominio>', c: 'err' }], false);
      res = E.ping(red, id, args[1]); lento = true;
    } else if (cmd === 'tracert' || cmd === 'traceroute') {
      if (!args[1]) return this._volcar([{ t: 'Uso: ' + cmd + ' <ip|dominio>', c: 'err' }], false);
      res = E.traceroute(red, id, args[1]); lento = true;
    } else if (cmd === 'ipconfig' || cmd === 'ifconfig') {
      var op = (args[1] || '').toLowerCase();
      if (op === '/renew') res = E.dhcpRenovar(red, id);
      else if (op === '/release') res = E.dhcpLiberar(red, id);
      else res = E.ipconfig(red, id, cmd === 'ifconfig');
    } else if (cmd === 'dhclient') {
      res = E.dhcpRenovar(red, id);
    } else if (cmd === 'nslookup') {
      res = E.nslookup(red, id, args[1]);
    } else if (cmd === 'arp') {
      if ((args[1] || '').toLowerCase() !== '-a') {
        return this._volcar([{ t: 'Uso: arp -a', c: 'err' }], false);
      }
      res = E.tablaArp(red, id);
    }
    if (res.ruta && res.ruta.length && ctx.onRuta) ctx.onRuta(res.ruta, res.ok, cmd);
    return this._volcar(res.lineas, lento).then(function () {
      if (res.cambio && ctx.onCambioConfig) ctx.onCambioConfig();
      self.entrada.focus();
    });
  };

  Consola.prototype.textoRegistro = function () {
    return this.registro.join('\n');
  };

  global.Consola = Consola;
})(window);
