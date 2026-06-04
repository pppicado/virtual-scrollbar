# `@pppicado/virtual-scrollbar`

> Componente Angular de scrollbar virtual con drag (Angular CDK).
> Documentación unificada en español: [`../../docs/`](../../docs/README.md).

## 📚 Documentación

Toda la información de este submódulo está centralizada en:

| Recurso | Enlace |
| :--- | :--- |
| **Estado** | [`../../docs/estado/virtual-scrollbar.md`](../../docs/estado/virtual-scrollbar.md) |
| **Planificación** | [`../../docs/planificacion/virtual-scrollbar.md`](../../docs/planificacion/virtual-scrollbar.md) |
| **Errores** | [`../../docs/errores/virtual-scrollbar.md`](../../docs/errores/virtual-scrollbar.md) |
| **Arquitectura** | [`../../docs/documentacion/arquitectura.md`](../../docs/documentacion/arquitectura.md) |
| **Testing** | [`../../docs/documentacion/testing.md`](../../docs/documentacion/testing.md) |
| **Build** | [`../../docs/documentacion/build-y-despliegue.md`](../../docs/documentacion/build-y-despliegue.md) |

## Inicio Rápido

```bash
# Compilar
npm run build:scrollbar
```

```typescript
import { VirtualScrollbarModule } from '@pppicado/virtual-scrollbar';

@NgModule({
  imports: [VirtualScrollbarModule]
})
export class MyModule {}
```

```html
<lib-virtual-scrollbar scrollThumbSize="2vw">
    <div style="height: 200vh">Contenido largo...</div>
</lib-virtual-scrollbar>
```

## Resumen Ejecutivo

- **Tipo:** Librería Angular (NgModule, CDK drag).
- **Estado:** 🟡 En desarrollo — drag math rota, 28 bugs de código + 5 bugs de docs.
- **Tests:** 20 specs creados (2026-06-04).
- **Acción inmediata:** Fix drag math (B7/B8/B9) — feature core rota.

Ver [`../../docs/estado/virtual-scrollbar.md`](../../docs/estado/virtual-scrollbar.md) para detalle completo.

## Licencia

MIT
