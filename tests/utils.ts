import type { Node } from '@babel/types'
import type { Scope, ScopeContext } from '../src'
import type MagicString from 'magic-string'

export function stringifyScope(scope: Scope) {
  return `{\n   | > ${Object.entries(scope)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, node]) =>
        `${key}: ${
          node?.loc?.start
            ? `${node?.loc?.start.line}, ${node?.loc?.start.column}`
            : undefined
        }`,
    )
    .join('\n   | > ')}\n   | }`
}

export function prependLineNumber(code: string, s: MagicString) {
  let idx = 0
  for (const [lineNumber, line] of code.split('\n').entries()) {
    s.prependLeft(idx, `${String(lineNumber + 1).padStart(2)} | `)
    idx += line.length + 1
  }
}

export function output(s: MagicString, node: Node, ctx: ScopeContext) {
  s.appendLeft(
    node.end!,
    `/* LEVEL: ${ctx.scopes.length} \n   | > ${stringifyScope(ctx.scope)} */`,
  )
}
