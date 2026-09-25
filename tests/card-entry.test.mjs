import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const context = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/card-entry.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, context)
const { cardEntryProgress, mobilePreviewTarget } = context.exports

test('entry develops symmetrically from bottom and top, including partial visibility', () => {
  for (const height of [640, 844, 1024]) {
    for (const visible of [0, 20, 60, 100, 200, 240]) {
      assert.equal(cardEntryProgress(height - visible, 240, height), cardEntryProgress(visible - 240, 240, height))
    }
    assert.equal(cardEntryProgress(height + 1, 240, height), 0)
    assert.equal(cardEntryProgress(-241, 240, height), 0)
    assert.equal(cardEntryProgress(height / 2 - 120, 240, height), 1)
    assert.ok(cardEntryProgress(height - 20, 240, height) < 0.2)
  }
})

test('mobile preview opens in the center band and stops beyond it', () => {
  assert.equal(mobilePreviewTarget(300, 200, 800), true)
  assert.equal(mobilePreviewTarget(750, 200, 800), false)
  assert.equal(mobilePreviewTarget(-150, 200, 800), false)
})


test('cold posters wait for decode, develop visibly, and reset for the return journey', () => {
  const { advanceCardDevelop: step } = context.exports
  assert.equal(step(0, 1, false, false, 1), 0)
  const firstFrame = step(0, 1, true, false, 1 / 60)
  assert.ok(firstFrame > 0 && firstFrame < 0.03)
  let value = firstFrame
  for (let i = 0; i < 60; i++) value = step(value, 1, true, false, 1 / 60)
  assert.equal(value, 1)
  assert.equal(step(value, 0.1, true, false, 1 / 60), 1)
  assert.equal(step(value, 0, true, false, 1 / 60), 0)
  assert.equal(step(0, 0.1, true, true, 1 / 60), 1)
})


test('portrait develops again after reversing a partial exit from either edge', () => {
  for (const edge of ['top', 'bottom']) {
    const effect = context.exports.createCardDevelop()
    const entryAt = visible => cardEntryProgress(edge === 'top' ? visible - 240 : 800 - visible, 240, 800)
    for (let i = 0; i < 60; i++) effect.update(1, true, false, 1 / 60)
    assert.equal(effect.update(entryAt(100), true, false, 1 / 60), 1)
    const returning = effect.update(entryAt(140), true, false, 1 / 60)
    assert.ok(returning < 0.05)
    for (let i = 0; i < 60; i++) effect.update(1, true, false, 1 / 60)
    assert.equal(effect.update(1, true, false, 1 / 60), 1)
  }
})
