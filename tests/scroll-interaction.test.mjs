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

test('touch uses the shared frame loop, with native reduced-motion fallback', () => {
  const api = load('lib/lenis.ts')
  assert.equal(api.lenisOptions(false).autoRaf, false)
  assert.equal(api.lenisOptions(false).syncTouch, true)
  assert.equal(api.lenisOptions(false).touchMultiplier, 1)
  assert.equal(api.lenisOptions(true).syncTouch, false)
  assert.equal(api.lenisOptions(true).smoothWheel, false)
})
