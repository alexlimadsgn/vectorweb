# Vector Web Animate

Editor web de animação vetorial: desenhe formas no canvas, anime propriedades por keyframes numa timeline com curvas de easing e exporte como SVG animado.

## Stack

React 19 · Vite · TypeScript · Chakra UI · Zustand · GSAP

## Rodar localmente

**Pré-requisito:** Node.js

```bash
npm install
npm run dev       # http://localhost:3000
```

## Scripts

| Comando           | Descrição                         |
| ----------------- | --------------------------------- |
| `npm run dev`     | Servidor de desenvolvimento       |
| `npm run build`   | Build de produção em `dist/`      |
| `npm run preview` | Serve o build de produção         |
| `npm run lint`    | Checagem de tipos (`tsc --noEmit`) |

## Estrutura

- `src/components/` — canvas, timeline, inspector, camadas, toolbar
- `src/lib/` — animação, geometria, cores, snap e exportação de SVG
- `src/store/useStore.ts` — estado global (Zustand)

## Licença

[MIT](LICENSE)
