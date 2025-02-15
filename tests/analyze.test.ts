/// <reference types="vite/client" />

import {
  isCallExpression,
  isDeclaration,
  isExportNamedDeclaration,
} from '@babel/types'
import MagicString from 'magic-string'
import { describe, expect, test } from 'vitest'
import { babelParse, getRootScope, walk, type WalkerHooks } from '../src'
import { output, prependLineNumber } from './utils'

describe('analyze', () => {
  const fixtures = import.meta.glob<string>('./fixtures/*.{ts,js}', {
    eager: true,
    query: '?raw',
    import: 'default',
  })

  for (const [filename, content] of Object.entries(fixtures)) {
    test(filename, () => {
      const s = new MagicString(content)
      prependLineNumber(content, s)

      const hooks: WalkerHooks = {
        leaveAfter(node) {
          if (
            (isDeclaration(node) || isCallExpression(node)) &&
            !isExportNamedDeclaration(node)
          ) {
            output(s, node, this)
          }
        },
      }
      walk(content, hooks, { filename })

      expect(s.toString()).toMatchSnapshot()
    })
  }
})

test('getRootScope', () => {
  const { program } = babelParse(`
    const a = 1
    const b = 2
    {
      const c = 3
    }
    function foo() { }
    class Clz { }
  `)
  const scope = getRootScope(program.body)
  expect(Object.keys(scope)).toMatchInlineSnapshot(`
    [
      "a",
      "b",
      "foo",
      "Clz",
    ]
  `)
})
