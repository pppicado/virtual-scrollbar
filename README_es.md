# @pppicado/virtual-scrollbar

Un componente Angular de scrollbar virtual personalizado con soporte de arrastre mediante Angular CDK. Reemplaza los scrollbars nativos con thumbs arrastrables que pueden estilizarse y posicionarse libremente.

## Caracteristicas

- **Scrollbars Verticales y Horizontales**: Muestra automaticamente thumbs de scroll cuando el contenido desborda en cualquier direccion.
- **Arrastre para Scroll**: Arrastre suave de thumbs potenciado por `@angular/cdk/drag-drop` con bloqueo de eje.
- **Icono de Thumb Personalizado**: URL de imagen opcional para el thumb del scrollbar; usa un circulo CSS como respaldo.
- **Tamano Responsive**: El tamano del thumb se define en unidades de ancho de viewport (`vw`).
- **Integracion con ResizeObserver**: Recalcula automaticamente la posicion y visibilidad del thumb cuando el contenedor cambia de tamano.
- **Ocultacion de Scrollbars Nativos**: Usa CSS para ocultar completamente los scrollbars nativos del navegador en todos los motores.
- **Ligero y Facil de Integrar**: Funciona como componente de NgModule o dentro de ventanas `redim-frame`.

## Instalacion

```bash
npm install @pppicado/virtual-scrollbar
```

Dependencia peer requerida:

```bash
npm install @angular/cdk
```

## Configuracion

Importa `VirtualScrollbarModule` en el modulo de tu aplicacion:

```typescript
import { VirtualScrollbarModule } from '@pppicado/virtual-scrollbar';

@NgModule({
  imports: [VirtualScrollbarModule],
})
export class MyModule { }
```

## Uso

### Uso Basico

```html
<lib-virtual-scrollbar>
  <div style="height: 200vh">
    Contenido largo de scroll...
  </div>
</lib-virtual-scrollbar>
```

### Con Thumb Personalizado

```html
<lib-virtual-scrollbar 
  [scrollIcon]="'assets/scrollbar-thumb.png'" 
  [scrollThumbSize]="2">
  <div style="height: 200vh">
    Contenido largo de scroll...
  </div>
</lib-virtual-scrollbar>
```

### Desbordamiento Horizontal

```html
<lib-virtual-scrollbar>
  <div style="width: 200vw; height: 100%">
    Contenido ancho que hace scroll horizontal...
  </div>
</lib-virtual-scrollbar>
```

## API

### Entradas

| Entrada | Tipo | Por Defecto | Descripcion |
| :--- | :--- | :--- | :--- |
| `scrollIcon` | `string` | `''` | URL para la imagen del thumb del scrollbar. Si esta vacio, se renderiza un circulo CSS. |
| `scrollThumbSize` | `number` | `2` | Diametro del thumb en unidades de ancho de viewport (`vw`). |

### Como Funciona

1. El componente envuelve el contenido en un contenedor scrolleable con scrollbars nativos ocultos.
2. Un `ResizeObserver` vigila el contenedor para detectar cuando cambian las dimensiones de scroll.
3. Los elementos thumb vertical y horizontal se posicionan absolutamente basados en la proporcion de scroll.
4. Cada thumb usa `cdkDrag` con bloqueo de eje (`y` para vertical, `x` para horizontal) y una restriccion de limite.
5. Durante el arrastre, la posicion de scroll del contenedor de contenido se actualiza en tiempo real.
6. Al finalizar el arrastre, la posicion final se sincroniza y se reanudan las actualizaciones de auto-scroll.

## Dependencias Pares

- `@angular/common` `^16.2.0`
- `@angular/core` `^16.2.0`
- `@angular/cdk` `^16.2.0`

## Desarrollo

Esta biblioteca fue generada con [Angular CLI](https://github.com/angular/angular-cli) version 16.2.0.

### Compilacion

```bash
ng build virtual-scrollbar
```

Los artefactos de compilacion se almacenan en el directorio `dist/`.

### Ejecutar Pruebas Unitarias

```bash
ng test virtual-scrollbar
```

Ejecuta las pruebas unitarias mediante [Karma](https://karma-runner.github.io).

### Generacion de Codigo

```bash
ng generate component component-name --project virtual-scrollbar
```

> No olvides agregar `--project virtual-scrollbar` o se agregara al proyecto por defecto en tu archivo `angular.json`.

## Ayuda Adicional

Para obtener mas ayuda sobre Angular CLI, usa `ng help` o visita la pagina [Angular CLI Overview and Command Reference](https://angular.io/cli).

## Licencia

MIT
