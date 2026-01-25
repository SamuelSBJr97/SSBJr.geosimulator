WebAssembly integration (how-to)

This project is a Three.js + React app. To optimize heavy interaction math with WebAssembly (WASM), follow these steps:

1) Choose a toolchain
- Rust (recommended): use `wasm-pack` or `wasm-bindgen` to build a `interaction.wasm` file.
- AssemblyScript: compile `.ts` to wasm using `asc`.

2) Example output path
- Place the compiled WASM binary at `public/wasm/interaction.wasm`.

3) Loader
- The project includes `src/wasm/loader.ts` which attempts to load `/wasm/interaction.wasm`.
- If not found, it falls back to a JS implementation.

4) Vite config
- `vite.config.ts` is configured to treat `.wasm` files as assets and target modern browsers.

5) Build
- To build the app (and include the WASM file), run:

```bash
npm run build
```

- To compile WASM (example AssemblyScript):

```bash
# install assemblyscript globally or as dev dep
npm install -g assemblyscript
# compile
asc src/wasm/interaction.ts -b public/wasm/interaction.wasm --optimize
```

6) Using WASM in code
- Import and call via the loader:

```ts
import { loadWasm } from './wasm/loader'
const mod = await loadWasm('/')
const val = mod.compute_interaction?.(ax, ay, az, bx, by, bz)
```

Notes
- For best performance on large datasets, implement tight loops in WASM and call with typed arrays.
- Use `--optimize` and `wasm-opt` where possible to reduce size and increase performance.
