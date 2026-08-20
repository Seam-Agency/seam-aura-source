# Seam Aura

[![CI](https://github.com/Seam-Agency/seam-aura-source/actions/workflows/ci.yml/badge.svg)](https://github.com/Seam-Agency/seam-aura-source/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-25272a.svg)](./LICENSE)

A source-backed WebGL edge-light and travelling distortion effect for React. Seam Aura preserves the production palette field, signed-distance border, radial pulse, source displacement, and blue-noise dither behind a focused component API. Bright source textures receive a restrained full-surface chromatic wash and a broad inked pulse flow, while dark sources retain the original emissive light.

The live demo uses Theme Sweep for its Paper/Nocturne transition. The complete next theme is applied once at the sweep midpoint, with immediate logical fallback for reduced motion or unavailable WebGL.

[**Live demo**](https://seam.tools/aura/)

## Install

```bash
npm install https://github.com/Seam-Agency/seam-aura-source/releases/latest/download/seam-aura.tgz
```

The public release tarball installs without registry credentials.

## Transparent overlay

Wrap ordinary React content to render the edge field and pulse as a transparent, pointer-safe layer.

```tsx
import { useState } from "react";
import { SeamAura } from "@seam-agency/seam-aura";
import "@seam-agency/seam-aura/styles.css";

export function Frame() {
  const [pulseKey, setPulseKey] = useState(0);

  return (
    <>
      <SeamAura pulseKey={pulseKey}>
        <main>Your content</main>
      </SeamAura>
      <button onClick={() => setPulseKey((value) => value + 1)}>
        Replay pulse
      </button>
    </>
  );
}
```

## Source-texture composition

Pass a canvas, image, video, bitmap, or frame through `source` to activate the full post-process path. The travelling pulse then bends the supplied pixels as it crosses from its origin.

```tsx
import { useLayoutEffect, useRef, useState } from "react";
import { SeamAura } from "@seam-agency/seam-aura";
import "@seam-agency/seam-aura/styles.css";

export function ProcessedCanvas() {
  const inputRef = useRef<HTMLCanvasElement>(null);
  const [input, setInput] = useState<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    if (!inputRef.current) return;
    setInput(inputRef.current);
  }, []);

  return (
    <SeamAura source={input}>
      <canvas ref={inputRef} width={1280} height={720} />
    </SeamAura>
  );
}
```

Canvas and video sources are uploaded on each rendered frame. Keep the input and component aspect ratios aligned for a one-to-one post-process. Cross-origin images must be CORS-readable by WebGL.

## Container layer

Use `SeamAuraContainer` as a decorative layer inside a button, link, card, or any other positioned surface. The parent keeps its native semantics and interaction while Aura inherits its bounds and corner radius. Give the parent a real background so only the edge light is visible over the surface.

```tsx
import { SeamAuraContainer } from "@seam-agency/seam-aura";

export function AuraButton() {
  return (
    <button className="aura-button" type="button">
      <SeamAuraContainer edgeWidth={18} intensity={1.35} />
      <span>Aura inside this button</span>
    </button>
  );
}
```

```css
.aura-button {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: var(--button-surface);
}

.aura-button > span:not(.seam-aura) {
  position: relative;
  z-index: 1;
}
```

The container layer renders a pointer-safe, `aria-hidden` `<span>`, so it is valid inside native interactive elements and never replaces their accessible content.

## API

### `SeamAura`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `active` | `boolean` | `true` | Softly enables or disables emitted light |
| `intensity` | `number` | `1` | Edge and pulse amount multiplier |
| `edgeWidth` | `number` | `50` | Requested inward edge width in CSS pixels |
| `colors` | four CSS colors | source palette | Rotating color field |
| `speed` | `number` | `1` | Color-field rotation multiplier |
| `pulseKey` | `string \| number` | — | Change to replay the travelling pulse |
| `pulseAngle` | `number` | `135` | Screen-space travel angle: 0° right, 90° down, 180° left, 270° up |
| `pulseOrigin` | `[number, number]` | — | Advanced normalized origin; overrides `pulseAngle` |
| `pulseDuration` | `number` | `2` | Pulse travel time in seconds |
| `source` | `TexImageSource \| null` | `null` | Optional pixels for full post-process composition |
| `flipSourceY` | `boolean` | `true` | Converts browser image orientation to WebGL UVs |
| `maxDpr` | `number` | `2` | Render-resolution ceiling |
| `mode` | `"absolute" \| "fixed" \| "container"` | `"absolute"` | Content, viewport, or positioned-parent coverage |
| `paused` | `boolean` | `false` | Freezes the current animation state |
| `respectReducedMotion` | `boolean` | `true` | Presents a stable completed state when requested |

All standard root attributes are forwarded. `contentClassName`, `canvasClassName`, and `canvasStyle` are available for integration-level styling. Prefer `SeamAuraContainer` over setting `mode="container"` directly so the decorative semantics stay consistent.

## Fidelity boundary

The WebGL path is a readable port of an authorized production shader: its four-color linear palette, signed-distance edge equations, pulse geometry, source displacement, and 128 × 128 blue-noise sampling are retained. React lifecycle management, DOM layering, directional origin mapping, edge-safe source sampling, light-surface contrast composition, transparent-pass alpha, controls, reduced motion, and the CSS-only fallback are integration code.

The fallback intentionally renders a static color edge instead of imitating the source-distortion pulse without WebGL.

## Development

```bash
npm install
npm run dev
```

Run the complete local quality gate:

```bash
npm run check
npm run test:browser
npm run smoke:consumer
npm pack --dry-run
```

`npm run build` produces the package in `dist/`. `npm run build:demo` produces the private demo artifact in `site-dist/`.

## Publishing

- Pull requests and pushes run type checks, unit tests, package builds, a consumer install, and a package dry run.
- Versioned releases attach both immutable and stable-name public tarballs; GitHub Packages can be enabled as an additional organization channel.
- Demo code, private assets, source maps, and development history are not included in this public source repository or its release tarball.

## License

[MIT](./LICENSE) © Seam Agency. Third-party and source notices are listed in [LICENSES.md](./LICENSES.md).
