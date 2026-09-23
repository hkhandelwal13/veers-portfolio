import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function setup({ blocked = false } = {}) {
  const window = new EventTarget()
  const pending = []
  const elements = []
  class Audio extends EventTarget {
    paused = true
    muted = false
    networkState = 1
    // Safari/iOS can ignore volume assignments. Muting must not depend on them.
    get volume() { return 1 }
    set volume(_) {}
    constructor() { super(); elements.push(this) }
    pause() { this.paused = true; this.dispatchEvent(new Event('pause')) }
    play() {
      if (blocked) return Promise.reject(new Error('NotAllowedError'))
      this.paused = false
      this.dispatchEvent(new Event('play'))
      return new Promise(resolve => pending.push(resolve))
    }
  }
  window.setInterval = setInterval
  const context = {
    exports: {}, window, document: new EventTarget(), Audio,
    Element: class {}, HTMLMediaElement: { NETWORK_EMPTY: 0 },
    clearInterval, process: { env: { NODE_ENV: 'production' } },
  }
  const source = ts.transpileModule(fs.readFileSync('lib/site-audio.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  vm.runInNewContext(source, context)
  return { api: context.exports, window, get element() { return elements[0] }, pending,
    allow: () => { blocked = false } }
}
const flush = () => new Promise(resolve => setImmediate(resolve))

test('enabled on a fresh page; mobile mute pauses despite immutable volume and pending play', async () => {
  const env = setup()
  const { api } = env
  assert.equal(api.getAudioState().enabled, true)
  api.startAudio()
  api.toggleAudio()
  assert.equal(env.element.paused, true)
  assert.equal(env.element.muted, true)
  env.pending.splice(0).forEach(resolve => resolve())
  await flush()
  assert.equal(env.element.paused, true)
  assert.equal(api.getAudioState().enabled, false)
  api.startAudio() // A scroll retry must respect mute.
  assert.equal(env.element.paused, true)
  api.toggleAudio()
  assert.equal(env.element.muted, false)
  assert.equal(env.element.paused, false)
  api.resetSiteAudio()
  assert.equal(api.getAudioState().enabled, true)
})

test('autoplay refusal retries on a gesture and never overrides a later mute', async () => {
  const env = setup({ blocked: true })
  env.api.startAudio()
  await flush()
  assert.equal(env.api.getAudioState().waitingForGesture, true)
  env.allow()
  env.window.dispatchEvent(new Event('touchend'))
  env.api.setAudioEnabled(false)
  env.pending.splice(0).forEach(resolve => resolve())
  await flush()
  env.window.dispatchEvent(new Event('pointerdown'))
  assert.equal(env.element.paused, true)
  assert.equal(env.api.getAudioState().waitingForGesture, false)
  env.api.resetSiteAudio()
})

test('video ducking pauses immediately and releasing it respects the sound preference', () => {
  const env = setup()
  env.api.startAudio()
  env.api.duckAudio('video')
  assert.equal(env.element.paused, true)
  env.api.setAudioEnabled(false)
  env.api.unduckAudio('video')
  assert.equal(env.element.paused, true)
  env.api.resetSiteAudio()
})
