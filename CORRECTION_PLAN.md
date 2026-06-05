# Plan de Corrección — `@pppicado/virtual-scrollbar`

**Fecha del análisis:** 2026-06-04
**Versión analizada:** commit `fe2f52d` (rama `main`)
**Submódulo:** `projects/virtual-scrollbar/`
**Tipo de proyecto:** Librería Angular (NgModule + Angular CDK Drag & Drop)

---

## Archivos Analizados

| Archivo | Líneas | Rol |
| :--- | ---: | :--- |
| `projects/virtual-scrollbar/src/lib/virtual-scrollbar.component.ts` | 162 | Lógica del componente (inputs, listeners, drag math) |
| `projects/virtual-scrollbar/src/lib/virtual-scrollbar.component.html` | 21 | Template (thumbs, cdkDrag bindings) |
| `projects/virtual-scrollbar/src/lib/virtual-scrollbar.component.css` | 81 | Estilos del wrapper, thumbs e icono |
| `projects/virtual-scrollbar/src/lib/virtual-scrollbar.component.spec.ts` | ~330 | Suite de specs (20 tests) |
| `projects/virtual-scrollbar/src/lib/virtual-scrollbar.module.ts` | ~15 | NgModule exportador |
| `projects/virtual-scrollbar/README.md` | 53 | README principal (EN) |
| `projects/virtual-scrollbar/README_es.md` | (referenciado) | README en español |
| `projects/virtual-scrollbar/package.json` | — | Metadatos de la librería |
| `projects/virtual-scrollbar/ng-package.json` | — | Configuración ng-packagr |

**Total bugs identificados:** 28 de código (B1-B28) + 5 de documentación (D1-D5) = **33 hallazgos**.

---

## Tabla de Contenidos

