import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(path, require = () => ({})) {
  const context = { exports: {}, require }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context)
  return context.exports
}

test('touch poster previews on first tap and opens on second tap', () => {
  const touch = load('lib/poster-touch.ts').createPosterTouchIntent()
  touch.start(100, 200, 300)
  assert.equal(touch.tap(300), 'preview')
  touch.start(100, 200, 300)
  assert.equal(touch.tap(300), 'open')
})

test('scrolling, dragging and cancelled gestures cannot reveal or open a poster', () => {
  const touch = load('lib/poster-touch.ts').createPosterTouchIntent()
  assert.equal(touch.tap(300), 'ignore')
  touch.start(100, 200, 300)
  touch.move(100, 225)
  assert.equal(touch.tap(300), 'ignore')
  touch.start(100, 200, 300)
  assert.equal(touch.tap(320), 'ignore')
  touch.start(100, 200, 300)
  touch.cancel()
  assert.equal(touch.tap(300), 'ignore')
})

test('scroll or outside-touch dismissal requires a new first tap', () => {
  const touch = load('lib/poster-touch.ts').createPosterTouchIntent()
  touch.start(100, 200, 300)
  assert.equal(touch.tap(300), 'preview')
  touch.reset()
  touch.start(100, 200, 400)
  assert.equal(touch.tap(400), 'preview')
})

test('touch uses the shared frame loop, with native reduced-motion fallback', () => {
  const api = load('lib/lenis.ts')
  assert.equal(api.lenisOptions(false).autoRaf, false)
  assert.equal(api.lenisOptions(false).syncTouch, true)
  assert.equal(api.lenisOptions(false).touchMultiplier, 1)
  assert.equal(api.lenisOptions(true).syncTouch, false)
  assert.equal(api.lenisOptions(true).smoothWheel, false)
})
