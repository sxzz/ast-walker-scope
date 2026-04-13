import { expect, test } from 'vitest'
import { getRootScope, walkAST } from '../src'
import type { Node } from '@babel/types'

// https://github.com/sxzz/ast-walker-scope/issues/90
test('#90 prototype pollution via __proto__ identifier', () => {
  const maliciousAST: Node = {
    type: 'VariableDeclaration',
    kind: 'let',
    declare: false,
    declarations: [
      {
        type: 'VariableDeclarator',
        id: { type: 'Identifier', name: '__proto__' } as any,
        init: { type: 'ObjectExpression', properties: [{} as any] } as any,
      },
    ],
  } as any

  const scope = getRootScope([maliciousAST])
  expect(({} as any).polluted).toBeUndefined()
  expect(Object.getPrototypeOf(scope)).toBeNull()

  expect(() => walkAST(maliciousAST, {})).not.toThrow()
  expect(({} as any).polluted).toBeUndefined()
})