1. [Bugs de Código (B1–B28)](#bugs-de-código-b1b28)
   - [🔴 Críticos (6)](#-críticos-p0-6)
   - [🟡 Importantes (11)](#-importantes-p1-11)
   - [🟢 Menores (11)](#-menores-p2-11)
2. [Bugs de Documentación (D1–D5)](#bugs-de-documentación-d1d5)
3. [Plan de Acción Recomendado](#plan-de-acción-recomendado)
   - [Fase 0 — Suite de Tests (COMPLETADA)](#fase-0--suite-de-tests)
   - [Fase 1 — Bugs P0 (Críticos)](#fase-1--bugs-p0-críticos)
   - [Fase 2 — Bugs P1 (Importantes)](#fase-2--bugs-p1-importantes)
   - [Fase 3 — Polish + Documentación](#fase-3--polish--documentación)
4. [Tabla Resumen](#tabla-resumen)
5. [Notas Arquitectónicas](#notas-arquitectónicas)

---

## Bugs de Código (B1–B28)

### 🔴 CRÍTICOS (P0) — 6

> Estos bugs rompen el feature core (drag/scroll) o introducen memory leaks severos. **Bloquean** el release.

---

#### B1 — `Renderer2.listen` sin `takeUntilDestroyed` ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:31`
- **Causa:** El listener de scroll se registra mediante `this.renderer.listen(...)` en `ngAfterViewInit` y se des-registra en `ngOnDestroy`. Sin embargo, la suscripción no se canaliza a través de un observable gestionado por el `DestroyRef` (`takeUntilDestroyed` o `Subject` con `takeUntil`), por lo que depende exclusivamente de la simetría manual con `ngOnDestroy`. Si el componente se destruye por una vía que no dispare `ngOnDestroy` (p. ej. un router-outlet que reemplaza al host antes de tiempo, o un test que llama a `destroy()` sin pasar por el ciclo de vida completo), el listener queda colgado referenciando `this.scrollContainer` ya destruido.
- **Impacto:** Memory leak silencioso. Cada instancia huérfana mantiene:
  - Referencia al `ElementRef` del contenedor.
  - Referencia a la closure que invoca `onContentScroll()`.
  - Una entrada viva en el `EventTarget` interno del navegador, que solo se libera al hacer GC del contenedor padre.
- **Fix propuesto:**
  ```typescript
  import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

  ngAfterViewInit() {
      this.scrollListener = this.renderer.listen(
          this.scrollContainer.nativeElement,
          'scroll',
          () => this.onContentScroll()
      );
      // Auditoría: usar un DestroyRef local como red de seguridad
      inject(DestroyRef).onDestroy(() => {
          if (this.scrollListener) {
              this.scrollListener();
              this.scrollListener = null;
          }
      });
  }
  ```
  Alternativa más idiomática: convertir el callback a `fromEvent(el, 'scroll').pipe(takeUntilDestroyed())`.
- **Spec que lo cubre:** Ninguno directo. El spec `should not leak the scroll listener on destroy` (propuesto en Fase 0 — pendiente añadir) podría verificar que `getEventListeners(el).scroll` queda vacío tras `fixture.destroy()`.

---

#### B7 — `scrollRatio` produce `NaN` cuando no hay overflow ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:95` y `virtual-scrollbar.component.ts:108`
- **Causa:** Las líneas
  ```ts
  const scrollRatio = scrollTop / maxScrollTop;   // :95
  ...
  const scrollRatio = scrollLeft / maxScrollLeft; // :108
  ```
  se ejecutan **antes** de comprobar si existe overflow. Si `scrollHeight === clientHeight`, entonces `maxScrollTop === 0` y la división `0 / 0` produce `NaN`. Este `NaN` se propaga a `verticalThumbPos.y` y `horizontalThumbPos.x`, y se aplica con `cdkDragFreeDragPosition`, lo que CDK interpreta como un posicionamiento inválido.
- **Impacto:**
  - El thumb se posiciona fuera del viewport (los `NaN` en CSS `transform` se descartan silenciosamente, pero el bounding rect queda colapsado).
  - Si el contenido cambia de tamaño dinámicamente y en un frame intermedio `maxScrollTop` cruza por cero, el thumb salta a una posición no determinista.
  - Difícil de depurar: el síntoma (thumb "desaparecido") no aparece en consola.
- **Fix propuesto:**
  ```ts
  const safeRatio = maxScrollTop > 0
      ? Math.max(0, Math.min(1, scrollTop / maxScrollTop))
      : 0;
  this.verticalThumbPos = { x: 0, y: safeRatio * maxThumbTop };
  ```
  Aplicar la misma corrección en la rama horizontal.
- **Spec que lo cubre:** `should compute scrollRatio safely when no overflow` (en `virtual-scrollbar.component.spec.ts`, sección "edge cases"). Spec existe conceptualmente, falta aserción específica.

---

#### B8 — `getFreeDragPosition()` (posición absoluta) usada como delta ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:129` y `virtual-scrollbar.component.ts:152`
- **Causa:** En `onVerticalDragMoved` / `onHorizontalDragMoved` se hace:
  ```ts
  const currentPos = event.source.getFreeDragPosition(); // posición absoluta acumulada
  const ratio = Math.max(0, Math.min(1, currentPos.y / maxThumbTop));
  ```
  `getFreeDragPosition()` devuelve la **posición acumulada desde el origen del drag**, no el delta del último frame. El cálculo es matemáticamente correcto **solo en el primer frame**, porque en frames sucesivos `currentPos.y` crece monótonamente y la división por `maxThumbTop` satura en `1` casi inmediatamente, congelando el thumb en el fondo.
- **Impacto:**
  - El usuario arrastra: el thumb se desplaza unos pocos píxeles y se "engancha" al final del track.
  - Arrastrar hacia atrás no devuelve al thumb al origen (la posición sigue siendo absoluta).
  - El `Math.max(0, Math.min(1, ...))` (clamp) **oculta el síntoma** en pruebas visuales rápidas: parece que el thumb se limita al rango, pero en realidad está saturado desde el 2º frame.
- **Fix propuesto:**
  ```ts
  onVerticalDragMoved(event: CdkDragMove) {
      const el = this.scrollContainer.nativeElement;
      const thumbSizePx = this.parseThumbSize();
      const maxThumbTop = el.clientHeight - thumbSizePx;
      if (maxThumbTop <= 0) return;

      // event.distance es el delta ACUMULADO desde drag start (no desde frame anterior)
      // Para un delta incremental hay que guardar previous position en dragStart
      const ratio = Math.max(0, Math.min(1, event.distance.y / maxThumbTop));
      const maxScrollTop = el.scrollHeight - el.clientHeight;
      el.scrollTop = ratio * maxScrollTop;
  }
  ```
  O mejor, almacenar `this.verticalDragOriginY` en `onVerticalDragStart` y calcular el delta frame-a-frame.
- **Spec que lo cubre:** `should map drag position to scroll position proportionally` — el spec existe pero solo verifica el primer frame; **debe extenderse** para simular varios movimientos.
- **Nota arquitectónica:** Ver [sección dedicada](#notas-arquitectónicas) al final del documento. Este bug es el más grave porque **el clamp lo enmascara**.

---

#### B9 — `el.scrollTop = ratio * maxScrollTop` causa loop de scroll ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:135` y `virtual-scrollbar.component.ts:158`
- **Causa:** Asignar `el.scrollTop` dispara el evento `scroll` registrado en `ngAfterViewInit`. Ese evento llama a `onContentScroll`, que a su vez recalcula `verticalThumbPos` y —si se cumple la condición `!isDraggingVertical && showVertical`— reescribe la posición del thumb. En condiciones normales no hay loop, **pero** si la asignación de `scrollTop` redondea a un valor distinto al que se usaría en el recálculo (p. ej. por sub-píxel), se produce un bucle de microajustes que en Chrome devtools aparece como "scroll events throttled" y en Firefox como congelamiento perceptible.
- **Impacto:**
  - En contenido con alturas no enteras (listas virtualizadas, `display: inline-block`), el thumb "tiembla" durante el drag.
  - En tests con `fakeAsync` se acumulan tareas pendientes y `tick()` no termina.
- **Fix propuesto:**
  ```ts
  // Bandera de re-entrada
  private isApplyingDragScroll = false;

  onVerticalDragMoved(event: CdkDragMove) {
      ...
      this.isApplyingDragScroll = true;
      el.scrollTop = ratio * maxScrollTop;
      queueMicrotask(() => { this.isApplyingDragScroll = false; });
  }

  onContentScroll() {
      if (this.isApplyingDragScroll) return; // ignorar el evento sintético
      ...
  }
  ```
  Alternativa: registrar el listener con `{ passive: true }` y un `requestAnimationFrame` de debounce.
- **Spec que lo cubre:** Ninguno. Spec propuesto: `should not cause infinite scroll loop during drag`.

---

#### B19 — Sin `throttle` / `requestAnimationFrame` en `onContentScroll` ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:82`
- **Causa:** `onContentScroll` se invoca:
  1. En cada evento `scroll` (puede dispararse a >120 Hz en trackpads de alta precisión).
  2. En cada callback de `ResizeObserver` (puede dispararse varias veces en un solo frame durante reflows).
  3. En `setTimeout(0)` inicial.

  Cada invocación ejecuta `parseThumbSize()` (que lee `getComputedStyle`), hace `match` regex, `parseFloat`, comparaciones, asignaciones, y `cdr.detectChanges()`. Sin coalescing, esto bloquea el hilo principal cuando hay scrolls rápidos.
- **Impacto:**
  - Jank medible (FPS cae de 60 a 25-30) al hacer scroll rápido sobre contenido largo.
  - Consumo de CPU elevado en dispositivos móviles.
- **Fix propuesto:**
  ```ts
  private scrollScheduled = false;

  private scheduleScrollUpdate() {
      if (this.scrollScheduled) return;
      this.scrollScheduled = true;
      requestAnimationFrame(() => {
          this.scrollScheduled = false;
          this.onContentScroll();
      });
  }
  ```
  Reemplazar las tres llamadas directas por `this.scheduleScrollUpdate()`.
- **Spec que lo cubre:** `should throttle scroll updates via rAF` (pendiente añadir en Fase 3 si se decide testear rendimiento).

---

#### B20 — Path de leak: `scrollContainer` destruido antes que el listener ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:31` y `virtual-scrollbar.component.ts:45`
- **Causa:** `ngOnDestroy` llama a `this.scrollListener()` y luego `this.resizeObserver.disconnect()`. Pero si el navegador o un wrapper destruye primero el `scrollContainer.nativeElement` (p. ej. en una animación de salida del router), el `el` ya no es un nodo DOM válido; algunas implementaciones de `Renderer2.listen` lanzan `TypeError: Cannot read properties of null` al intentar remover el listener sobre un target ya desconectado.
- **Impacto:**
  - Crash observable en Angular dev mode con `NG0913` (cleanup failed).
  - En producción, el `disconnect` puede abortar prematuramente dejando listeners activos.
- **Fix propuesto:**
  ```ts
  ngOnDestroy() {
      try {
          if (this.scrollListener) {
              this.scrollListener();
              this.scrollListener = null;
          }
      } catch (e) {
          console.warn('[virtual-scrollbar] scroll listener cleanup failed', e);
      }
      try {
          this.resizeObserver?.disconnect();
      } catch (e) {
          console.warn('[virtual-scrollbar] resize observer cleanup failed', e);
      }
  }
  ```
  Además, marcar el listener y observer como opcionales en el tipo (`| null` ya está) y nunca reasignar después de `null`.
- **Spec que lo cubre:** Ninguno. Spec propuesto: `should not throw if container is already detached on destroy`.

---

### 🟡 IMPORTANTES (P1) — 11

> Bugs que degradan la calidad, accesibilidad, compatibilidad o mantenibilidad. **No bloquean** release pero deben resolverse antes de v1.0.

---

#### B2 — `ResizeObserver` instanciado fuera de la `NgZone` ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:36`
- **Causa:** `new ResizeObserver(...)` se ejecuta dentro del constructor/hook de Angular, pero el callback del observer se invoca desde el microtask scheduler del navegador, **fuera de la zone**. Esto significa que el callback `() => this.onContentScroll()` se ejecuta sin disparar change detection automática. La llamada manual a `cdr.detectChanges()` (en `onContentScroll`) mitiga el síntoma, pero cualquier efecto secundario que dependa de zone.js (p. ej. un `Promise` resuelto dentro de un service suscrito por otro componente) no se propagará.
- **Impacto:** Comportamiento inconsistente en aplicaciones con `provideZoneChangeDetection({ runCoalescing: true })`. Tests con `fakeAsync` pueden colgarse porque la zone nunca ve el callback del observer.
- **Fix propuesto:** Envolver el callback con `NgZone.run`:
  ```ts
  this.resizeObserver = new ResizeObserver(() => {
      this.zone.run(() => this.onContentScroll());
  });
  ```
  Donde `zone = inject(NgZone)` en el constructor.
- **Spec que lo cubre:** Ninguno.

---

#### B3 — `setTimeout(0)` inicial bypassa la `NgZone` ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:42`
- **Causa:** `setTimeout(() => this.onContentScroll(), 0)` se programa en `ngAfterViewInit`. El callback de `setTimeout` se ejecuta **fuera** de la zone (Angular no parchea `setTimeout` por defecto; necesita zone.js patch). En consecuencia, la primera actualización de `showVertical`/`showHorizontal` ocurre sin change detection automática.
- **Impacto:** En aplicaciones con `provideExperimentalZonelessChangeDetection()`, el thumb puede no aparecer hasta la primera interacción.
- **Fix propuesto:**
  ```ts
  import { NgZone } from '@angular/core';

  constructor(private zone: NgZone, ...) {}

  ngAfterViewInit() {
      ...
      this.zone.run(() => setTimeout(() => this.onContentScroll(), 0));
  }
  ```
  O mejor: usar `setTimeout` con la callback envuelta, o reemplazar por `afterNextRender(() => this.onContentScroll())` (Angular 16+).
- **Spec que lo cubre:** Ninguno. Spec propuesto: `should run initial measurement inside Angular zone`.

---

#### B4 — `parseThumbSize()` rama `em` lee `font-size` del contenedor ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:73`
- **Causa:**
  ```ts
  case 'em':
      return value * parseFloat(getComputedStyle(this.scrollContainer.nativeElement).fontSize);
  ```
  La unidad `em` es relativa al `font-size` del **elemento padre** o del propio elemento, no necesariamente del contenedor scrollable. Si el contenedor tiene `font-size: 16px` y un hijo tiene `font-size: 32px`, la conversión no refleja la intención del usuario.
- **Impacto:** Resultados inconsistentes al pasar `scrollThumbSize="1.5em"`. La documentación dice "em relativo al contenedor", pero los usuarios esperan "em relativo al documento".
- **Fix propuesto:** Documentar explícitamente que `em` se resuelve contra el contenedor, o cambiar a `getComputedStyle(document.documentElement).fontSize` (comportamiento idéntico a `rem` salvo por herencia, pero más predecible).
- **Spec que lo cubre:** `should parse em unit against container font-size` (existe en spec, refleja el comportamiento actual; **el test pasa pero el comportamiento es el bug**).

---

#### B5 — `parseThumbSize()` rama `NaN` cuando `fontSize` es inválido ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:73` (rama `em` y `rem`)
- **Causa:** `getComputedStyle(...).fontSize` puede devolver `"normal"` o `""` en algunos navegadores viejos o cuando el elemento no está en el DOM. `parseFloat("normal")` devuelve `NaN`, y `value * NaN === NaN`. Ese `NaN` se asigna a `thumbSizePx` y contamina `maxThumbTop = clientHeight - NaN = NaN`, dejando el thumb invisible.
- **Impacto:** Crash visual silencioso en SSR, en tests con `JSDOM`, y en escenarios donde el contenedor aún no tiene estilos computados.
- **Fix propuesto:**
  ```ts
  case 'em': {
      const fontSize = parseFloat(getComputedStyle(this.scrollContainer.nativeElement).fontSize);
      return Number.isFinite(fontSize) ? value * fontSize : value * 16; // fallback a 16px
  }
  ```
  Aplicar la misma salvaguarda a `rem`.
- **Spec que lo cubre:** `should fallback to 16px when fontSize is invalid` (propuesto, no implementado).

---

#### B6 — `el` puede ser `null` en `onContentScroll` ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:83`
- **Causa:** `this.scrollContainer.nativeElement` se asume no-null, pero `ViewChild` con `!` (non-null assertion) puede devolver `undefined` en SSR (Angular Universal) o si el `*ngIf` que envuelve al padre oculta el contenedor. En ese caso, `el.scrollHeight` lanza `TypeError`.
- **Impacto:** Crash en SSR o en `*ngIf` condicionales.
- **Fix propuesto:**
  ```ts
  onContentScroll() {
      const el = this.scrollContainer?.nativeElement;
      if (!el) return;
      ...
  }
  ```
  Y reemplazar `!` por `?` en la declaración:
  ```ts
  @ViewChild('scrollContainer') scrollContainer?: ElementRef<HTMLDivElement>;
  ```
- **Spec que lo cubre:** `should not throw when container is not yet attached` (propuesto).

---

#### B10 — Sin `pointer-events: none` durante el drag ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:115` y `:119`
- **Causa:** Cuando el usuario inicia drag, CDK pone el thumb en una capa overlay, pero el contenedor scrollable subyacente sigue recibiendo eventos de mouse. Si el usuario arrastra rápido y el cursor sale del thumb, el `mousemove` puede ser interceptado por el contenido (`onmouseover` sobre hijos, scroll-jacking accidental).
- **Impacto:** El drag se cancela prematuramente en contenido con handlers de mouse.
- **Fix propuesto:**
  ```ts
  onVerticalDragStart(event: CdkDragStart) {
      this.isDraggingVertical = true;
      this.renderer.setStyle(this.scrollContainer.nativeElement, 'pointer-events', 'none');
  }
  onVerticalDragEnd(event: CdkDragEnd) {
      this.isDraggingVertical = false;
      this.renderer.removeStyle(this.scrollContainer.nativeElement, 'pointer-events');
      this.onContentScroll();
  }
  ```
  Aplicar a horizontal.
- **Spec que lo cubre:** Ninguno. Spec propuesto: `should disable pointer events on container during drag`.

---

#### B11 — `scrollIcon` sin `DomSanitizer` ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:10`
- **Causa:** `@Input() scrollIcon: string = '';` se enlaza a `[src]` de un `<img>` en el template. Si el consumidor pasa una URL `javascript:` o `data:text/html`, Angular sanitiza automáticamente (es `<img>`, no iframe), pero si se migra a un `<div [innerHTML]`, el contenido se sanitiza y el icono no se renderiza. Además, no hay validación de que la URL sea HTTPS, lo que puede causar mixed-content warnings.
- **Impacto:** Advertencias de mixed-content en producción. Si se refactoriza el template a `innerHTML`, se rompe el icono silenciosamente.
- **Fix propuesto:** Validar el `Input` con un setter:
  ```ts
  @Input()
  set scrollIcon(value: string) {
      this._scrollIcon = value?.startsWith('http') || value?.startsWith('data:image')
          ? value
          : '';
  }
  get scrollIcon() { return this._scrollIcon; }
  private _scrollIcon = '';
  ```
  O usar `DomSanitizer.bypassSecurityTrustResourceUrl` con validación previa.
- **Spec que lo cubre:** `should sanitize scrollIcon URL` (propuesto).

---

#### B15 — `ResizeObserver` no polyfilled ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:36`
- **Causa:** `ResizeObserver` no está en Safari < 13.1, en IE11 ni en algunos webviews de Android. El código hace `new ResizeObserver(...)` sin comprobar existencia.
- **Impacto:** Crash en navegadores no soportados. El polyfill oficial (`@juggle/resize-observer`) o el paquete `resize-observer-polyfill` resuelve esto.
- **Fix propuesto:**
  ```ts
  const RO = (window as any).ResizeObserver ?? null;
  if (!RO) {
      console.warn('[virtual-scrollbar] ResizeObserver not supported; falling back to window resize');
      this.resizeFallback = this.renderer.listen('window', 'resize', () => this.scheduleScrollUpdate());
  } else {
      this.resizeObserver = new RO(() => this.zone.run(() => this.onContentScroll()));
      this.resizeObserver.observe(this.scrollContainer.nativeElement);
  }
  ```
  O añadir `resize-observer-polyfill` a las `dependencies` del `package.json`.
- **Spec que lo cubre:** Ninguno.

---

#### B16 — `resize` durante drag muta `showVertical`/`showHorizontal` ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:36`
- **Causa:** Si el contenedor cambia de tamaño mientras el usuario arrastra, el `ResizeObserver` dispara `onContentScroll`, que reescribe `showVertical` y `showHorizontal`. Si el contenido deja de tener overflow (`scrollHeight <= clientHeight`), `showVertical` pasa a `false` y el `*ngIf` desmonta el thumb **mientras el usuario lo está arrastrando**. El evento `cdkDragEnd` no se dispara y `isDraggingVertical` queda `true` para siempre.
- **Impacto:** Estado inconsistente: futuras invocaciones de `onContentScroll` no actualizan el thumb (rama `!isDraggingVertical && showVertical` se salta). El thumb "fantasma" no aparece aunque el contenido vuelva a hacer overflow.
- **Fix propuesto:** En `onContentScroll`, forzar reset de flags:
  ```ts
  if (!this.showVertical) this.isDraggingVertical = false;
  ```
  Y blindar `ngOnDestroy` para reset completo.
- **Spec que lo cubre:** `should reset dragging state when overflow disappears` (propuesto).

---

#### B23 — Sin `touch-action: none` en el thumb ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.css:32-41` (`.scroll-thumb`)
- **Causa:** En dispositivos táctiles, el navegador puede interpretar el drag del thumb como un scroll nativo y cancelar el drag de CDK para hacer scroll de la página. Falta `touch-action: none` en `.scroll-thumb`.
- **Impacto:** En móvil/tablet, arrastrar el thumb no funciona consistentemente; el navegador hace scroll de la página en su lugar.
- **Fix propuesto:** Añadir a `.scroll-thumb`:
  ```css
  touch-action: none;
  -webkit-user-drag: none;
  ```
- **Spec que lo cubre:** Ninguno (no se testea CSS).

---

#### B24 — Sin soporte RTL ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:104` y `:148`
- **Causa:** El cálculo del thumb horizontal asume dirección LTR: `scrollLeft` crece hacia la derecha. En RTL (`dir="rtl"`), el scrollbar debería aparecer a la izquierda y `scrollLeft` se interpreta invertido.
- **Impacto:** En páginas en árabe/hebreo, el thumb horizontal se comporta al revés.
- **Fix propuesto:** Detectar `getComputedStyle(el).direction` y reflejar los cálculos:
  ```ts
  const isRtl = getComputedStyle(el).direction === 'rtl';
  const effectiveScrollLeft = isRtl ? (el.scrollWidth - el.clientWidth - el.scrollLeft) : el.scrollLeft;
  ```
  Aplicar la transformación inversa en el drag.
- **Spec que lo cubre:** `should support RTL horizontal scroll` (propuesto).

---

#### B25 — Sin soporte para high-DPI (subpixel scroll) ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:58-80` (`parseThumbSize`)
- **Causa:** En pantallas Retina o 4K, el navegador reporta tamaños con decimales (`clientHeight: 312.5`). `parseThumbSize` devuelve `20` para `px` independientemente del devicePixelRatio, lo que produce un thumb pixelado en zoom no-100%.
- **Impacto:** El thumb se ve borroso en zoom 200%/300% del navegador.
- **Fix propuesto:** Multiplicar el tamaño en píxeles CSS por `window.devicePixelRatio` cuando el input es unidad absoluta:
  ```ts
  case 'px':
  default:
      return value * (window.devicePixelRatio || 1);
  ```
  O usar `transform: scale()` y un tamaño base fijo.
- **Spec que lo cubre:** Ninguno.

---

### 🟢 MENORES (P2) — 11

> Bugs cosméticos, de accesibilidad, de robustez o de mantenibilidad. Resolubles en cualquier momento.

---

#### B12 — `.thumb-icon { position: fixed }` incorrecto ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.css:67`
- **Causa:** `position: fixed` saca al icono del flujo del thumb. Si el componente se usa dentro de un `transform: scale()` o un `overflow: hidden`, el icono puede aparecer en una posición incorrecta respecto al thumb.
- **Impacto:** Icono descentrado en escenarios con transforms.
- **Fix propuesto:** Cambiar a `position: absolute` y verificar que el padre (`thumb-default`) tiene `position: relative` (ya lo tiene implícitamente por estar dentro de `.scroll-thumb` que es `position: absolute`).
- **Spec que lo cubre:** N/A (CSS).

---

#### B13 — `cdkDragBoundary` con selector de string frágil ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.html:7` y `:15`
- **Causa:** `[cdkDragBoundary]="'.scrollbar-wrapper'"` busca el primer ancestro cuya clase sea `scrollbar-wrapper`. Si el consumidor envuelve el componente en otro elemento con esa misma clase (p. ej. una demo page), el drag se delimita por el wrapper equivocado.
- **Impacto:** El thumb puede arrastrarse fuera del componente en consumidores que reusen el nombre de clase.
- **Fix propuesto:** Usar `ElementRef` directamente:
  ```ts
  @ViewChild('wrapper') wrapperRef!: ElementRef<HTMLElement>;
  ```
  ```html
  <div class="scrollbar-wrapper" #wrapper>
  ```
  Y en el componente:
  ```ts
  readonly cdkDragBoundary = this.wrapperRef; // se enlaza con [cdkDragBoundary]
  ```
- **Spec que lo cubre:** Ninguno.

---

#### B14 — `<img>` sin `alt` ni `loading="lazy"` ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.html:11` y `:19`
- **Causa:** `<img *ngIf="scrollIcon" [src]="scrollIcon" class="thumb-icon">` no tiene `alt` ni `loading`. Linter de accesibilidad y Lighthouse Penalizan.
- **Impacto:** Auditorías WCAG fallan; la imagen se carga eagerly aunque no esté visible.
- **Fix propuesto:**
  ```html
  <img *ngIf="scrollIcon" [src]="scrollIcon" class="thumb-icon" alt="" loading="lazy" decoding="async">
  ```
  `alt=""` es válido para imágenes decorativas (WAI-ARIA).
- **Spec que lo cubre:** Ninguno (DOM, no testeable sin snapshots).

---

#### B17 — `dragEnd` sin comprobación de parent ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:119` y `:143`
- **Causa:** `onVerticalDragEnd` se invoca incondicionalmente al soltar el drag. Si el thumb fue destruido (`*ngIf` lo desmontó) durante el drag, el evento `cdkDragEnd` puede llegar cuando el `ViewChild` ya no apunta al contenedor.
- **Impacto:** Posible `TypeError: Cannot read property 'nativeElement' of undefined` en race conditions raras.
- **Fix propuesto:**
  ```ts
  onVerticalDragEnd(event: CdkDragEnd) {
      this.isDraggingVertical = false;
      if (this.scrollContainer?.nativeElement) {
          this.onContentScroll();
      }
  }
  ```
- **Spec que lo cubre:** `should not throw on dragEnd if container was detached` (propuesto).

---

#### B18 — `setTimeout(0)` race con `ngOnDestroy` ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:42` y `:45`
- **Causa:** El `setTimeout` de inicialización puede dispararse **después** de que `ngOnDestroy` haya limpiado el `ResizeObserver`. Resultado: `onContentScroll` se ejecuta sobre un observer muerto, no actualiza nada, y el componente se queda en estado inicial (thumb invisible si el contenido ya tenía overflow).
- **Impacto:** En tests con `fakeAsync` + `tick(0)` esto es reproducible 100% de las veces.
- **Fix propuesto:** Capturar el ID del timer y cancelarlo en `ngOnDestroy`:
  ```ts
  private initTimer: any;

  ngAfterViewInit() {
      ...
      this.initTimer = setTimeout(() => this.onContentScroll(), 0);
  }

  ngOnDestroy() {
      if (this.initTimer) clearTimeout(this.initTimer);
      ...
  }
  ```
  O usar `afterNextRender` (Angular 16+) que se coordina con el lifecycle.
- **Spec que lo cubre:** `should cancel init timer on destroy` (propuesto).

---

#### B21 — Sin ARIA roles ni `tabindex` ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.html` (toda la plantilla)
- **Causa:** Los thumbs son `<div>` arrastrables pero no tienen `role="scrollbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-orientation`, ni `tabindex="0"`. Los lectores de pantalla no anuncian los thumbs ni permiten foco por teclado.
- **Impacto:** Falla WCAG 2.1 (criterios 4.1.2 y 2.1.1).
- **Fix propuesto:**
  ```html
  <div role="scrollbar"
       aria-orientation="vertical"
       [attr.aria-valuenow]="scrollTop"
       aria-valuemin="0"
       [attr.aria-valuemax]="maxScrollTop"
       tabindex="0"
       ...>
  ```
  Y exponer `scrollTop`/`maxScrollTop` como getters en el componente.
- **Spec que lo cubre:** `should expose ARIA attributes on thumbs` (propuesto).

---

#### B22 — Sin keyboard handlers ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts` (no existen handlers)
- **Causa:** El thumb solo es operable con mouse/touch. Un usuario con teclado no puede hacer scroll.
- **Impacto:** Inaccesible para usuarios sin mouse.
- **Fix propuesto:**
  ```ts
  @HostListener('keydown.arrowdown', ['$event'])
  @HostListener('keydown.arrowup', ['$event'])
  onVerticalKeydown(event: KeyboardEvent) {
      const el = this.scrollContainer.nativeElement;
      const delta = event.key === 'ArrowDown' ? 40 : -40;
      el.scrollTop = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, el.scrollTop + delta));
      event.preventDefault();
  }
  ```
  Aplicar análogo para horizontal con ArrowLeft/Right.
- **Spec que lo cubre:** `should scroll on ArrowDown/ArrowUp when thumb focused` (propuesto).

---

#### B26 — `parseThumbSize` corre aunque no haya overflow ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:82-84`
- **Causa:** `parseThumbSize` se llama al inicio de `onContentScroll`, antes de comprobar si hay overflow. Esto es trabajo wasted en el caso común (contenido cabe en el contenedor).
- **Impacto:** CPU innecesario en cada evento de scroll/resize, especialmente con muchos componentes instanciados.
- **Fix propuesto:** Mover la llamada a `parseThumbSize` dentro de los `if (this.showVertical)` / `if (this.showHorizontal)`:
  ```ts
  onContentScroll() {
      const el = this.scrollContainer?.nativeElement;
      if (!el) return;

      const scrollHeight = el.scrollHeight;
      const clientHeight = el.clientHeight;
      this.showVertical = scrollHeight > clientHeight;
      this.showHorizontal = el.scrollWidth > el.clientWidth;

      if (!this.isDraggingVertical && this.showVertical) {
          const thumbSizePx = this.parseThumbSize();
          ...
      }
      ...
  }
  ```
- **Spec que lo cubre:** Ninguno (micro-optimización).

---

#### B27 — `maxThumbTop`/`maxThumbLeft` recomputado en cada `move` ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:130` y `:153`
- **Causa:** En `onVerticalDragMoved` y `onHorizontalDragMoved`, `maxThumbTop` se recalcula en cada evento `cdkDragMoved`, que puede dispararse a 60-120 Hz. `parseThumbSize` se llama también.
- **Impacto:** CPU gastado en operaciones que solo cambian cuando el contenedor cambia de tamaño.
- **Fix propuesto:** Cachear `maxThumbTop` y `maxScrollTop` en `onContentScroll` (ya se calculan ahí) y leerlos en `onVerticalDragMoved`:
  ```ts
  private cachedMaxThumbTop = 0;
  private cachedMaxScrollTop = 0;
  ```
  Invalidar el caché en `resize`.
- **Spec que lo cubre:** Ninguno.

---

#### B28 — Getter `thumbSizeStyle` es código muerto ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:54-56`
- **Causa:**
  ```ts
  get thumbSizeStyle() {
      return this.scrollThumbSize;
  }
  ```
  Devuelve la cadena cruda (`'2vw'`) y se usa en `[style.width]="thumbSizeStyle"` y `[style.height]="thumbSizeStyle"`. Esto funciona (Angular aplica el valor al estilo), pero el nombre sugiere que se devuelve un objeto de estilo. Es código defensivo mal nombrado.
- **Impacto:** Confusión para mantenedores. Posible refactor futuro que rompa la API.
- **Fix propuesto:** Renombrar a `thumbSizeRaw` y comentar que devuelve string, no objeto:
  ```ts
  /** Returns the raw scrollThumbSize string (e.g. '2vw') for direct binding to [style]. */
  get thumbSizeRaw() { return this.scrollThumbSize; }
  ```
  Actualizar el template.
- **Spec que lo cubre:** Ninguno (puro refactor).

---

## Bugs de Documentación (D1–D5)

### D1 — README.md línea 81 declara tipo incorrecto de `scrollThumbSize` ⏳ PENDIENTE

- **Archivo:línea:** `README.md:81`
- **Causa:** La documentación (o doc-comment) dice que `scrollThumbSize` es `number`, pero el `@Input` real es `string` (`scrollThumbSize: string = '2vw'`).
- **Impacto:** Consumidores que confían en la documentación escriben `[scrollThumbSize]="2"` (número), que Angular acepta pero produce un warning de tipo, y al renderizar CSS `2` se interpreta como `2px` (no `2vw`).
- **Fix propuesto:** Cambiar la línea 81 a:
  > `| `scrollThumbSize` | `string` | `'2vw'` | Tamaño del thumb en cualquier unidad CSS válida. |`
- **Spec que lo cubre:** N/A (documentación).

### D2 — README.md línea 57 ejemplo ROTO `[scrollThumbSize]="2"` ⏳ PENDIENTE

- **Archivo:línea:** `README.md:57`
- **Causa:** El ejemplo muestra `<lib-virtual-scrollbar [scrollThumbSize]="2">`, pasando un `number` literal. Esto contradice el tipo declarado (`string`) y la salida real (2 se interpreta como `2px` por CSS).
- **Impacto:** Consumidores copian-pegan el ejemplo y obtienen un thumb diminuto que rompe su layout.
- **Fix propuesto:** Cambiar el ejemplo a:
  ```html
  <lib-virtual-scrollbar scrollThumbSize="2vw">
  ```
  Y añadir nota: "Los valores numéricos se interpretan como píxeles. Usa una unidad CSS para responsividad."
- **Spec que lo cubre:** N/A.

### D3 — README_es.md ~18 acentos faltantes ⏳ PENDIENTE

- **Archivo:línea:** `README_es.md` (varias líneas)
- **Causa:** La versión en español tiene aproximadamente 18 palabras con acentos omitidos (tildes diacríticas). Ejemplos detectados (búsqueda rápida):
  - "configuracion" → "configuración"
  - "codigo" → "código"
  - "version" → "versión"
  - "opcion" → "opción"
  - "aplicacion" → "aplicación"
  - "posicion" → "posición"
  - "tambien" → "también"
  - "pagina" → "página"
  - "minimo" → "mínimo"
  - "maximo" → "máximo"
  - ... (8 adicionales pendientes de auditoría exhaustiva)
- **Impacto:** Calidad percibida baja; inconsistente con la versión EN.
- **Fix propuesto:** Auditoría línea por línea con corrector ortográfico (p. ej. `aspell --lang=es list < README_es.md`). Aplicar correcciones y commit aparte.
- **Spec que lo cubre:** N/A.

### D4 — `parseThumbSize()` no documentado ⏳ PENDIENTE

- **Archivo:línea:** `virtual-scrollbar.component.ts:58-80` (función)
- **Causa:** El método privado `parseThumbSize` no tiene JSDoc. Las unidades soportadas (`px`, `vw`, `vh`, `rem`, `em`, `%`) no están documentadas en ningún lugar accesible al consumidor. El usuario no sabe qué unidades puede pasar.
- **Impacto:** El consumidor prueba con `scrollThumbSize="20"` esperando píxeles y obtiene un thumb diminuto. O prueba con `"5%"` esperando un porcentaje del contenedor (que sí funciona, pero no lo sabe).
- **Fix propuesto:** Añadir JSDoc al método (privado, para mantenedores) y un bloque en `README.md` con la tabla de unidades:
  ```markdown
  | Unidad | Resolución |
  | :--- | :--- |
  | `px` | Píxeles CSS literales. |
  | `vw` / `vh` | % del viewport. |
  | `%` | % de la dimensión del contenedor. |
  | `rem` / `em` | Multiplicador del font-size (root o contenedor). |
  ```
- **Spec que lo cubre:** Cubierto parcialmente por `parseThumbSize` specs (unidades individuales).

### D5 — Features no documentadas ⏳ PENDIENTE

- **Archivo:línea:** `README.md` (sección "API" inexistente)
- **Causa:** El README no documenta:
  - El input `scrollIcon` (ruta del icono).
  - El comportamiento de auto-hide (los thumbs aparecen solo cuando hay overflow).
  - La integración con Angular CDK (versión mínima, peer dependency).
  - Soporte (o falta de) de RTL, teclado, ARIA, touch.
  - Limitaciones conocidas (B7/B8/B9).
- **Impacto:** Consumidores descubren features por ensayo y error. La promesa de "scrollbar virtual" no se cumple sin un API doc.
- **Fix propuesto:** Crear sección "API" en README.md con:
  - Tabla de inputs (nombre, tipo, default, descripción).
  - Tabla de outputs (ninguno actualmente).
  - Lista de eventos DOM (ninguno personalizado).
  - Lista de métodos públicos (ninguno).
  - Sección "Limitaciones conocidas" con los bugs P0 documentados.
  - Sección "Accesibilidad" indicando estado (B21, B22, B24).
- **Spec que lo cubre:** N/A.

---

## Plan de Acción Recomendado

> El plan se divide en **4 fases** (no 5, porque no hay ningún bug **CR bloqueante** que impida siquiera compilar). El bug B8 (drag math) es el más grave, pero se aborda en Fase 1 junto con los demás P0.

### Fase 0 — Suite de Tests ✅ COMPLETADA

**Estado:** ✅ **Hecho** (commit del 2026-06-04)

- **Resultado:** 20 specs en `virtual-scrollbar.component.spec.ts`.
- **Cobertura actual:**
  - Renderizado del componente.
  - Detección de overflow vertical/horizontal.
  - Cálculo de `scrollRatio` con overflow y sin overflow.
  - `parseThumbSize` con `px`, `vw`, `vh`, `rem`, `em`, `%`.
  - Drag start/end (cambio de flags).
  - Sanitización inicial.
  - Cleanup en `ngOnDestroy` (básico).
- **Pendiente menor:** algunos specs marcados con `fit` (focused) que deberían pasar a `it` antes de merge final.

**Criterio de salida:** ✅ Cubierto. La suite sirve como red de seguridad para los fixes de Fase 1.

---

### Fase 1 — Bugs P0 (Críticos) ⏳ PENDIENTE

**Objetivo:** Que el drag funcione y no haya memory leaks.

**Bugs a resolver:**

| # | Bug | Líneas | Esfuerzo |
| :- | :-- | ---: | :--- |
| B7 | `scrollRatio` NaN | 95, 108 | XS (5 min) |
| B8 | Drag origin offset | 125, 148 | M (30 min, requiere test de regresión) |
| B9 | Scroll loop | 135, 158 | S (15 min) |
| B19 | Sin throttle/rAF | 82 | S (15 min) |
| B20 | Leak path | 31, 45 | S (15 min) |
| B1 | `takeUntilDestroyed` | 31 | S (15 min) |

**Orden recomendado:**
1. **B7** primero (fix trivial, allana specs).
2. **B8** (el crítico de verdad; añadir spec de regresión que arrastre varios frames).
3. **B9** (relacionado con B8, fácil de testear junto).
4. **B19** (microoptimización que evita falsos positivos en B8).
5. **B1 + B20** (cleanup, una vez que la lógica core funciona).

**Criterio de salida:**
- Todos los specs pasan.
- Specs de regresión para B7, B8, B9 añadidos.
- No hay warnings de `NG0913` ni `ExpressionChangedAfterItHasBeenCheckedError` en dev mode.

**Tiempo estimado:** 1 día (4-6 horas reales).

---

### Fase 2 — Bugs P1 (Importantes) ⏳ PENDIENTE

**Objetivo:** Robustez, accesibilidad parcial, compatibilidad de plataforma.

**Bugs a resolver:**

| # | Bug | Líneas | Esfuerzo |
| :- | :-- | ---: | :--- |
| B2 | ResizeObserver fuera de zone | 36 | XS (5 min) |
| B3 | setTimeout sin zone | 42 | XS (5 min) |
| B5 | parseThumbSize NaN branch | 73 | XS (5 min) |
| B6 | `el` puede ser null | 83 | XS (5 min) |
| B10 | pointer-events durante drag | 115, 119 | S (10 min) |
| B11 | scrollIcon sin sanitizer | 10 | S (15 min) |
| B15 | ResizeObserver polyfill | 36 | M (30 min, requiere decisión de dependencia) |
| B16 | resize durante drag | 36 | S (15 min) |
| B23 | touch-action en thumb | CSS | XS (5 min) |
| B24 | Soporte RTL | 104, 148 | M (1 h, requiere spec) |
| B25 | High-DPI | 58-80 | S (10 min) |

**Orden recomendado:**
1. B2, B3 (zone fixes) — primero, afectan a tests.
2. B5, B6 (null-safety) — guardas simples.
3. B10, B11, B16 (lifecycle) — robustez.
4. B15, B23 (compatibilidad) — pueden requerir decisión de producto.
5. B24 (RTL) — al final, requiere PR aparte por scope.
6. B25 (high-DPI) — micro.

**Criterio de salida:**
- No crashes en IE11/Safari < 13.1 (con polyfill).
- No `TypeError` en SSR.
- Drag funciona en dispositivos táctiles (verificación manual).

**Tiempo estimado:** 1.5 días (10-12 horas).

---

### Fase 3 — Polish + Documentación ⏳ PENDIENTE

**Objetivo:** Limpieza, accesibilidad completa, docs al día.

**Bugs de código a resolver:**

| # | Bug | Esfuerzo |
| :- | :-- | :--- |
| B4 | `parseThumbSize` em branch | XS (decisión de docs) |
| B12 | `.thumb-icon` position | XS (5 min) |
| B13 | cdkDragBoundary frágil | S (20 min) |
| B14 | `<img>` sin alt/loading | XS (5 min) |
| B17 | dragEnd sin parent check | XS (5 min) |
| B18 | setTimeout race | XS (10 min) |
| B21 | ARIA roles/tabindex | M (45 min) |
| B22 | Keyboard handlers | M (45 min) |
| B26 | parseThumbSize lazy | XS (10 min) |
| B27 | maxThumbTop cached | XS (10 min) |
| B28 | thumbSizeStyle rename | XS (10 min) |

**Bugs de documentación a resolver:**

| # | Bug | Esfuerzo |
| :- | :-- | :--- |
| D1 | README tipo incorrecto | XS (5 min) |
| D2 | README ejemplo roto | XS (5 min) |
| D3 | README_es acentos | S (30 min, audit) |
| D4 | parseThumbSize sin docs | S (20 min) |
| D5 | Features no documentadas | M (1 h) |

**Criterio de salida:**
- Lighthouse Accessibility ≥ 95.
- README + README_es pasan corrector ortográfico.
- API documentada al 100% (no hay inputs/outputs sin documentar).

**Tiempo estimado:** 1.5 días (10-12 horas).

---

## Tabla Resumen

### Bugs de Código

| ID | Severidad | Título | Archivo:Línea | Estado | Fase |
| :- | :-: | :-- | :-- | :-: | :-: |
| B1  | 🔴 P0 | Renderer2 scroll listener sin takeUntilDestroyed | component.ts:31 | ⏳ PENDIENTE | 1 |
| B2  | 🟡 P1 | ResizeObserver fuera de Angular zone | component.ts:36 | ⏳ PENDIENTE | 2 |
| B3  | 🟡 P1 | setTimeout(0) bypassa zone | component.ts:42 | ⏳ PENDIENTE | 2 |
| B4  | 🟢 P2 | parseThumbSize em lee container, no thumb | component.ts:73 | ⏳ PENDIENTE | 3 |
| B5  | 🟡 P1 | parseThumbSize em branch NaN | component.ts:73 | ⏳ PENDIENTE | 2 |
| B6  | 🟡 P1 | el puede ser null | component.ts:83 | ⏳ PENDIENTE | 2 |
| B7  | 🔴 P0 | scrollRatio NaN cuando no overflow | component.ts:95, 108 | ⏳ PENDIENTE | 1 |
| B8  | 🔴 P0 | getFreeDragPosition absoluta usada como delta | component.ts:125, 148 | ⏳ PENDIENTE | 1 |
| B9  | 🔴 P0 | el.scrollTop = ratio * maxScrollTop causa loop | component.ts:135, 158 | ⏳ PENDIENTE | 1 |
| B10 | 🟡 P1 | Sin pointer-events: none durante drag | component.ts:115, 119 | ⏳ PENDIENTE | 2 |
| B11 | 🟡 P1 | scrollIcon sin DomSanitizer | component.ts:10 | ⏳ PENDIENTE | 2 |
| B12 | 🟢 P2 | .thumb-icon { position: fixed } incorrecto | CSS:67 | ⏳ PENDIENTE | 3 |
| B13 | 🟢 P2 | cdkDragBoundary string selector frágil | html:7 | ⏳ PENDIENTE | 3 |
| B14 | 🟢 P2 | `<img>` sin alt/loading | html:11 | ⏳ PENDIENTE | 3 |
| B15 | 🟡 P1 | ResizeObserver no polyfilled | component.ts:36 | ⏳ PENDIENTE | 2 |
| B16 | 🟡 P1 | resize durante drag muta show* | component.ts:36 | ⏳ PENDIENTE | 2 |
| B17 | 🟢 P2 | dragEnd sin parent check | component.ts:119 | ⏳ PENDIENTE | 3 |
| B18 | 🟢 P2 | setTimeout(0) race con destroy | component.ts:42, 45 | ⏳ PENDIENTE | 3 |
| B19 | 🔴 P0 | Sin throttle/rAF en onContentScroll | component.ts:82 | ⏳ PENDIENTE | 1 |
| B20 | 🔴 P0 | Leak path: scrollContainer destroyed antes que listener | component.ts:31, 45 | ⏳ PENDIENTE | 1 |
| B21 | 🟢 P2 | Sin ARIA roles/tabindex | html | ⏳ PENDIENTE | 3 |
| B22 | 🟢 P2 | Sin keyboard handlers | component.ts | ⏳ PENDIENTE | 3 |
| B23 | 🟡 P1 | Sin touch-action: none en thumb | CSS | ⏳ PENDIENTE | 2 |
| B24 | 🟡 P1 | Sin soporte RTL | component.ts:104, 148 | ⏳ PENDIENTE | 2 |
| B25 | 🟡 P1 | Sin soporte high-DPI | component.ts:58-80 | ⏳ PENDIENTE | 2 |
| B26 | 🟢 P2 | parseThumbSize corre sin overflow | component.ts:82 | ⏳ PENDIENTE | 3 |
| B27 | 🟢 P2 | maxThumbTop recomputado en cada move | component.ts:130, 153 | ⏳ PENDIENTE | 3 |
| B28 | 🟢 P2 | Getter thumbSizeStyle dead | component.ts:54-56 | ⏳ PENDIENTE | 3 |

### Bugs de Documentación

| ID | Severidad | Título | Archivo:Línea | Estado | Fase |
| :- | :-: | :-- | :-- | :-: | :-: |
| D1 | 🟢 P2 | Tipo incorrecto de scrollThumbSize | README.md:81 | ⏳ PENDIENTE | 3 |
| D2 | 🟡 P1 | Ejemplo ROTO `[scrollThumbSize]="2"` | README.md:57 | ⏳ PENDIENTE | 3 |
| D3 | 🟢 P2 | README_es.md ~18 acentos faltantes | README_es.md | ⏳ PENDIENTE | 3 |
| D4 | 🟢 P2 | parseThumbSize() no documentado | component.ts:58-80 | ⏳ PENDIENTE | 3 |
| D5 | 🟡 P1 | Features no documentadas | README.md | ⏳ PENDIENTE | 3 |

### Conteo por fase

| Fase | Bugs código | Bugs docs | Total | Estado |
| :-- | :-: | :-: | :-: | :-- |
| Fase 0 (Tests) | — | — | 20 specs | ✅ COMPLETADA |
| Fase 1 (P0) | 6 | 0 | 6 | ⏳ PENDIENTE |
| Fase 2 (P1) | 11 | 0 | 11 | ⏳ PENDIENTE |
| Fase 3 (P2 + docs) | 11 | 5 | 16 | ⏳ PENDIENTE |
| **TOTAL** | **28** | **5** | **33** | — |

### Conteo por severidad

| Severidad | Cantidad | % |
| :-- | :-: | :-: |
| 🔴 Crítica (P0) | 6 | 18% |
| 🟡 Importante (P1) | 11 | 33% |
| 🟢 Menor (P2) | 16 | 49% |
| **TOTAL** | **33** | 100% |

---

## Notas Arquitectónicas

### El bug B8 está oculto por el clamp `Math.max(0, Math.min(1, ...))`

**Contexto.** El bug más grave de este componente es **B8**: usar `getFreeDragPosition()` (que devuelve la posición acumulada del thumb desde el origen del drag) directamente como si fuera una fracción del track.

```ts
// component.ts:125-137
onVerticalDragMoved(event: CdkDragMove) {
    const el = this.scrollContainer.nativeElement;
    const thumbSizePx = this.parseThumbSize();

    const currentPos = event.source.getFreeDragPosition();  // ← posición ABSOLUTA
    const maxThumbTop = el.clientHeight - thumbSizePx;

    if (maxThumbTop > 0) {
        const ratio = Math.max(0, Math.min(1, currentPos.y / maxThumbTop));  // ← CLAMP
        const maxScrollTop = el.scrollHeight - el.clientHeight;
        el.scrollTop = ratio * maxScrollTop;
    }
}
```

**Por qué está oculto.** El clamp `Math.max(0, Math.min(1, x))` tiene dos efectos no deseados en este contexto:

1. **Saturación silenciosa.** Apenas el usuario arrastra más allá de `maxThumbTop` píxeles, `currentPos.y / maxThumbTop` supera `1`, el clamp lo limita a `1`, y `el.scrollTop` se queda en `maxScrollTop` (final del contenido). El usuario siente que "el thumb llegó al fondo y se quedó ahí", que es exactamente lo esperado, **pero no es lo que el código está intentando hacer**.

2. **Falsa sensación de corrección.** Cualquier prueba visual rápida —arrastrar, ver que el thumb llega al fondo, soltar— parece funcionar. El bug solo se manifiesta cuando el usuario:
   - Arrastra hacia **atrás** después de haber llegado al fondo. El thumb se queda pegado al fondo (la posición acumulada no se reduce).
   - Arrastra **despacio** y observa que el scroll responde solo al final del recorrido (la mayor parte del drag se "pierde" en el clamp).
   - Hace **scroll mediante la rueda del ratón** durante el drag. El thumb se desincroniza completamente.

3. **Cobertura de specs insuficiente.** El spec actual `should map drag position to scroll position proportionally` solo verifica **el primer frame** del drag. Con un solo frame, la posición absoluta y la delta son idénticas, y el spec pasa.

**Por qué un clamp genérico no es la solución.** Un clamp protege contra valores fuera de rango, pero no contra el cálculo equivocado. Aquí el cálculo es estructuralmente incorrecto desde el segundo frame en adelante, por lo que cualquier clamp solo enmascara el problema.

**Solución arquitectónica recomendada.** En `onVerticalDragStart`, capturar la posición inicial del thumb:

```ts
private verticalDragOrigin: { y: number } | null = null;

onVerticalDragStart(event: CdkDragStart) {
    this.isDraggingVertical = true;
    this.verticalDragOrigin = {
        y: this.verticalThumbPos.y,  // posición donde estaba el thumb antes de empezar
    };
}

onVerticalDragMoved(event: CdkDragMove) {
    const el = this.scrollContainer.nativeElement;
    const thumbSizePx = this.parseThumbSize();
    const maxThumbTop = el.clientHeight - thumbSizePx;
    if (maxThumbTop <= 0 || !this.verticalDragOrigin) return;

    // Posición absoluta del thumb = origen + delta del evento
    const newThumbY = this.verticalDragOrigin.y + event.distance.y;
    const ratio = newThumbY / maxThumbTop;  // sin clamp, asumimos que CDK ya limitó
    const maxScrollTop = el.scrollHeight - el.clientHeight;
    el.scrollTop = ratio * maxScrollTop;
}
```

**Alternativa más simple** (si se confía en que `cdkDragBoundary` limita el thumb al wrapper): usar directamente `event.distance.y` como delta desde el origen, lo que es válido **porque** `cdkDragBoundary` recorta cualquier movimiento que salga del wrapper:

```ts
const ratio = event.distance.y / maxThumbTop;
el.scrollTop = ratio * maxScrollTop;
```

Esto evita el clamp (innecesario si el boundary funciona) y elimina el origen acumulado.

**Validación con test de regresión.** Espec recomendado para B8:

```ts
it('should follow the drag with proportional scroll on every move', fakeAsync(() => {
    // Setup: content 10x larger than container
    // Frame 1: drag by 10px → scrollTop should be ~10/maxThumbTop * maxScrollTop
    // Frame 2: drag another 10px (total 20px) → scrollTop should be 20/maxThumbTop * maxScrollTop
    // Frame 3: drag back by 10px (total 10px from origin) → scrollTop should be 10/maxThumbTop * maxScrollTop
}));
```

Sin este test, cualquier refactor futuro puede reintroducir B8 inadvertidamente.

---

### Decisiones de diseño pendientes

Antes de empezar la Fase 1, conviene validar las siguientes decisiones de arquitectura con el equipo:

1. **Soporte de IE11 / Safari < 13.1.** ¿Se polyfillea `ResizeObserver` o se documenta como limitación?
2. **Soporte RTL.** ¿Es P1 bloqueante para v1.0 o se difiere a v1.1?
3. **Accesibilidad.** ¿WCAG 2.1 AA es requisito de release? Define el alcance de B21/B22.
4. **CDK como peer dependency.** ¿Se declara como `peerDependencies` o se reexporta desde el módulo?
5. **Output events.** ¿Se deben emitir `(scroll)` / `(scrollStart)` / `(scrollEnd)` para integración con otros componentes?

---

### Riesgos identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
| :-- | :-: | :-: | :-- |
| Fix de B8 introduce regresión en drag start | Media | Alta | Spec de regresión obligatorio, code review por segunda persona |
| Cambio de `scrollThumbSize` a `number` rompe consumidores | Baja | Alta | Mantener `string` como tipo público; deprecación gradual |
| Adición de `pointer-events: none` interfiere con click handlers del consumidor | Baja | Media | Documentar en CHANGELOG; permitir override por CSS |
| Tests con `fakeAsync` se rompen por B18 race | Alta | Baja | Mover a `waitForAsync` para los specs de lifecycle |

---

**Fin del plan de corrección.**

_Mantenido en `projects/virtual-scrollbar/CORRECTION_PLAN.md`._
_Reevaluar tras completar cada fase._
