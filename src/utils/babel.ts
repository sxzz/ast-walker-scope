import { type ParserPlugin, parse } from '@babel/parser'
import { isFunctionType } from 'ast-kit'
import type {
  Function,
  Identifier,
  Node,
  VariableDeclaration,
} from '@babel/types'

const NEW_SCOPE: Node['type'][] = [
  'CatchClause',
  'ForInStatement',
  'ForOfStatement',
]

export const isNewScope = (node: Node | undefined | null) =>
  (node && NEW_SCOPE.includes(node.type)) || isFunctionType(node)

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

export function babelParse(
  code: string,
  filename?: string,
  parserPlugins: ParserPlugin[] = []
) {
  const plugins: ParserPlugin[] = parserPlugins || []
  if (filename) {
    if (/\.tsx?$/.test(filename)) plugins.push('typescript')
    if (filename.endsWith('x')) plugins.push('jsx')
  }

  const ast = parse(code, {
    sourceType: 'module',
    plugins,
  })
  return ast
}

export function walkVariableDeclaration(
  stmt: VariableDeclaration,
  register: (id: Identifier) => void
) {
  if (stmt.declare) return

  for (const decl of stmt.declarations) {
    for (const id of extractIdentifiers(decl.id)) {
      register(id)
    }
  }
}

export function walkNewIdentifier(
  node: Node,
  register: (id: Identifier) => void
) {
  if (node.type === 'ExportNamedDeclaration' && node.declaration) {
    node = node.declaration
  }

  if (node.type === 'VariableDeclaration') {
    walkVariableDeclaration(node, register)
  } else if (
    node.type === 'FunctionDeclaration' ||
    node.type === 'ClassDeclaration'
  ) {
    if (node.declare || !node.id) return
    register(node.id)
  } else if (
    node.type === 'ExportNamedDeclaration' &&
    node.declaration &&
    node.declaration.type === 'VariableDeclaration'
  ) {
    walkVariableDeclaration(node.declaration, register)
  }
}
