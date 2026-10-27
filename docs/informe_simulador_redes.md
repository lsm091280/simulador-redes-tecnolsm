# Informe — Simulador de redes tecnoLSM

Fecha: 27/10/2026 · Estado: MVP completo escrito. **No se ha ejecutado en navegador** (regla de oro 1: sin terminal). Los valores de verificación se han comprobado leyendo el código, no ejecutándolo; el auditor debe confirmarlos con Puppeteer.

## Qué se ha hecho

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura: cabecera con selector de topología y toggle de tema, diagrama SVG, consola, panel con 6 pestañas (Configuración, Subredes, Conceptos, Ejemplos, Examen, Archivo), footer y watermark. Solo atributo `class`. |
| `css/styles.css` | Variables brand exactas (`:root`, `[data-theme]`), `color-scheme` light/dark/print, fuentes Space Grotesk / DM Sans / IBM Plex Mono, `--ok` para paquetes, responsive, `prefers-reduced-motion`. |
| `js/red-engine.js` | IP/máscara, calculadora y división en subredes, validación de configuración (con explicaciones), modelo de red, BFS de rutas, ping, traceroute, nslookup, ARP, ipconfig/ifconfig, DHCP simulado. |
| `js/diagrama-red.js` | SVG con nodos PC/switch/router, arrastre (ratón, táctil y flechas de teclado), paquetes ambientales, animación de ida/vuelta, resaltado de ruta (acento) o fallo (rojo). |
| `js/consola.js` | `ping`, `traceroute`/`tracert`, `ipconfig`/`ifconfig` (+`/renew`, `/release`), `dhclient`, `nslookup`, `arp -a`, `help`, `history`, `clear`; historial ↑↓, Tab. |
| `js/ejemplos.js` | 10 ejemplos guiados (acción + pasos por id) y 11 conceptos clave. |
| `js/examenes.js` | 5 ejercicios con validación, contador de intentos y tiempo (guardado en localStorage). |
| `js/app.js` | Orquestación, panel de configuración con validación en tiempo real, calculadora, exportar/importar JSON, exportar .txt, borrador en localStorage, tema persistido. |
| `favicon.svg`, `robots.txt` | Básicos. |

`data/redes_datos.json` **no se ha tocado**.

## Valores de verificación

1. Topologías: **4** (estrella, bus, anillo, malla) — se cargan del JSON.
2. Escenarios IP en el JSON: **4** (el simulador no los muestra como lista propia; la calculadora cubre los mismos casos).
3. Ejemplos guiados: **10** (`ej1`–`ej10`).
4. Enunciados de examen: **5** (`ex1`–`ex5`).
5. `ping 192.168.1.1` desde PC-1 (estrella): `Respuesta desde 192.168.1.1: bytes=32 tiempo=1ms TTL=64`.
6. 192.168.1.0/24 → red 192.168.1.0, broadcast 192.168.1.255, 254 hosts.
7. 192.168.1.0/24 en 4 subredes → /26 (255.255.255.192), 62 hosts por subred; redes .0, .64, .128, .192.
8. Estrella: 6 nodos (4 PC + switch + router) y 5 conexiones (se muestra en el resumen).

Otros: `tracert 8.8.8.8` desde PC-1 → 3 saltos (192.168.1.1, 10.0.0.1 ISP, 8.8.8.8). `ping 192.168.1.254` → tiempo de espera agotado.

## Decisiones y desviaciones

- **Examen:** los enunciados son los del JSON (no el ejemplo «PC-3 en la misma red que PC-1»). La validación vive en `js/examenes.js`. ex1 es práctico (prepara la estrella con PC sin IP y valida la red); ex2 y ex5 piden valores calculados con el motor; ex3 y ex4 son de opción única.
- **Iconos:** nodos dibujados con formas SVG propias; no se han usado iconos MDI (no se podía descargar sin terminal).
- **Datos:** se cargan con `fetch`; abriendo `index.html` con `file://` aparece un aviso pidiendo un servidor web (Cloudflare Pages funciona).
- **Fase 2 adelantada:** ARP, resaltado de ruta, animación de paquetes y persistencia de posición de nodos ya incluidos.
- Los hosts de los «escenarios IP» del JSON (p. ej. clase A = 16 777 214) coinciden con el cálculo `2^n − 2`.

## Omitido / pendiente

- Prueba en navegador (JS escrito sin ejecutarlo): puede haber errores de ejecución que el auditor deba corregir.
- Lista visible de los 4 escenarios IP (solo se cubren vía calculadora y ejemplos 5–6).
- Sin routing entre subredes distintas dentro del simulador (solo salida por gateway a Internet simulada y a nodos conectados).
- No se ha desplegado nada en GitHub ni Cloudflare.
