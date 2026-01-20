# AI Guide (consistência de evolução)

Este projeto deve manter consistência visual, técnica e de gameplay à medida que novas features são adicionadas.

## Regras de consistência (essenciais)

1) **Seed determinística**
- Toda geração procedural deve aceitar um `seed` único vindo do `App`.
- Não criar geradores aleatórios sem passar o `seed` global.

2) **Mini planeta e escala**
- Manter `PLANET_RADIUS` e `VOXEL_SIZE` como fonte única de verdade.
- Qualquer nova feature deve respeitar essa escala (efeitos, partículas, assets).

3) **Performance**
- Preferir instancing e memoização (`useMemo`) para dados estáticos.
- Evitar re-gerar geometria a cada frame.
- Evitar criar objetos dentro de `useFrame`.

4) **Fluxo de UI**
- “Iniciar simulação” dispara o `seed` e carrega o cenário (lazy-load).
- Não remover o lazy-load do cenário 3D.

5) **Gameplay**
- Movimento segue a superfície do planeta.
- Câmera em 1ª pessoa sempre segue o personagem.
- Não quebrar os controles `WASD`/setas.

6) **Arquitetura**
- Conteúdo 3D fica em `src/scene/`.
- Evitar lógica pesada em `App.tsx`.

## Organização de arquivos

- `src/scene/`: entidades do mundo (terreno, água, lava, efeitos, player).
- `src/scene/systems/`: sistemas de simulação (clima, erosão, temperatura).
- `src/scene/materials/`: materiais/shaders.
- `src/scene/utils/`: helpers e RNG.

Se criar novas pastas, manter nomes curtos e sem abreviações ambíguas.

## Padrões de nomenclatura

- Componentes React: `PascalCase` (`PlanetVoxels`, `LavaFlow`).
- Utilitários/funções: `camelCase` (`generatePlanet`, `seededNoise`).
- Constantes: `UPPER_SNAKE_CASE` (`PLANET_RADIUS`).
- Arquivos: `PascalCase.tsx` para componentes, `camelCase.ts` para utilitários.

## Regras de geração procedural

- Cada feature procedural deve aceitar `seed` e um `layerId` (string) para variar ruídos sem conflitar.
- Não usar `Math.random()` diretamente.
- Geração deve acontecer fora do `render` (usar `useMemo`).

## Regras de câmera e controles

- Câmera sempre em 1ª pessoa, posicionada acima do personagem.
- Rotação da câmera deve respeitar o vetor “normal” do planeta.
- Controles `WASD`/setas devem seguir o plano tangente local.

## Diretrizes visuais

- Paleta coerente com geologia (tons terrosos, água azul escura, lava emissiva).
- Luz principal direcional + ambiente suave.
- Evitar saturação excessiva; preferir “cinema/realista”.

## Performance e limites

- Objetivo: manter o JS inicial < 200kB (sem o chunk do cenário).
- Cenário 3D pode ficar em chunk separado (lazy-load).
- Preferir instanced meshes para voxels e partículas.
- Evitar sombras dinâmicas no MVP.

## Testes mínimos (manual)

- [ ] `npm run build` sem erros.
- [ ] Iniciar simulação não quebra (lazy-load funciona).
- [ ] Movimento na superfície e câmera em 1ª pessoa ok.
- [ ] Seed diferente gera planeta diferente.

## Glossário

- **Mini planeta**: esfera voxelizada onde o jogador caminha na superfície.
- **Seed**: número inteiro que determina a geração procedural.
- **Voxel**: bloco cúbico instanciado na superfície do planeta.
- **Chunk**: arquivo JS separado gerado no build (code-splitting).
- **Lazy-load**: carregar o cenário 3D apenas após o usuário iniciar a simulação.

## Checklist de PR

- [ ] Mantém `seed` único vindo do `App`?
- [ ] Mantém 1ª pessoa e controles `WASD`/setas?
- [ ] Não remove o lazy-load do cenário 3D?
- [ ] Não cria objetos em `useFrame`?
- [ ] Respeita escala do planeta (`PLANET_RADIUS`, `VOXEL_SIZE`)?
- [ ] Não quebra o build (`npm run build`)?
- [ ] Atualiza README quando necessário?

## Checklist para novas features

- [ ] Usa o `seed` global?
- [ ] Respeita `PLANET_RADIUS` / `VOXEL_SIZE`?
- [ ] Não quebra o lazy-load?
- [ ] Não cria re-render desnecessário?
- [ ] Não quebra controles/câmera?
- [ ] Seguiu padrões de nomenclatura?
- [ ] Documentou mudanças no README?
