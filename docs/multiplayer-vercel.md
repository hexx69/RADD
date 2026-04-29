# RADD Multiplayer and Vercel Setup

RADD is a static Vercel app. Vercel can host the launcher, JavaScript, WASM, and data files, but it cannot run a long-lived Quake II dedicated server or a long-lived UDP/WebSocket bridge from this project.

## Architecture

Use three pieces:

1. RADD on Vercel: serves `public/`.
2. A Quake II dedicated server: runs outside Vercel.
3. An Emscripten WebSocket-to-POSIX proxy: runs outside Vercel and forwards browser socket calls to the dedicated server.

The launcher's Multiplayer panel collects:

- `WebSocket proxy`: the proxy URL, for example `wss://proxy.example.com:8080`.
- `Server address`: the Quake II server address that the engine receives through `+connect`, for example `q2.example.com:27910`.

## Rebuild the Engine for Live Browser Multiplayer

The committed engine bundle is good for local/demo play. For live multiplayer sockets, rebuild with the proxy socket flags:

```sh
emmake make GL4ES_PATH=/path/to/gl4es_pic WASM_PROXY_SOCKETS=yes
npm run sync:engine
npm run build
```

The Makefile adds the Emscripten proxy flags when `WASM_PROXY_SOCKETS=yes` is set.
These flags follow the official Emscripten networking guidance for full POSIX
socket proxying: https://emscripten.org/docs/porting/networking.html

## Deployment

```sh
npm install
npm run build
vercel link
vercel --prod
```

After deployment, open the Vercel URL and verify that `/engine/index.wasm` returns `content-type: application/wasm`.

## Game Data

Do not commit commercial or demo PAK files. RADD lets players provide their own PAK files in the browser. The demo helper downloads the original demo archive and extracts `pak0.pak` into browser memory/cache for that user.
