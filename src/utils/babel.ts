import { isFunction } from '@babel/types'
import type { Function, Identifier, Node } from '@babel/types'

const NEW_SCOPE: Node['type'][] = [
  'CatchClause',
  'ForInStatement',
  'ForOfStatement',
]

export const isNewScope = (node: Node) =>
  NEW_SCOPE.includes(node.type) || isFunction(node)

export function walkFunctionParams(
  node: Function,
  onIdent: (id: Identifier) => void
) {
  for (const p of node.params) {
    for (const id of extractIdentifiers(p)) {
      onIdent(id)
    }
  }
}

export function extractIdentifiers(
  param: Node,
  nodes: Identifier[] = []
): Identifier[] {
  switch (param.type) {
    case 'Identifier':
      nodes.push(param)
      break

    case 'MemberExpression': {
      let object: any = param
      while (object.type === 'MemberExpression') {
        object = object.object
      }
      nodes.push(object)
      break
    }

    case 'ObjectPattern':
      for (const prop of param.properties) {
        if (prop.type === 'RestElement') {
          extractIdentifiers(prop.argument, nodes)
        } else {
          extractIdentifiers(prop.value, nodes)
        }
      }
      break

    case 'ArrayPattern':
      param.elements.forEach((element) => {
        if (element) extractIdentifiers(element, nodes)
      })
      break

    case 'RestElement':
      extractIdentifiers(param.argument, nodes)
      break

    case 'AssignmentPattern':
      extractIdentifiers(param.left, nodes)
      break
  }

  return nodes
}
