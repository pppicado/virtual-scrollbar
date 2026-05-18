# @pppicado/virtual-scrollbar

A custom virtual scrollbar Angular component with drag support via Angular CDK. Replaces native scrollbars with draggable thumbs that can be styled and positioned freely.

## Features

- **Vertical & Horizontal Scrollbars**: Automatically shows scroll thumbs when content overflows in either direction.
- **Drag-to-Scroll**: Smooth thumb dragging powered by `@angular/cdk/drag-drop` with axis locking.
- **Custom Thumb Icon**: Optional image URL for the scrollbar thumb; falls back to a CSS circle.
- **Responsive Sizing**: Thumb size is defined in viewport width units (`vw`).
- **ResizeObserver Integration**: Automatically recalculates thumb position and visibility when the container resizes.
- **Native Scrollbar Hiding**: Uses CSS to completely hide native browser scrollbars across all engines.
- **Lightweight & Easy to Integrate**: Works as an NgModule component or inside `redim-frame` windows.

## Installation

```bash
npm install @pppicado/virtual-scrollbar
```

Peer dependency required:

```bash
npm install @angular/cdk
```

## Setup

Import `VirtualScrollbarModule` in your application module:

```typescript
import { VirtualScrollbarModule } from '@pppicado/virtual-scrollbar';

@NgModule({
  imports: [VirtualScrollbarModule],
})
export class MyModule { }
```

## Usage

### Basic Usage

```html
<lib-virtual-scrollbar>
  <div style="height: 200vh">
    Long scrolling content...
  </div>
</lib-virtual-scrollbar>
```

### With Custom Thumb

```html
<lib-virtual-scrollbar 
  [scrollIcon]="'assets/scrollbar-thumb.png'" 
  [scrollThumbSize]="2">
  <div style="height: 200vh">
    Long scrolling content...
  </div>
</lib-virtual-scrollbar>
```

### Horizontal Overflow

```html
<lib-virtual-scrollbar>
  <div style="width: 200vw; height: 100%">
    Wide content that scrolls horizontally...
  </div>
</lib-virtual-scrollbar>
```

## API

### Inputs

| Input | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `scrollIcon` | `string` | `''` | URL for the scrollbar thumb image. If empty, a CSS circle is rendered. |
| `scrollThumbSize` | `number` | `2` | Diameter of the thumb in viewport width units (`vw`). |

### How It Works

1. The component wraps content in a scrollable container with native scrollbars hidden.
2. A `ResizeObserver` watches the container to detect when scroll dimensions change.
3. Vertical and horizontal thumb elements are positioned absolutely based on scroll ratio.
4. Each thumb uses `cdkDrag` with axis locking (`y` for vertical, `x` for horizontal) and a boundary constraint.
5. During drag, the scroll position of the content container is updated in real time.
6. On drag end, the final position is synced and auto-scroll updates resume.

## Peer Dependencies

- `@angular/common` `^16.2.0`
- `@angular/core` `^16.2.0`
- `@angular/cdk` `^16.2.0`

## Development

This library was generated with [Angular CLI](https://github.com/angular/angular-cli) version 16.2.0.

### Build

```bash
ng build virtual-scrollbar
```

Build artifacts are stored in the `dist/` directory.

### Running Unit Tests

```bash
ng test virtual-scrollbar
```

Executes unit tests via [Karma](https://karma-runner.github.io).

### Code Scaffolding

```bash
ng generate component component-name --project virtual-scrollbar
```

> Don't forget to add `--project virtual-scrollbar` or else it will be added to the default project in your `angular.json` file.

## Further Help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

## License

MIT
