# 3D starter — Veerlabs

Optimized models + generated R3F components. Drop into the Next.js repo:

- `public/models/hello.glb`  (411 KB, was 11.9 MB) — hero "hello" word
- `public/models/arrow.glb`  (8.5 KB) — UI / scroll-cue arrow
- `components/webgl/Hello.tsx`, `Arrow.tsx` — typed R3F components

## Notes
- Models were optimized with gltf-transform (meshopt compression).
- Components are single-mesh; paths already point to `/models/*.glb`.
- `Hello` currently uses its baked `water_material3`. For the haoqi glass look,
  swap that mesh's material for drei `MeshTransmissionMaterial` (or a custom GLSL
  glass shader) — the geometry stays as-is.
- `position` / `scale` are the model's authored transform; override via props
  (`<Hello scale={...} position={...} />`) when composing the hero.
- Requires: `three`, `@react-three/fiber`, `@react-three/drei`.
