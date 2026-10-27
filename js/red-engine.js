/* tecnoLSM · Simulador de redes — motor de redes
 * Cálculo de subredes, validación IP y simulación de ping / traceroute / DNS / ARP / DHCP.
 * Sin dependencias. Expone window.RedEngine.
 */
(function (global) {
  'use strict';

  /* ---------- Utilidades IP ---------- */
  var OCTETO = /^(0|[1-9]\d{0,2})$/;

  function esIpValida(ip) {
    if (typeof ip !== 'string') return false;
    var p = ip.trim().split('.');
    if (p.length !== 4) return false;
    for (var i = 0; i < 4; i++) {
      if (!OCTETO.test(p[i]) || Number(p[i]) > 255) return false;
    }
    return true;
  }

  function ipAEntero(ip) {
    if (!esIpValida(ip)) return null;
    return ip.trim().split('.').reduce(function (a, o) { return a * 256 + Number(o); }, 0);
  }

  function enteroAIp(n) {
    n = n >>> 0;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }

  function prefijoAEnteroMascara(p) {
    if (p <= 0) return 0;
    if (p >= 32) return 0xFFFFFFFF;
    return (0xFFFFFFFF << (32 - p)) >>> 0;
  }

  function prefijoAMascara(p) { return enteroAIp(prefijoAEnteroMascara(p)); }

  /** Devuelve el prefijo (0-32) si la máscara es válida (unos contiguos), o null. */
  function mascaraAPrefijo(mascara) {
    var n = ipAEntero(mascara);
    if (n === null) return null;
    var inv = (~n) >>> 0;
    if ((inv & ((inv + 1) >>> 0)) !== 0 && inv !== 0xFFFFFFFF) return null;
    var bits = 0;
    for (var i = 31; i >= 0; i--) {
      if ((n >>> i) & 1) bits++; else break;
    }
    return bits;
  }

  function esMascaraValida(m) { return mascaraAPrefijo(m) !== null; }

  /** Acepta "/26", "26" o "255.255.255.192". Devuelve {prefijo, mascara} o null. */
  function parseMascara(txt) {
    if (typeof txt !== 'string') return null;
    var t = txt.trim();
    if (t === '') return null;
    var m = /^\/?(\d{1,2})$/.exec(t);
    if (m) {
      var p = Number(m[1]);
      if (p < 0 || p > 32) return null;
      return { prefijo: p, mascara: prefijoAMascara(p) };
    }
    var pr = mascaraAPrefijo(t);
    if (pr === null) return null;
    return { prefijo: pr, mascara: t };
  }

  function claseIp(ip) {
    var n = ipAEntero(ip);
    if (n === null) return '?';
    var o = n >>> 24;
    if (o < 128) return 'A';
    if (o < 192) return 'B';
    if (o < 224) return 'C';
    if (o < 240) return 'D (multidifusión)';
    return 'E (reservada)';
  }

  function esPrivada(ip) {
    var n = ipAEntero(ip);
    if (n === null) return false;
    var a = n >>> 24, b = (n >>> 16) & 255;
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }

  /* ---------- Calculadora de subredes ---------- */
  function calcSubred(ip, prefijo) {
    var n = ipAEntero(ip);
    if (n === null || typeof prefijo !== 'number' || prefijo < 0 || prefijo > 32) return null;
    var m = prefijoAEnteroMascara(prefijo);
    var red = (n & m) >>> 0;
    var bc = (red | (~m >>> 0)) >>> 0;
    var total = Math.pow(2, 32 - prefijo);
    var hosts = prefijo >= 31 ? 0 : total - 2;
    return {
      ip: ip.trim(),
      prefijo: prefijo,
      mascara: enteroAIp(m),
      wildcard: enteroAIp((~m) >>> 0),
      red: enteroAIp(red),
      redInt: red,
      broadcast: enteroAIp(bc),
      primerHost: hosts > 0 ? enteroAIp(red + 1) : '—',
      ultimoHost: hosts > 0 ? enteroAIp(bc - 1) : '—',
      hosts: hosts,
      totalDirecciones: total,
      clase: claseIp(ip),
      privada: esPrivada(ip),
      subredesDeClase: null
    };
  }

  /** Divide la red ip/prefijo en (al menos) n subredes iguales. */
  function dividirEnSubredes(ip, prefijo, n) {
    var base = calcSubred(ip, prefijo);
    if (!base) return { error: 'IP o máscara no válidas.' };
    n = Number(n);
    if (!isFinite(n) || n < 1 || Math.floor(n) !== n) return { error: 'El número de subredes debe ser un entero mayor o igual que 1.' };
    var bits = n === 1 ? 0 : Math.ceil(Math.log(n) / Math.LN2);
    // corrige errores de redondeo de log
    while (Math.pow(2, bits) < n) bits++;
    while (bits > 0 && Math.pow(2, bits - 1) >= n) bits--;
    var nuevo = prefijo + bits;
    if (nuevo > 30) {
      return { error: 'No se puede dividir en ' + n + ' subredes: quedarían menos de 2 hosts útiles por subred (prefijo /' + nuevo + ').' };
    }
    var cantidad = Math.pow(2, bits);
    var tam = Math.pow(2, 32 - nuevo);
    var lista = [];
    for (var i = 0; i < cantidad; i++) {
      var r = calcSubred(enteroAIp(base.redInt + i * tam), nuevo);
      r.indice = i + 1;
      lista.push(r);
    }
    return {
      base: base,
      solicitadas: n,
      bitsPrestados: bits,
      cantidad: cantidad,
      redondeado: cantidad !== n,
      nuevoPrefijo: nuevo,
      mascara: prefijoAMascara(nuevo),
      hostsPorSubred: lista[0].hosts,
      subredes: lista
    };
  }

  /* ---------- Validación de configuración de un nodo ---------- */
  var EXPLICA = {
    ip: 'La dirección IP identifica a un equipo dentro de la red, como el número de tu casa en una calle. Son 4 números entre 0 y 255 separados por puntos (por ejemplo 192.168.1.10).',
    mask: 'La máscara de subred indica qué parte de la IP identifica a la red y cuál al equipo. 255.255.255.0 (también escrita /24) significa que los 3 primeros números son la red y el último es el equipo.',
    gw: 'El gateway (puerta de enlace) es la IP del router al que se envían los paquetes cuyo destino está fuera de tu red. Tiene que estar en tu misma red.',
    dns: 'El servidor DNS traduce nombres (google.com) en direcciones IP. Si no es correcto, no podrás navegar por nombre.',
    red: 'La primera dirección de una red (todos los bits de equipo a 0) es la dirección de la propia red y no se puede asignar a un equipo.',
    bc: 'La última dirección de una red (todos los bits de equipo a 1) es el broadcast: sirve para hablar con todos a la vez y no se puede asignar a un equipo.',
    dup: 'Dos equipos con la misma IP provocan un conflicto: la red no sabe a cuál entregar los paquetes.'
  };

  /** Devuelve lista de {campo, nivel:'error'|'aviso', msg, explica}. */
  function validarConfig(red, nodoId, cfg) {
    var res = [];
    function err(campo, msg, ex) { res.push({ campo: campo, nivel: 'error', msg: msg, explica: ex }); }
    function aviso(campo, msg, ex) { res.push({ campo: campo, nivel: 'aviso', msg: msg, explica: ex }); }

    var ip = (cfg.ip || '').trim(), mask = (cfg.mask || '').trim();
    var gw = (cfg.gw || '').trim(), dns = (cfg.dns || '').trim();
    var ipOk = false, maskOk = false, pre = null;

    if (ip === '') err('ip', 'Falta la dirección IP.', EXPLICA.ip);
    else if (!esIpValida(ip)) err('ip', 'La IP «' + ip + '» no es válida: necesita 4 números del 0 al 255 separados por puntos.', EXPLICA.ip);
    else ipOk = true;

    if (mask === '') err('mask', 'Falta la máscara de subred.', EXPLICA.mask);
    else if (!esMascaraValida(mask)) err('mask', 'La máscara «' + mask + '» no es válida: debe ser unos seguidos de ceros (p. ej. 255.255.255.0).', EXPLICA.mask);
    else {
      pre = mascaraAPrefijo(mask);
      if (pre < 8 || pre > 30) err('mask', 'La máscara /' + pre + ' no es útil para un equipo (usa entre /8 y /30).', EXPLICA.mask);
      else maskOk = true;
    }

    var info = null;
    if (ipOk && maskOk) {
      info = calcSubred(ip, pre);
      if (ip === info.red) err('ip', 'Esa IP es la dirección de red (' + info.red + '), no se puede asignar a un equipo.', EXPLICA.red);
      else if (ip === info.broadcast) err('ip', 'Esa IP es la dirección de broadcast (' + info.broadcast + '), no se puede asignar a un equipo.', EXPLICA.bc);
      if (red) {
        Object.keys(red.nodos).forEach(function (id) {
          var o = red.nodos[id];
          if (id !== nodoId && o.tipo !== 'switch' && o.cfg.ip === ip) {
            err('ip', 'La IP ' + ip + ' ya la usa ' + o.nombre + ' (conflicto de IP).', EXPLICA.dup);
          }
        });
      }
    }

    if (gw !== '') {
      if (!esIpValida(gw)) err('gw', 'El gateway «' + gw + '» no es una IP válida.', EXPLICA.gw);
      else if (info) {
        if (gw === ip) err('gw', 'El gateway no puede ser la propia IP del equipo.', EXPLICA.gw);
        else if ((ipAEntero(gw) & prefijoAEnteroMascara(pre)) >>> 0 !== info.redInt) {
          err('gw', 'El gateway ' + gw + ' está fuera de tu red (' + info.red + '/' + pre + '). El router debe estar en tu misma red.', EXPLICA.gw);
        }
      }
    } else {
      aviso('gw', 'Sin gateway: este equipo solo podrá comunicarse con su propia red.', EXPLICA.gw);
    }

    if (dns !== '') {
      if (!esIpValida(dns)) err('dns', 'El servidor DNS «' + dns + '» no es una IP válida.', EXPLICA.dns);
    } else {
      aviso('dns', 'Sin DNS: no podrás usar nombres como google.com.', EXPLICA.dns);
    }
    return res;
  }

  /* ---------- Modelo de red ---------- */
  function cfgPorDefecto(n, topo) {
    if (n.tipo === 'switch') return { ip: '', mask: '', gw: '', dns: '' };
    if (n.tipo === 'router') return { ip: n.ip || '', mask: '255.255.255.0', gw: '', dns: '' };
    var router = topo.nodos.filter(function (x) { return x.tipo === 'router' && x.ip; })[0];
    return { ip: n.ip || '', mask: '255.255.255.0', gw: router ? router.ip : '192.168.1.1', dns: '8.8.8.8' };
  }

  function crearRed(topo) {
    var nodos = {}, orden = [];
    topo.nodos.forEach(function (n) {
      var cfg = n.cfg ? JSON.parse(JSON.stringify(n.cfg)) : cfgPorDefecto(n, topo);
      nodos[n.id] = {
        id: n.id, tipo: n.tipo, nombre: n.nombre, x: n.x, y: n.y,
        x0: n.x, y0: n.y,
        cfg: cfg, orig: JSON.parse(JSON.stringify(n.orig || cfg))
      };
      orden.push(n.id);
    });
    return {
      id: topo.id, nombre: topo.nombre, descripcion: topo.descripcion || '',
      nodos: nodos, orden: orden,
      conexiones: topo.conexiones.map(function (c) { return { from: c.from, to: c.to }; }),
      arp: {}
    };
  }

  function vecinos(red, id) {
    var v = [];
    red.conexiones.forEach(function (c) {
      if (c.from === id) v.push(c.to); else if (c.to === id) v.push(c.from);
    });
    return v;
  }

  /** BFS: camino más corto (lista de ids) o null. */
  function camino(red, a, b) {
    if (!red.nodos[a] || !red.nodos[b]) return null;
    if (a === b) return [a];
    var prev = {}; prev[a] = null;
    var cola = [a];
    while (cola.length) {
      var u = cola.shift();
      var vs = vecinos(red, u);
      for (var i = 0; i < vs.length; i++) {
        var v = vs[i];
        if (v in prev) continue;
        prev[v] = u;
        if (v === b) {
          var ruta = [b], k = u;
          while (k !== null) { ruta.unshift(k); k = prev[k]; }
          return ruta;
        }
        cola.push(v);
      }
    }
    return null;
  }

  function nodoPorIp(red, ip) {
    for (var i = 0; i < red.orden.length; i++) {
      var n = red.nodos[red.orden[i]];
      if (n.tipo !== 'switch' && n.cfg.ip === ip) return n;
    }
    return null;
  }

  function cfgUsable(cfg) {
    return esIpValida(cfg.ip) && esMascaraValida(cfg.mask) && mascaraAPrefijo(cfg.mask) > 0;
  }

  function mismaRed(cfg, ipB) {
    if (!cfgUsable(cfg) || !esIpValida(ipB)) return false;
    var m = prefijoAEnteroMascara(mascaraAPrefijo(cfg.mask));
    return ((ipAEntero(cfg.ip) & m) >>> 0) === ((ipAEntero(ipB) & m) >>> 0);
  }

  function ttlDe(n) { return n.tipo === 'router' ? 64 : 128; }

  var EXTERNOS = {
    '8.8.8.8': { ms: 15, ttl: 117, nombre: 'dns.google' },
    '1.1.1.1': { ms: 12, ttl: 58, nombre: 'one.one.one.one' },
    '142.250.185.46': { ms: 18, ttl: 117, nombre: 'google.com' },
    '142.250.200.78': { ms: 20, ttl: 117, nombre: 'youtube.com' },
    '185.15.58.224': { ms: 28, ttl: 56, nombre: 'wikipedia.org' }
  };
  var DOMINIOS = {
    'google.com': '142.250.185.46',
    'www.google.com': '142.250.185.46',
    'youtube.com': '142.250.200.78',
    'wikipedia.org': '185.15.58.224',
    'es.wikipedia.org': '185.15.58.224'
  };

  function ipIsp(red) { return nodoPorIp(red, '10.0.0.1') ? '172.31.255.1' : '10.0.0.1'; }

  /* ---------- Prueba de conectividad (núcleo de ping / traceroute) ---------- */
  function probar(red, srcId, destIp) {
    var src = red.nodos[srcId], cfg = src.cfg;
    var r = { estado: 'ok', ruta: [srcId], ms: 1, ttl: ttlDe(src), desde: destIp, via: null, externo: null, ayuda: '' };

    if (!cfgUsable(cfg)) {
      r.estado = 'error';
      r.ayuda = 'La configuración IP de este equipo no es válida (revisa IP y máscara en el panel «Configuración»).';
      return r;
    }
    if (destIp === cfg.ip) { r.ms = 1; return r; }
    var dst = nodoPorIp(red, destIp);

    if (mismaRed(cfg, destIp)) {
      if (!dst) {
        r.estado = 'timeout';
        r.ayuda = 'Nadie responde en esa IP: el equipo no existe, está apagado o está en otra red.';
        return r;
      }
      var p = camino(red, srcId, dst.id);
      if (!p) {
        r.estado = 'timeout'; r.ruta = [srcId];
        r.ayuda = 'No hay ningún cable que una estos dos equipos.';
        return r;
      }
      if (!mismaRed(dst.cfg, cfg.ip)) {
        r.estado = 'timeout'; r.ruta = p;
        r.ayuda = 'El equipo existe pero está configurado con otra máscara o red, por eso no contesta.';
        return r;
      }
      var routers = p.slice(1, -1).filter(function (id) { return red.nodos[id].tipo === 'router'; }).length;
      r.ruta = p; r.ms = Math.max(1, Math.ceil((p.length - 1) / 2)); r.ttl = ttlDe(dst) - routers;
      return r;
    }

    // Destino en otra red: hay que salir por el gateway
    var gwNode = null, rutaGw = [srcId];
    if (src.tipo === 'router') {
      gwNode = src;
    } else {
      if ((cfg.gw || '').trim() === '') {
        r.estado = 'inalcanzable'; r.desde = cfg.ip;
        r.ayuda = 'El destino está en otra red y este equipo no tiene gateway. Sin puerta de enlace no se puede salir de la red local.';
        return r;
      }
      if (!mismaRed(cfg, cfg.gw)) {
        r.estado = 'inalcanzable'; r.desde = cfg.ip;
        r.ayuda = 'El gateway ' + cfg.gw + ' no está en tu misma red, así que el equipo no sabe cómo llegar a él.';
        return r;
      }
      gwNode = nodoPorIp(red, cfg.gw);
      rutaGw = gwNode ? camino(red, srcId, gwNode.id) : null;
      if (!gwNode || !rutaGw) {
        r.estado = 'inalcanzable'; r.desde = cfg.ip; r.ruta = [srcId];
        r.ayuda = 'La puerta de enlace ' + cfg.gw + ' no responde: no hay ningún router con esa IP conectado a esta red.';
        return r;
      }
    }
    r.via = gwNode; r.ruta = rutaGw;
    var extra = Math.max(1, Math.ceil((rutaGw.length - 1) / 2));
    if (dst) {
      var pd = camino(red, srcId, dst.id);
      if (pd && gwNode.tipo === 'router') {
        r.ruta = pd; r.ms = extra + 1; r.ttl = ttlDe(dst) - 1;
        return r;
      }
      r.estado = 'timeout';
      r.ayuda = 'El router no sabe cómo llegar a ese equipo.';
      return r;
    }
    var ext = EXTERNOS[destIp];
    if (ext) {
      r.externo = ext; r.ms = ext.ms + extra; r.ttl = ext.ttl;
      return r;
    }
    r.estado = 'timeout';
    r.ayuda = 'El paquete salió por el router pero esa IP no responde en Internet.';
    return r;
  }

  /* ---------- DNS ---------- */
  function consultaDns(red, srcId, nombre) {
    var cfg = red.nodos[srcId].cfg;
    var dns = (cfg.dns || '').trim();
    var n = (nombre || '').trim().toLowerCase();
    if (dns === '') return { estado: 'sin_dns', ayuda: 'Este equipo no tiene servidor DNS configurado.' };
    if (!esIpValida(dns)) return { estado: 'sin_dns', ayuda: 'El servidor DNS configurado no es una IP válida.' };
    var pr = probar(red, srcId, dns);
    var local = nodoPorIp(red, dns);
    var servidorOk = pr.estado === 'ok' && (local || EXTERNOS[dns]);
    var nombreSrv = local ? local.nombre : (EXTERNOS[dns] ? EXTERNOS[dns].nombre : dns);
    if (!servidorOk) {
      return { estado: 'timeout', servidor: dns, servidorNombre: nombreSrv, ayuda: 'El servidor DNS ' + dns + ' no responde (no hay conexión con él).' };
    }
    if (!DOMINIOS[n]) return { estado: 'nxdomain', servidor: dns, servidorNombre: nombreSrv, ayuda: 'El dominio no existe en la base de datos del simulador. Prueba con google.com, youtube.com o wikipedia.org.' };
    return { estado: 'ok', ip: DOMINIOS[n], servidor: dns, servidorNombre: nombreSrv, ruta: pr.ruta };
  }

  function nslookup(red, srcId, nombre) {
    var L = [];
    function l(t, c) { L.push({ t: t, c: c || '' }); }
    if (!nombre) { l('Uso: nslookup <dominio>', 'err'); return { lineas: L, ruta: [], ok: false }; }
    var q = consultaDns(red, srcId, nombre);
    if (q.estado === 'ok') {
      l('Servidor:  ' + q.servidorNombre); l('Address:  ' + q.servidor); l('');
      l('Respuesta no autoritativa:'); l('Nombre:   ' + nombre.toLowerCase()); l('Address:  ' + q.ip, 'ok');
      return { lineas: L, ruta: q.ruta, ok: true };
    }
    if (q.estado === 'sin_dns') {
      l('*** No hay servidor DNS disponible.', 'err'); l('Pista: ' + q.ayuda, 'ayuda');
    } else if (q.estado === 'timeout') {
      l('Servidor:  ' + q.servidorNombre); l('Address:  ' + q.servidor); l('');
      l('DNS request timed out. (tiempo de espera agotado)', 'err'); l('Pista: ' + q.ayuda, 'ayuda');
    } else {
      l('Servidor:  ' + q.servidorNombre); l('Address:  ' + q.servidor); l('');
      l('*** ' + q.servidorNombre + ' no encuentra ' + nombre + ': Non-existent domain', 'err');
      l('Pista: ' + q.ayuda, 'ayuda');
    }
    return { lineas: L, ruta: [], ok: false };
  }

  /** Resuelve un destino que puede ser IP o nombre. */
  function resolverDestino(red, srcId, txt) {
    if (esIpValida(txt)) return { ip: txt.trim(), nombre: null };
    var q = consultaDns(red, srcId, txt);
    if (q.estado === 'ok') return { ip: q.ip, nombre: txt.toLowerCase() };
    var ay = q.estado === 'sin_dns' || q.estado === 'timeout' ? q.ayuda : 'Ese nombre no existe. ' + q.ayuda;
    return {
      error: true,
      lineas: [
        { t: 'No se pudo encontrar el host «' + txt + '». Compruebe el nombre y vuelva a intentarlo.', c: 'err' },
        { t: 'Pista: ' + ay + ' (Prueba con la IP directamente, p. ej. 8.8.8.8).', c: 'ayuda' }
      ]
    };
  }

  /* ---------- ARP ---------- */
  function macDe(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    function hx(b) { return ('0' + (b & 255).toString(16)).slice(-2).toUpperCase(); }
    return '02-4C-53-' + hx(h >>> 16) + '-' + hx(h >>> 8) + '-' + hx(h);
  }

  function registrarArp(red, srcId, ipDestino) {
    var cfg = red.nodos[srcId].cfg, dst = nodoPorIp(red, ipDestino);
    if (!dst || dst.id === srcId || !mismaRed(cfg, ipDestino)) return;
    red.arp[srcId] = red.arp[srcId] || {};
    red.arp[srcId][dst.id] = true;
  }

  function tablaArp(red, srcId) {
    var L = [], ids = Object.keys(red.arp[srcId] || {});
    function l(t, c) { L.push({ t: t, c: c || '' }); }
    var cfg = red.nodos[srcId].cfg;
    if (!ids.length) {
      l('No se encontraron entradas ARP.', 'warn');
      l('Pista: ARP guarda la relación IP ↔ dirección MAC de los equipos con los que ya has hablado. Haz ping a otro equipo de tu red y vuelve a ejecutar «arp -a».', 'ayuda');
      return { lineas: L, ok: true };
    }
    l('Interfaz: ' + cfg.ip + ' --- 0x2');
    l('  Dirección de Internet   Dirección física      Tipo');
    ids.forEach(function (id) {
      var n = red.nodos[id];
      l('  ' + (n.cfg.ip + '                ').slice(0, 24) + macDe(id) + '     dinámico');
    });
    return { lineas: L, ok: true };
  }

  /* ---------- ipconfig / ifconfig ---------- */
  function ipconfig(red, srcId, estiloLinux) {
    var n = red.nodos[srcId], c = n.cfg, L = [];
    function l(t) { L.push({ t: t, c: '' }); }
    var pre = esMascaraValida(c.mask) ? mascaraAPrefijo(c.mask) : null;
    if (estiloLinux) {
      l('eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>');
      if (cfgUsable(c)) {
        l('        inet ' + c.ip + '  netmask ' + c.mask + '  broadcast ' + calcSubred(c.ip, pre).broadcast);
      } else l('        (sin dirección IPv4 válida)');
      l('        ether ' + macDe(srcId).toLowerCase().replace(/-/g, ':') + '  txqueuelen 1000  (Ethernet)');
      l('        gateway ' + (c.gw || '—') + '   dns ' + (c.dns || '—'));
      return { lineas: L, ok: true };
    }
    l('Configuración IP de Windows'); l('');
    l('Adaptador de Ethernet Ethernet0 (' + n.nombre + '):'); l('');
    l('   Dirección IPv4. . . . . . . . . . : ' + (c.ip || '0.0.0.0'));
    l('   Máscara de subred . . . . . . . . : ' + (c.mask || '0.0.0.0'));
    l('   Puerta de enlace predeterminada . : ' + (c.gw || ''));
    l('   Servidor DNS. . . . . . . . . . . : ' + (c.dns || ''));
    l('   Dirección física. . . . . . . . . : ' + macDe(srcId));
    return { lineas: L, ok: true };
  }

  /* ---------- DHCP ---------- */
  function dhcpRenovar(red, srcId) {
    var L = [];
    function l(t, c) { L.push({ t: t, c: c || '' }); }
    var src = red.nodos[srcId];
    if (src.tipo === 'router') { l('Un router tiene IP fija; no pide dirección por DHCP.', 'warn'); return { lineas: L, ok: false, ruta: [], cambio: false }; }
    var servidor = null, ruta = null;
    red.orden.forEach(function (id) {
      var n = red.nodos[id];
      if (!servidor && n.tipo === 'router' && cfgUsable(n.cfg)) {
        var p = camino(red, srcId, id);
        if (p) { servidor = n; ruta = p; }
      }
    });
    l('Enviando DHCPDISCOVER (broadcast): «¿hay algún servidor DHCP?»');
    if (!servidor) {
      l('Tiempo agotado: no se encontró ningún servidor DHCP.', 'err');
      l('Pista: DHCP necesita un router (o servidor) conectado a la red que reparta direcciones. En esta topología no hay ninguno.', 'ayuda');
      return { lineas: L, ok: false, ruta: [], cambio: false };
    }
    var pre = mascaraAPrefijo(servidor.cfg.mask);
    var sub = calcSubred(servidor.cfg.ip, pre);
    var libre = null;
    for (var h = sub.redInt + 100; h < sub.redInt + sub.totalDirecciones - 1; h++) {
      var cand = enteroAIp(h);
      if (!nodoPorIp(red, cand)) { libre = cand; break; }
    }
    if (!libre) {
      for (var h2 = sub.redInt + 2; h2 < sub.redInt + sub.totalDirecciones - 1; h2++) {
        var c2 = enteroAIp(h2);
        if (!nodoPorIp(red, c2)) { libre = c2; break; }
      }
    }
    if (!libre) { l('El servidor DHCP no tiene direcciones libres.', 'err'); return { lineas: L, ok: false, ruta: ruta, cambio: false }; }
    l('Recibido DHCPOFFER de ' + servidor.cfg.ip + ': te ofrece la IP ' + libre);
    l('Enviando DHCPREQUEST: «acepto esa IP»');
    l('Recibido DHCPACK: concesión concedida.', 'ok');
    src.cfg = { ip: libre, mask: servidor.cfg.mask, gw: servidor.cfg.ip, dns: '8.8.8.8' };
    l('IP ' + libre + ' · máscara ' + servidor.cfg.mask + ' · gateway ' + servidor.cfg.ip + ' · DNS 8.8.8.8');
    return { lineas: L, ok: true, ruta: ruta, cambio: true };
  }

  function dhcpLiberar(red, srcId) {
    red.nodos[srcId].cfg = { ip: '', mask: '', gw: '', dns: '' };
    return { lineas: [
      { t: 'Dirección IP liberada. El equipo ya no tiene configuración de red.', c: 'warn' },
      { t: 'Pista: usa «ipconfig /renew» para pedir una nueva IP por DHCP.', c: 'ayuda' }
    ], ok: true, ruta: [], cambio: true };
  }

  /* ---------- Ping ---------- */
  function ping(red, srcId, destino) {
    var L = [];
    function l(t, c) { L.push({ t: t, c: c || '' }); }
    var d = resolverDestino(red, srcId, destino);
    if (d.error) return { lineas: d.lineas, ruta: [], ok: false, estado: 'error' };
    var ip = d.ip;
    var r = probar(red, srcId, ip);
    var etiqueta = d.nombre ? d.nombre + ' [' + ip + ']' : ip;
    l('Haciendo ping a ' + etiqueta + ' con 32 bytes de datos:');
    var recibidos = 0, tiempos = [];
    if (r.estado === 'error') {
      l('PING: fallo en la transmisión. Error general.', 'err');
      l('Pista: ' + r.ayuda, 'ayuda');
      return { lineas: L, ruta: [], ok: false, estado: 'error' };
    }
    for (var i = 0; i < 4; i++) {
      if (r.estado === 'ok') {
        var ms = r.ms + (i === 2 ? 1 : 0);
        tiempos.push(ms); recibidos++;
        l('Respuesta desde ' + ip + ': bytes=32 tiempo=' + ms + 'ms TTL=' + r.ttl, 'ok');
      } else if (r.estado === 'inalcanzable') {
        l('Respuesta desde ' + r.desde + ': Host de destino inaccesible.', 'err');
      } else {
        l('Tiempo de espera agotado para esta solicitud.', 'err');
      }
    }
    l('');
    l('Estadísticas de ping para ' + ip + ':');
    var perd = 4 - recibidos;
    l('    Paquetes: enviados = 4, recibidos = ' + recibidos + ', perdidos = ' + perd + ' (' + (perd * 25) + '% perdidos)');
    if (recibidos) {
      var mn = Math.min.apply(null, tiempos), mx = Math.max.apply(null, tiempos);
      var media = Math.round(tiempos.reduce(function (a, b) { return a + b; }, 0) / tiempos.length);
      l('Tiempos aproximados de ida y vuelta en milisegundos:');
      l('    Mínimo = ' + mn + 'ms, Máximo = ' + mx + 'ms, Media = ' + media + 'ms');
    } else if (r.ayuda) {
      l('Pista: ' + r.ayuda, 'ayuda');
    }
    if (r.estado === 'ok') registrarArp(red, srcId, ip);
    if (r.via && r.estado !== 'error') registrarArp(red, srcId, r.via.cfg.ip);
    var rutaVis = r.ruta.slice();
    if (r.estado === 'ok' && r.externo && r.via) rutaVis = r.ruta;
    return { lineas: L, ruta: rutaVis, ok: r.estado === 'ok', estado: r.estado, externo: !!r.externo, ip: ip };
  }

  /* ---------- Traceroute ---------- */
  function traceroute(red, srcId, destino) {
    var L = [];
    function l(t, c) { L.push({ t: t, c: c || '' }); }
    var d = resolverDestino(red, srcId, destino);
    if (d.error) return { lineas: d.lineas, ruta: [], ok: false, estado: 'error' };
    var ip = d.ip, src = red.nodos[srcId];
    var r = probar(red, srcId, ip);
    var etq = d.nombre ? d.nombre + ' [' + ip + ']' : ip;
    l('Traza a ' + etq + ' sobre un máximo de 30 saltos:'); l('');
    function salto(n, ms, ip2, nombre) {
      var t = ms + ' ms';
      l('  ' + n + '   ' + ('    ' + t).slice(-6) + '  ' + ('    ' + t).slice(-6) + '  ' + ('    ' + t).slice(-6) + '   ' + ip2 + (nombre ? ' (' + nombre + ')' : ''));
    }
    function perdido(n) { l('  ' + n + '       *        *        *     Tiempo de espera agotado para esta solicitud.', 'err'); }
    if (r.estado === 'error') {
      l('Error: la configuración IP de este equipo no es válida.', 'err'); l('Pista: ' + r.ayuda, 'ayuda');
      return { lineas: L, ruta: [], ok: false, estado: 'error' };
    }
    if (r.estado === 'inalcanzable') {
      l('  1   ' + r.desde + '  Host de destino inaccesible.', 'err');
      l('Pista: ' + r.ayuda, 'ayuda');
      l(''); l('Traza completa.');
      return { lineas: L, ruta: r.ruta, ok: false, estado: r.estado };
    }
    var n = 1;
    if (r.via) {
      // Salto por el gateway (si el origen no es el propio router)
      if (r.via.id !== srcId) {
        salto(n++, Math.max(1, Math.ceil((camino(red, srcId, r.via.id).length - 1) / 2)), r.via.cfg.ip, r.via.nombre);
      }
      if (r.externo || r.estado === 'timeout') {
        salto(n++, 5, ipIsp(red), 'ISP');
        if (r.externo) {
          salto(n++, r.externo.ms, ip, d.nombre || r.externo.nombre);
        } else {
          perdido(n++); perdido(n++);
          l('Pista: ' + r.ayuda, 'ayuda');
        }
      } else {
        // destino en otra red conocida del simulador
        salto(n++, r.ms, ip, nodoPorIp(red, ip).nombre);
      }
    } else if (r.estado === 'ok') {
      // Misma red: cuentan los routers intermedios y el destino (los switches no son saltos)
      r.ruta.slice(1).forEach(function (id, idx) {
        var nd = red.nodos[id];
        if (nd.tipo !== 'switch') salto(n++, Math.max(1, Math.ceil((idx + 1) / 2)), nd.cfg.ip, nd.nombre);
      });
      if (r.ruta.length === 1) salto(n++, 1, ip, src.nombre);
    } else {
      perdido(n++); perdido(n++); perdido(n++);
      l('Pista: ' + r.ayuda, 'ayuda');
    }
    l(''); l('Traza completa.');
    return { lineas: L, ruta: r.ruta, ok: r.estado === 'ok', estado: r.estado, externo: !!r.externo, ip: ip };
  }

  global.RedEngine = {
    esIpValida: esIpValida, ipAEntero: ipAEntero, enteroAIp: enteroAIp,
    esMascaraValida: esMascaraValida, mascaraAPrefijo: mascaraAPrefijo, prefijoAMascara: prefijoAMascara,
    parseMascara: parseMascara, claseIp: claseIp, esPrivada: esPrivada,
    calcSubred: calcSubred, dividirEnSubredes: dividirEnSubredes,
    validarConfig: validarConfig, EXPLICA: EXPLICA,
    crearRed: crearRed, vecinos: vecinos, camino: camino, nodoPorIp: nodoPorIp, mismaRed: mismaRed,
    probar: probar, ping: ping, traceroute: traceroute, nslookup: nslookup, consultaDns: consultaDns,
    tablaArp: tablaArp, ipconfig: ipconfig, dhcpRenovar: dhcpRenovar, dhcpLiberar: dhcpLiberar,
    macDe: macDe, DOMINIOS: DOMINIOS, EXTERNOS: EXTERNOS
  };
})(window);
