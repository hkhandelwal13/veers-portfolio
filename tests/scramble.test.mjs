import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

test('scramble paints its loading frame immediately and resolves to the original copy', () => {
  let tick
  const context = { exports: {}, setInterval: fn => { tick = fn; return 1 }, clearInterval: () => {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/scramble.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context)
  const text = 'Story first.\nEvery frame.'
  const element = { textContent: text }
  context.exports.scramble(element, text)
  assert.notEqual(element.textContent, text)
  assert.equal(element.textContent.length, text.length)
  assert.equal(element.textContent[5], ' ')
  assert.equal(element.textContent[12], '\n')
  for (let i = 0; i < 30; i++) tick()
  assert.equal(element.textContent, text)
})
