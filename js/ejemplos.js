/* tecnoLSM · Simulador de redes — ejemplos guiados y conceptos clave
 * Los 10 ejemplos (títulos y descripciones) vienen de data/redes_datos.json;
 * aquí se añade, por id, la acción que ejecuta el botón «Cargar» y los pasos guiados.
 * Expone window.EjemplosRedes.
 */
(function (global) {
  'use strict';

  var ACCIONES = {
    ej1: { tipo: 'topologia', topologia: 'estrella', pasos: [
      'Mira el diagrama: los 4 PC y el router salen del switch central, como los radios de una rueda.',
      'Si se rompe un cable, solo se desconecta ese equipo; el resto sigue funcionando.',
      'Pero si falla el switch, se cae toda la red. Es su punto débil.'
    ] },
    ej2: { tipo: 'topologia', topologia: 'bus', pasos: [
      'Los equipos se enlazan en cadena a lo largo de un único cable.',
      'Todos comparten el mismo medio: si dos hablan a la vez, chocan.',
      'Prueba a hacer ping de PC-1 a PC-4 y fíjate en cuántos saltos de cable atraviesa.'
    ] },
    ej3: { tipo: 'topologia', topologia: 'anillo', pasos: [
      'Cada equipo se conecta al siguiente y el último con el primero.',
      'Los datos viajan en una dirección dando vueltas por el anillo.',
      'Haz ping de PC-1 a PC-3 y observa el camino más corto que elige el simulador.'
    ] },
    ej4: { tipo: 'topologia', topologia: 'malla', pasos: [
      'Aquí cada router se conecta con todos los demás: hay muchos caminos posibles.',
      'Si un enlace falla, los datos pueden ir por otro camino (redundancia).',
      'El precio: muchos cables y mucho coste. Solo se usa en redes críticas.'
    ] },
    ej5: { tipo: 'calculadora', ip: '192.168.1.50', mascara: '/24', pasos: [
      'La IP 192.168.1.50 con máscara 255.255.255.0 (/24): los 3 primeros números son la red.',
      'Dirección de red: 192.168.1.0. Broadcast: 192.168.1.255.',
      'Los equipos pueden usar de 192.168.1.1 a 192.168.1.254 (254 hosts).'
    ] },
    ej6: { tipo: 'calculadora', ip: '192.168.1.0', mascara: '/24', subredes: 4, pasos: [
      'Para 4 subredes hacen falta 2 bits más (2² = 4): la máscara pasa de /24 a /26.',
      'Cada subred tiene 2⁶ = 64 direcciones, de las que 62 son para equipos.',
      'Mira la tabla: 192.168.1.0, .64, .128 y .192 son las redes resultantes.'
    ] },
    ej7: { tipo: 'consola', topologia: 'estrella', nodo: 'pc1', comandos: ['nslookup google.com', 'ping google.com'], pasos: [
      'El PC pregunta al servidor DNS configurado (8.8.8.8) qué IP tiene google.com.',
      'El DNS responde con una IP: 142.250.185.46.',
      'Con esa IP, ping ya puede enviar paquetes. Prueba a borrar el DNS del PC y repetir.'
    ] },
    ej8: { tipo: 'consola', topologia: 'estrella', nodo: 'pc3', comandos: ['ipconfig /release', 'ipconfig /renew', 'ipconfig'], pasos: [
      'Primero liberamos la IP: el PC se queda sin configuración.',
      'Con /renew el PC grita «¿hay DHCP?» (DISCOVER) y el router le ofrece una IP libre.',
      'Al final ipconfig muestra IP, máscara, gateway y DNS recibidos sin escribir nada a mano.'
    ] },
    ej9: { tipo: 'consola', topologia: 'estrella', nodo: 'pc1', comandos: ['ping 192.168.1.1', 'ping 192.168.1.99'], pasos: [
      'El primer ping llega al router: respuestas con tiempo y TTL. La red local funciona.',
      'El segundo va a una IP que no existe: «Tiempo de espera agotado».',
      'Recuerda: sin respuesta no siempre es avería; quizá ese equipo no existe.'
    ] },
    ej10: { tipo: 'consola', topologia: 'estrella', nodo: 'pc1', comandos: ['tracert 8.8.8.8'], pasos: [
      'Salto 1: tu router (gateway). Salto 2: el router de tu operador (ISP).',
      'Salto 3: el destino. Cada salto es un router que reenvía el paquete.',
      'Los switches no aparecen: trabajan en capa 2 y no cuentan como salto.'
    ] }
  };

  var CONCEPTOS = [
    { id: 'topologia', t: 'Topología', d: 'Es la forma en que se conectan los equipos de una red. Las cuatro básicas son estrella, bus, anillo y malla.' },
    { id: 'ip', t: 'Dirección IP', d: 'Número que identifica a un equipo en una red, como 192.168.1.10. Son 4 números (0–255) separados por puntos. Funciona como la dirección postal del equipo.' },
    { id: 'mascara', t: 'Máscara de subred', d: 'Indica qué parte de la IP es la red y cuál es el equipo. 255.255.255.0 equivale a /24: 24 bits para la red y 8 para los equipos.' },
    { id: 'gateway', t: 'Gateway (puerta de enlace)', d: 'La IP del router por el que sale el tráfico hacia otras redes (por ejemplo Internet). Debe estar en tu misma red.' },
    { id: 'dns', t: 'DNS', d: 'El «listín telefónico» de Internet: traduce nombres como google.com en direcciones IP.' },
    { id: 'dhcp', t: 'DHCP', d: 'Servicio que reparte IPs automáticamente a los equipos que se conectan, junto con máscara, gateway y DNS. Así no hay que configurarlos a mano.' },
    { id: 'switch', t: 'Switch', d: 'Conecta equipos de una misma red local. Trabaja en la capa 2 (enlace) y reenvía las tramas usando direcciones MAC.' },
    { id: 'router', t: 'Router', d: 'Conecta redes distintas entre sí (tu casa con Internet). Trabaja en la capa 3 (red) y decide por dónde enviar cada paquete según su IP de destino.' },
    { id: 'ping', t: 'Ping', d: 'Envía pequeños paquetes ICMP a un equipo y mide cuánto tardan en volver. Sirve para comprobar si hay conexión. TTL es el «tiempo de vida» del paquete.' },
    { id: 'traceroute', t: 'Traceroute', d: 'Muestra todos los routers (saltos) por los que pasa un paquete hasta su destino y cuánto tarda en cada uno.' },
    { id: 'subred', t: 'Subred', d: 'Parte de una red más grande, creada «tomando prestados» bits de la zona de equipos. Sirve para organizar y separar equipos. Ej.: 192.168.1.0/24 en 4 subredes /26.' }
  ];

  /** Combina los ejemplos del JSON con sus acciones y pasos. */
  function combinar(ejemplosJson) {
    return ejemplosJson.map(function (e) {
      var a = ACCIONES[e.id] || {};
      return {
        id: e.id, titulo: e.titulo, descripcion: e.descripcion, concepto: e.concepto,
        topologia: e.topologia || a.topologia || null,
        accion: a
      };
    });
  }

  global.EjemplosRedes = { ACCIONES: ACCIONES, CONCEPTOS: CONCEPTOS, combinar: combinar };
})(window);
