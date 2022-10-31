import { parse } from '@babel/parser'
import { walk as estreeWalk } from 'estree-walker'
import { isFunction } from '@babel/types'
import {
  extractIdentifiers,
  isNewScope,
  walkFunctionParams,
} from './utils/babel'
import type { Identifier, Node, VariableDeclaration } from '@babel/types'
import type {
  ParseOptions,
  Scope,
  ScopeContext,
  WalkerContext,
  WalkerHooks,
} from './types'
import type { ParserPlugin } from '@babel/parser'

export * from './types'
export * from './utils/babel'

export const walk = (
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

  return ast
}

export const walkAST = (
  node: Node | Node[],
  { enter, leave, enterAfter, leaveAfter }: WalkerHooks
) => {
  let currentScope: Scope = {}
  const scopeStack: Scope[] = [currentScope]

  const ast: Node = Array.isArray(node)
    ? ({ type: 'Program', body: node } as any)
    : node
  estreeWalk(ast, {
    enter(this: WalkerContext, node: Node, parent, ...args) {
      const { scopeCtx, walkerCtx, isSkip, isRemoved, getNode } =
        getHookContext(this, node, [parent, ...args])

      enter?.call({ ...scopeCtx(), ...walkerCtx }, node)
      node = getNode()

      if (!isSkip() && !isRemoved()) {
        enterNode(node, parent)
        enterAfter?.call(scopeCtx(), node)
      }
    },

    leave(this: WalkerContext, node, parent, ...args) {
      const { scopeCtx, walkerCtx, isSkip, isRemoved, getNode } =
        getHookContext(this, node, [parent, ...args])

      leave?.call({ ...scopeCtx(), ...walkerCtx }, node)
      node = getNode()

      if (!isSkip() && !isRemoved()) {
        leaveNode(node, parent)
        leaveAfter?.call(scopeCtx(), node)
      }
    },
  })

  function getHookContext(
    ctx: WalkerContext,
    node: Node,
    [parent, key, index]: [Node, string, number]
  ): {
    scopeCtx: () => ScopeContext
    walkerCtx: WalkerContext
    isSkip: () => boolean
    isRemoved: () => boolean
    getNode: () => Node
  } {
    const scopeCtx: () => ScopeContext = () => ({
      parent,
      key,
      index,

      scope: scopeStack.reduce((prev, curr) => ({ ...prev, ...curr }), {}),
      scopes: scopeStack,
      level: scopeStack.length,
    })

    let isSkip = false
    let isRemoved = false
    let newNode: Node = node
    const walkerCtx: WalkerContext = {
      skip() {
        isSkip = true
        ctx.skip()
      },
      replace(node) {
        newNode = node
      },
      remove() {
        isRemoved = true
      },
    }

    return {
      scopeCtx,
      walkerCtx,
      isSkip: () => isSkip,
      isRemoved: () => isRemoved,
      getNode: () => newNode,
    }
  }

  function enterNode(node: Node, parent: Node) {
    if (
      isNewScope(node) ||
      (node.type === 'BlockStatement' && !isNewScope(parent))
    )
      scopeStack.push((currentScope = {}))

    if (isFunction(node)) {
      walkFunctionParams(node, registerBinding)
    } else if (
      // catch param
      node.type === 'CatchClause' &&
      node.param &&
      node.param.type === 'Identifier'
    )
      registerBinding(node.param)

    // handle hoist
    if (node.type === 'BlockStatement' || node.type === 'Program') {
      for (const stmt of node.body) {
        if (stmt.type === 'VariableDeclaration' && stmt.kind === 'var') {
          walkVariableDeclaration(stmt)
        } else if (stmt.type === 'FunctionDeclaration' && stmt.id) {
          registerBinding(stmt.id)
        }
      }
    }
  }

  function leaveNode(node: Node, parent: Node) {
    if (
      isNewScope(node) ||
      (node.type === 'BlockStatement' && !isNewScope(parent))
    ) {
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
