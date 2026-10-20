# MentoryGo · Landing interactiva (prototipo)

Prototipo navegable para presentar MentoryGo. Es un solo archivo HTML con CSS y JavaScript integrados: no necesita servidor, base de datos, claves de API ni conexión a servicios de mapas. Solo carga tipografías de Google Fonts; si no hay internet, usa las fuentes del sistema y todo sigue funcionando.

**Todos los datos son ficticios.** Docentes, precios, valoraciones, disponibilidad y reservas son de demostración. La reserva es una simulación y no se cobra dinero. Los formularios no envían ni guardan datos.

## Qué incluye

- Hero con búsqueda rápida (materia + zona).
- Cómo funciona, con vista para clientes y para docentes.
- Mapa esquemático de Quito (SVG propio, sin tiles externos) con docentes ficticios por barrio, radio de búsqueda y selección sincronizada con la lista.
- Filtros reales: zona, materia, nivel, precio máximo, distancia máxima, modalidad, disponibilidad y orden. Estados de carga, vacío y error.
- Perfil del docente con aviso de "no verificado", disponibilidad de 7 días en hora de Ecuador y botón de reporte.
- Reserva simulada: duración, modalidad, reserva para un menor (gestionada por el adulto), lugar, horario, desglose del precio y comisión hipotética.
- Panel "Tus reservas de prueba" con la máquina de estados completa (`requested`, `accepted`, `awaiting_payment`, `confirmed`, `completed`, `cancelled`, `disputed`, `refunded`), clave de idempotencia en el pago, bloqueo de doble reserva del mismo horario, reseña habilitada solo en `completed` y registro de auditoría simulado.
- Sección para docentes con calculadora de ingreso neto por hora.
- Confianza y seguridad (menores, ubicación, verificación, pagos, reseñas, LOPDP).
- Simulador editable de ingresos por comisiones.
- Hoja de ruta, lista de espera simulada, tema claro/oscuro, navegación por teclado y movimiento reducido.

## Estructura

```
landing/
├── src/page.html          Código de la página (HTML + CSS + JS)
├── data/demo-data.json    Zonas de Quito y docentes ficticios
├── assets/                Logo e icono
├── build.py               Une todo en dist/
├── dist/index.html        Página lista para abrir o publicar
├── dist/.nojekyll
└── tests/landing.test.mjs Pruebas de extremo a extremo (Playwright)
```

## Abrirla en Windows 10/11

Lo más rápido: doble clic en `dist\index.html`. Se abre en tu navegador.

Si editas `src/page.html` o `data/demo-data.json`, regenera `dist`:

```powershell
cd ruta\a\mentorygo\landing
py -m pip install pillow
py build.py
start dist\index.html
```

Servidor local opcional (por si quieres probar desde el celular en la misma red Wi‑Fi):

```powershell
cd dist
py -m http.server 8080
# abre http://localhost:8080 en la PC, o http://IP-de-tu-PC:8080 en el celular
```

## Publicarla gratis en GitHub Pages

1. Crea un repositorio nuevo en GitHub, por ejemplo `mentorygo-landing` (puede ser público).
2. En PowerShell:

```powershell
cd ruta\a\mentorygo\landing
git init
git add .
git commit -m "Landing interactiva MentoryGo"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/mentorygo-landing.git
git push -u origin main
```

3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`. Guarda.
4. Como la página está en `dist/`, tienes dos opciones:
   - Copiar `dist/index.html` y `dist/.nojekyll` a la raíz del repo antes del commit, o
   - Elegir la carpeta `/docs` y renombrar `dist` a `docs`.
5. En uno o dos minutos queda en `https://TU_USUARIO.github.io/mentorygo-landing/`.

## Pruebas automáticas

```powershell
cd ruta\a\mentorygo\landing
npm init -y
npm i -D playwright
npx playwright install chromium
node tests\landing.test.mjs
```

Prueban: carga sin errores, etiquetas de ficticio, filtros de materia, precio y modalidad, estado vacío, orden por distancia, cálculo Haversine, apertura de perfil, reserva, bloqueo de doble reserva, recorrido de estados con idempotencia en el pago, reseña solo tras completar, disputa y reembolso, simulador, formularios, tema oscuro y ausencia de scroll horizontal en móvil.

## Decisiones y límites

- **Mapa:** es un esquema propio (curvas de nivel decorativas del Pichincha, parques y centroides aproximados de barrios), no un mapa cartográfico. Así la demo funciona sin internet y no depende de los servidores de OpenStreetMap, cuya política no admite tráfico de producción intensivo. En producción se usará MapLibre con un proveedor de tiles basado en OSM con condiciones comerciales y la atribución correspondiente.
- **Distancias:** línea recta (Haversine) entre centroides de barrio. No son rutas ni tiempos de viaje.
- **Ubicación:** el botón usa la geolocalización del navegador solo para elegir la zona más cercana y no guarda coordenadas. Dentro de algunos visores embebidos el permiso está bloqueado; entonces se elige la zona manualmente.
- **Comisión 15 % y costo de pasarela 5 %:** son hipótesis editables, no condiciones contractuales ni tarifas confirmadas de ningún proveedor.
- **Stack definitivo:** esta demo es HTML estático para presentarla hoy. La landing de producción se migrará a Next.js + TypeScript + Tailwind compartiendo la guía de estilos con el panel y la app.
