# GeoSimulator (React + Three.js)

Simulador de geologia (React) com base em Three.js (via React Three Fiber).

Ideias / roadmap:

- rochas;
- lava;
- oceano;
- tempestade;
- clima.

## Desenvolvimento local

1) Instale as dependências:

- Windows (PowerShell): `& "C:\Program Files\nodejs\npm.cmd" install`

2) Rode o dev server:

- `& "C:\Program Files\nodejs\npm.cmd" run dev`

## Build

- `& "C:\Program Files\nodejs\npm.cmd" run build`

O build sai em `docs/` (pensado para GitHub Pages).

## GitHub Pages (via `docs/` + GitHub Actions)

Este repositório inclui um workflow que, a cada push na branch `main`, roda o build e commita o conteúdo gerado em `docs/`.

Para publicar:

1) No GitHub: **Settings → Pages**
2) **Build and deployment → Source**: `Deploy from a branch`
3) **Branch**: `main` e **Folder**: `/docs`

Observação: `public/.nojekyll` é copiado para o build para evitar interferência do Jekyll no Pages.

## Guia para IA (consistência)

Consulte o guia para manter consistência de geração procedural, escala e performance:

- [AI_GUIDE.md](AI_GUIDE.md)

## Guia técnico (diagramas)

- [TECHNICAL_GUIDE.md](TECHNICAL_GUIDE.md)