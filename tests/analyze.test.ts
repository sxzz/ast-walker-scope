import { describe, expect, test } from 'vitest'
import {
  isCallExpression,
  isDeclaration,
  isExportNamedDeclaration,
} from '@babel/types'
import MagicString from 'magic-string'
import { walk } from '../src'
import type { Node } from '@babel/types'
import type { HookContext, Scope, WalkerHooks } from '../src'

function stringifyScope(scope: Scope) {
  return `{\n   | > ${Object.entries(scope)
    .map(
      ([key, node]) =>
        `${key}: ${
          node?.loc?.start
            ? `${node?.loc?.start.line}, ${node?.loc?.start.column}`
            : undefined
        }`
    )
    .join('\n   | > ')}\n   | }`
}

function prependLineNumber(code: string, s: MagicString) {
  let idx = 0
  for (const [lineNumber, line] of code.split('\n').entries()) {
    s.prependLeft(idx, `${String(lineNumber + 1).padStart(2)} | `)
    idx += line.length + 1
  }
}

function output(s: MagicString, node: Node, ctx: HookContext) {
  s.appendLeft(
    node.end!,
    `/* LEVEL: ${ctx.scopes.length} \n   | > ${stringifyScope(ctx.scope)} */`
  )
}

describe('analyze', async () => {
  const fixtures = import.meta.glob('./fixtures/*.{ts,js}', {
    eager: true,
    as: 'raw',
  })

  for (const [filename, content] of Object.entries(fixtures)) {
    test(filename, () => {
      const s = new MagicString(content)
      prependLineNumber(content, s)

      const hooks: WalkerHooks = {
        leave(node) {
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
