# Plan: Simulador de redes informáticas — tecnoLSM

## 0. Contexto y decisiones (fijadas con Luis 27/10/2026)

- **Destinatarios:** alumnado de Digitalización 4º ESO. Nunca ha visto redes informáticas. El simulador debe ser pedagógico: conceptos explicados, ejemplos guiados, mensajes de error legibles.
- **Brand:** tecnoLSM completo (tema claro/oscuro, fuentes Space Grotesk / DM Sans / IBM Plex Mono, footer estándar, watermark).
- **Nivel:** ESO (Digitalización 4º): topologías (estrella, bus, anillo, malla), direccionamiento IP (clases A/B/C, máscara, subredes), DNS, DHCP, ping/traceroute con visualización animada.
- **Modo:** práctica libre con feedback inmediato + modo examen con enunciados y validación de resultados (mismo criterio que el simulador de BD).
- **Visualización:** diagramas de red animados con paquetes en tránsito + simulador de consola (ping, traceroute, ipconfig) + historial + exportación/importación.
- **Salida:** web (Cloudflare Pages) + localStorage para borradores + exportación/importación de configuración.

## 1. Reglas de oro para agy (LEER ANTES DE TOCAR NADA)

1. **NO ejecutar comandos de terminal.** agy headless solo tiene read_file/write_file/apply_patch. Cualquier comando mata el proceso.
2. **NO modificar ni borrar `data/*.json`**. Son datos precocinados e inmutables. Si falta un dato, avisa en el informe.
3. **HTML estático = atributo `class`, NUNCA `className`**. agy mete React en HTML plano con `onError={...}` y se rompe.
4. **NO tocar la carpeta de origen**. Solo el checkout de trabajo.
5. **Solo se editan copias** en el checkout de trabajo.
6. **Iconos MDI reales**: bombilla = `lightbulb-on-outline`, no círculos genéricos.
7. **Subíndices en SVG**: usar `<tspan baseline-shift="sub">`, NUNCA `<sub>`/`<sup>` dentro de `<text>`.
8. **Dejar informe** en `docs/informe_simulador_redes.md` con lo hecho, lo omitido y los valores de verificación.

## 2. Archivos que puede modificar

- `index.html` — estructura principal
- `css/styles.css` — estilos brand tecnoLSM
- `js/app.js` — lógica principal (selector de topología, editor de configuración, ejecución, visualización, historial)
- `js/red-engine.js` — motor de redes (cálculo de subredes, validación IP, simulación de ping/traceroute)
- `js/diagrama-red.js` — diagrama de red animado (nodos, conexiones, paquetes en tránsito)
- `js/consola.js` — simulador de consola (ping, traceroute, ipconfig, nslookup)
- `js/ejemplos.js` — ejemplos guiados por concepto
- `js/examenes.js` — modo examen con enunciados
- `docs/informe_simulador_redes.md` — informe final

## 3. Archivos PROHIBIDOS

- `data/*.json` — datos precocinados, inmutables.
- Cualquier archivo fuera del checkout.

## 4. Brand tecnoLSM (variables CSS exactas)

```css
:root { --paper: #0B111E; --ink: #DDEAF0; --muted: #94A9B8; --rule: #2A3444; --accent: #68D7E8; }
[data-theme="dark"] { --paper: #0B111E; --ink: #DDEAF0; --muted: #94A9B8; --rule: #2A3444; --accent: #68D7E8; }
[data-theme="light"] { --paper: #F4F7F9; --ink: #0B111E; --muted: #4A5D6E; --rule: #C9D3DB; --accent: #0A7385; }
```

- Fuentes: Space Grotesk (títulos), DM Sans (cuerpo), IBM Plex Mono (código).
- Footer estándar: «Aplicación creada por Tecno LSM para uso educativo © 2026 Licencia libre de uso no comercial (Creative Commons BY-NC-SA 4.0).»
- Watermark: «tecnoLSM · Simulador de redes» en esquina inferior izquierda.
- Toggle claro/oscuro persistido en localStorage.
- `color-scheme: light` en `:root`, `dark` en `[data-theme="dark"]`, `light` en `@media print`.

## 5. Funcionalidades del simulador

### 5.1 Selector de topología
- Dropdown con 4 opciones: Estrella, Bus, Anillo, Malla.
- Al cambiar, se carga la topología y se muestra el diagrama animado.
- Se muestra un resumen: nombre, descripción, número de nodos, número de conexiones.

### 5.2 Diagrama de red animado
- Canvas o SVG con nodos (PC, switch, router) y conexiones.
- Nodos arrastrables (drag & drop) para reorganizar.
- Animación de paquetes en tránsito (puntos que se mueven por las conexiones).
- Resaltado de la ruta cuando se hace ping o traceroute.
- Colores: nodos en `--accent`, conexiones en `--rule`, paquetes en `--ok`.

### 5.3 Configuración de red (panel lateral)
- Campos para configurar un nodo seleccionado: IP, máscara, gateway, DNS.
- Validación en tiempo real: IP válida, máscara válida, coherencia de red.
- Botón «Aplicar configuración» que actualiza el nodo.
- Botón «Restaurar configuración original».

