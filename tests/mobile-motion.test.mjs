import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(path, globals = {}) {
  const context = { exports: {}, ...globals }
  const { outputText } = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  vm.runInNewContext(outputText, context)
  return context.exports
}

test('touch scrolling never drives model parallax; mouse still does', () => {
  const window = new EventTarget()
  Object.assign(window, { innerWidth: 390, innerHeight: 844 })
  const api = load('lib/pointer-bus.ts', { window, document: new EventTarget() })
  const detach = api.attachPointerBus()
  const move = (pointerType) => {
    const event = new Event('pointermove')
    Object.assign(event, { pointerType, clientX: 380, clientY: 800 })
    window.dispatchEvent(event)
    api.commitPointerBus(1 / 60)
  }
  move('touch')
  assert.equal(api.pointer.cx, 0)
  assert.equal(api.pointer.cy, 0)
  assert.equal(api.pointer.inside, false)
  move('mouse')
  assert.ok(api.pointer.cx > 0)
  assert.equal(api.pointer.inside, true)
  move('touch')
  assert.equal(api.pointer.inside, false)
  assert.equal(api.pointerRaw.x, 0.5)
  detach()
})

test('mobile and tablet retain curl; reduced motion disables it', () => {
  const api = load('lib/capabilities.ts')
  for (const compact of [true, false]) {
    const caps = { compact, stacked: true, hoverCapable: false, reducedMotion: false }
    assert.equal(api.canCurlOnScroll(caps), true)
    assert.equal(api.canRenderGlass(), true)
    assert.equal(api.canRenderStarFlare(caps), false)
    assert.equal(api.canCurlOnScroll({ ...caps, reducedMotion: true }), false)
  }
})

test('portrait fallback readiness is scoped to its registered element and cleans up', () => {
  const api = load('lib/rect-sampler.ts')
  const first = { dataset: {} }, second = { dataset: {} }
  const unregister = api.registerTarget('editor-face', first)
  api.setTargetMirrorReady('editor-face', true)
  assert.equal(first.dataset.mirrorReady, 'true')
  api.registerTarget('editor-face', second)
  unregister()
  api.setTargetMirrorReady('editor-face', true)
  assert.equal(second.dataset.mirrorReady, 'true')
  api.setTargetMirrorReady('editor-face', false)
  assert.equal(second.dataset.mirrorReady, undefined)
})

test('portrait/card coordinates stay aligned across phone, tablet and desktop canvases', () => {
  const api = load('components/webgl/rect-space.ts')
  for (const [width, height] of [[390, 844], [844, 390], [768, 1024], [1440, 900]]) {
    const rect = { x: 20, y: 115.25, width: width - 40, height: 180, valid: true }
    let result
    api.rectToUniform(rect, width, height, { set: (...values) => { result = values } })
    assert.ok(Math.abs((1 - result[1] - result[3]) * height - rect.y) < 1e-9)
    assert.ok(Math.abs(result[0] * width - rect.x) < 1e-9)
    const camera = { position: { x: 0, y: 0, z: 6 }, fov: 35 }
    const seat = api.rectToWorld(rect, camera, width, height)
    assert.ok(Math.abs(height / 2 - seat.y / seat.unitsPerPixel - (rect.y + rect.height / 2)) < 1e-9)
  }
})
