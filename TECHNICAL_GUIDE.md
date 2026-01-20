# Technical Guide (humans + machines)

Este documento descreve a arquitetura, fluxo de dados e módulos do simulador, com diagramas para rápida compreensão e evolução.

## Visão geral

- Frontend: React + Vite + TypeScript.
- Renderização 3D: Three.js via React Three Fiber (R3F) e Drei.
- Build/Deploy: GitHub Actions gera `docs/` (GitHub Pages).

## Fluxo de alto nível (UI → Cena)

```mermaid
flowchart TD
  A[App.tsx] -->|Lazy-load| B[GeoScene.tsx]
  A -->|seed global| B
  B --> C[PlanetVoxels]
  B --> D[Player + Camera]
  B --> E[Lights]
```

## Arquitetura de cena

```mermaid
graph TD
  GeoScene --> PlanetVoxels
  GeoScene --> Player
  GeoScene --> Lighting
  GeoScene --> Camera
  PlanetVoxels -->|seed| RNG
  Player -->|WASD| Input
  Player -->|surface normal| TangentMove
```

## Fluxo de dados do `seed`

```mermaid
sequenceDiagram
  participant UI as App.tsx
  participant Scene as GeoScene
  participant Planet as PlanetVoxels
  UI->>UI: Gera seed (Math.random)
  UI->>Scene: props.seed
  Scene->>Planet: seed
  Planet->>Planet: generatePlanet(seed)
```

## Regras técnicas essenciais

1) **Seed único e determinístico**
- Todas as features devem aceitar `seed` como entrada.

2) **Escala global**
- `PLANET_RADIUS` e `VOXEL_SIZE` são fonte única de verdade.

3) **Performance**
- Preferir instancing para voxels.
- Não alocar objetos dentro de `useFrame`.

4) **Câmera em 1ª pessoa**
- Câmera segue personagem e olha na direção do movimento.

## Módulos e responsabilidades

| Módulo | Responsabilidade |
|---|---|
| `src/App.tsx` | UI, lazy-load, seed global |
| `src/scene/GeoScene.tsx` | Cena principal, iluminação, player |
| `src/scene/` | Componentes 3D e sistemas |

## Padrões de extensão (para IA e humanos)

- Novo sistema → `src/scene/systems/`
- Novo material/shader → `src/scene/materials/`
- Utilitários → `src/scene/utils/`

## Diagrama de build/deploy

```mermaid
flowchart LR
  A[push main] --> B[GitHub Actions]
  B --> C[npm ci]
  C --> D[npm run build]
  D --> E[docs/]
  E --> F[GitHub Pages]
```

## Check de consistência

- [ ] Usa `seed` global
- [ ] Respeita escala
- [ ] Mantém lazy-load
- [ ] Mantém 1ª pessoa
- [ ] Não cria objetos em `useFrame`
