import { parse } from '@babel/parser'
import { walk } from 'estree-walker'
import {
  extractIdentifiers,
  isFunctionType,
  walkFunctionParams,
} from './utils/babel'
import type {
  HookContext,
  ParseOptions,
  Scope,
  WalkerContext,
  WalkerHooks,
} from './types'
import type {
  Identifier,
  Node,
  Program,
  VariableDeclaration,
} from '@babel/types'
import type { ParserPlugin } from '@babel/parser'

const ADVANCED_SCOPE: Node['type'][] = [
  'CatchClause',
  'ForInStatement',
  'ForOfStatement',
]

export const walkSource = (
  code: string,
  walkHooks: WalkerHooks,
  { filename, parserPlugins }: ParseOptions = {}
) => {
  const plugins: ParserPlugin[] = parserPlugins || []
  if (filename) {
    if (/\.tsx?$/.test(filename)) plugins.push('typescript')
    if (filename.endsWith('x')) plugins.push('jsx')
  }

  const ast = parse(code, {
    sourceType: 'module',
    plugins,
  })

  walkAST(ast.program, walkHooks)

  return { ast }
}

export const walkAST = (ast: Program, { enter, leave }: WalkerHooks) => {
  let currentScope: Scope = {}
  const scopeStack: Scope[] = [currentScope]

  walk(ast, {
    enter(this: WalkerContext, node: Node, parent, ...args) {
      enterNode(node, parent)
      enter?.call(getHookContext(this, [parent, ...args]), node)
    },

    leave(this: WalkerContext, node, parent, ...args) {
      leaveNode(node, parent)

      leave?.call(getHookContext(this, [parent, ...args]), node)
    },
  })

  function getHookContext(
    ctx: WalkerContext,
    [parent, key, index]: [Node, string, number]
  ): HookContext {
    const scope = scopeStack.reduce((prev, curr) => ({ ...prev, ...curr }), {})
    return {
      ...ctx,
      parent,
      key,
      index,

      scope,
      scopes: scopeStack,
      level: scopeStack.length,
    }
  }

  function enterNode(node: Node, parent: Node) {
    if (isFunctionType(node)) {
      scopeStack.push((currentScope = {}))
      walkFunctionParams(node, registerBinding)
    } else if (node.type === 'CatchClause') {
      // catch param
      scopeStack.push((currentScope = {}))
      if (node.param && node.param.type === 'Identifier')
        registerBinding(node.param)
      return
    } else if (
      node.type === 'ForOfStatement' ||
      node.type === 'ForInStatement'
    ) {
      scopeStack.push((currentScope = {}))
    } else if (
      node.type === 'BlockStatement' &&
      !isFunctionType(parent) &&
      !ADVANCED_SCOPE.includes(parent.type)
    ) {
      scopeStack.push((currentScope = {}))
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function leaveNode(node: Node, _parent: Node) {
    if (node.type === 'BlockStatement') {
      scopeStack.pop()
      currentScope = scopeStack[scopeStack.length - 1]
    } else if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'ClassDeclaration'
    ) {
      if (node.declare || !node.id) return
      registerBinding(node.id)
    } else if (node.type === 'VariableDeclaration') {
      walkVariableDeclaration(node)
    } else if (
      node.type === 'ExportNamedDeclaration' &&
      node.declaration &&
      node.declaration.type === 'VariableDeclaration'
    ) {
      walkVariableDeclaration(node.declaration)
    }
  }

  function walkVariableDeclaration(stmt: VariableDeclaration) {
    if (stmt.declare) return

    for (const decl of stmt.declarations) {
      for (const id of extractIdentifiers(decl.id)) {
        registerBinding(id)
      }
    }
  }

  function registerBinding(id: Identifier) {
    if (currentScope) {
      currentScope[id.name] = id
    } else {
      error(
        'registerBinding called without active scope, something is wrong.',
        id
      )
    }
  }

  function error(msg: string, node: Node) {
    const e = new Error(msg)
    ;(e as any).node = node
    throw e
  }
}