### 5.4 Calculadora de subredes
- Input: IP de red + máscara (o prefijo /24, /26, etc.).
- Output: dirección de red, broadcast, primer host, último host, número de hosts, número de subredes.
- Modo «dividir en N subredes»: calcula la nueva máscara y el rango de cada subred.
- Tabla con las subredes resultantes.

### 5.5 Simulador de consola
- Terminal simulado (fondo oscuro, fuente monoespaciada).
- Comandos soportados:
  - `ping <ip>` → respuesta con tiempo y TTL.
  - `traceroute <ip>` o `tracert <ip>` → saltos con tiempos.
  - `ipconfig` o `ifconfig` → configuración de red del PC seleccionado.
  - `nslookup <dominio>` → resolución DNS (simulada).
  - `arp -a` → tabla ARP.
  - `help` → lista de comandos.
- Historial de comandos (flecha arriba/abajo).
- Autocompletado básico (Tab).

### 5.6 Explicaciones pedagógicas
- Panel lateral «Conceptos clave» con explicaciones breves de: topología, IP, máscara, gateway, DNS, DHCP, switch, router, ping, traceroute, subred.
- Tooltips en los mensajes de error: «¿Qué significa esto?» con explicación.
- Ejemplos guiados: 10 ejemplos por concepto con descripción y botón «Cargar».

### 5.7 Modo examen
- Lista de 5 enunciados (ej: «Configura la IP del PC-3 para que esté en la misma red que PC-1»).
- El alumno realiza la configuración y pulsa «Comprobar».
- El simulador valida la configuración del alumno contra la solución esperada.
- Feedback: «Correcto» o «Incorrecto: revisa X».
- Contador de intentos y tiempo.

### 5.8 Exportación / importación
- Botón «Exportar configuración» → descarga archivo .json con la topología y configuración.
- Botón «Importar configuración» → carga un archivo .json.
- Botón «Exportar resultados de ping» → descarga .txt.

## 6. Estructura de archivos

```
simulador-redes/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── red-engine.js
│   ├── diagrama-red.js
│   ├── consola.js
│   ├── ejemplos.js
│   └── examenes.js
├── data/
│   └── redes_datos.json   (INMUTABLE)
├── docs/
│   └── informe_simulador_redes.md
├── favicon.svg
└── robots.txt
```

## 7. Valores de verificación (para el auditor)

El informe de agy debe incluir estos valores verificables:
1. Número de topologías: 4 (estrella, bus, anillo, malla).
2. Número de escenarios IP: 4.
3. Número de ejemplos guiados: 10.
4. Número de enunciados de examen: 5.
5. Comando de prueba: `ping 192.168.1.1` → debe devolver respuesta con tiempo y TTL.
6. Cálculo de prueba: IP 192.168.1.0/24 → dirección de red 192.168.1.0, broadcast 192.168.1.255, 254 hosts.
7. Cálculo de prueba: dividir 192.168.1.0/24 en 4 subredes → máscara /26, 62 hosts por subred.
8. Topología estrella: 5 nodos (4 PCs + 1 switch) + 1 router = 6 nodos, 5 conexiones.

## 8. MVP (lo que agy debe construir en el primer run)

1. Selector de topología + carga de JSON.
2. Diagrama de red animado con nodos y conexiones.
3. Configuración de red (IP, máscara, gateway, DNS) con validación.
4. Calculadora de subredes.
5. Simulador de consola (ping, traceroute, ipconfig, nslookup, help).
6. Explicaciones pedagógicas (conceptos clave + tooltips).
7. 10 ejemplos guiados.
8. Brand tecnoLSM completo (tema claro/oscuro, fuentes, footer, watermark).
9. Modo examen con 5 enunciados.
10. Exportación/importación de configuración.

## 9. Fase 2 (si el MVP funciona)

- Animación de paquetes en tránsito más elaborada.
- ARP table simulada.
- Resaltado de ruta en ping/traceroute.
- Arrastre de nodos con persistencia de posición.

## 10. Cómo lanzar agy

```bash
cd /Users/luissolamantilla/Downloads/temporales_hermes/simulador_redes
~/.local/bin/agy -p "$(cat plan_simulador_redes.md)" --output-format text --model "Claude Sonnet 5.5 (Medium)"
```

Verificar con `agy models` que el nombre del modelo es válido antes de lanzar.

## 11. Nota sobre subagentes

Antigravity (agy) **no tiene subagentes nativos**. Es un CLI que ejecuta un modelo. La estrategia es:

- **Run 1 (Sonnet 5.5 medium):** estructura HTML + CSS brand + motor de redes + diagrama + consola. El trabajo difícil.
- **Run 2 (Gemini 3.8 flash high):** ejemplos guiados + modo examen + exportación/importación. El remate de batalla.
- **Hermes (yo):** auditor y verificador final. Puppeteer + comprobación de valores + arreglos de bugs.

Para lanzar Run 1 y Run 2 en secuencia, se crea un segundo plan (`plan_simulador_redes_parte_b.md`) con solo los pendientes, y se lanza agy de nuevo.

**Alternativa:** usar subagentes de Hermes (`delegate_task`) para delegar a otros agentes de Hermes, pero eso sería Hermes, no Antigravity.
