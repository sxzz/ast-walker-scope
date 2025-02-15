import { walkAST as estreeWalk, isFunctionType } from 'ast-kit'
import {
  babelParse,
  isNewScope,
  walkFunctionParams,
  walkNewIdentifier,
  walkVariableDeclaration,
} from './utils/babel'
import type {
  ParseOptions,
  Scope,
  ScopeContext,
  WalkerContext,
  WalkerHooks,
} from './types'
import type { ParseResult } from '@babel/parser'
import type { File, Identifier, Node } from '@babel/types'

export * from './types'
export * from './utils/babel'

export function walk(
  code: string,
  walkHooks: WalkerHooks,
  { filename, parserPlugins }: ParseOptions = {},
): ParseResult<File> {
  const ast = babelParse(code, filename, parserPlugins)
  walkAST(ast.program, walkHooks)

  return ast
}

export function walkAST(
  node: Node | Node[],
  { enter, leave, enterAfter, leaveAfter }: WalkerHooks,
): void {
  let currentScope: Scope = {}
  const scopeStack: Scope[] = [currentScope]

  const ast: Node = Array.isArray(node)
    ? ({ type: 'Program', body: node } as any)
    : node
  estreeWalk(ast, {
    enter(node, parent, ...args) {
      const { scopeCtx, walkerCtx, isSkip, isRemoved, getNode } =
        getHookContext(this, node, [parent, ...args])

      enter?.call({ ...scopeCtx(), ...walkerCtx }, node)
      node = getNode()

      if (!isSkip() && !isRemoved()) {
        enterNode(node, parent)
        enterAfter?.call(scopeCtx(), node)
      }
    },

    leave(this, node, parent, ...args) {
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
    [parent, key, index]: [
      Node | undefined | null,
      string | undefined | null,
      number | undefined | null,
    ],
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

  function enterNode(node: Node, parent: Node | undefined | null) {
    if (
      isNewScope(node) ||
      (node.type === 'BlockStatement' && !isNewScope(parent))
    )
      scopeStack.push((currentScope = {}))

    if (isFunctionType(node)) {
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
          walkVariableDeclaration(stmt, registerBinding)
        } else if (stmt.type === 'FunctionDeclaration' && stmt.id) {
          registerBinding(stmt.id)
        }
      }
    }
  }

  function leaveNode(node: Node, parent: Node | undefined | null) {
    if (
      isNewScope(node) ||
      (node.type === 'BlockStatement' && !isNewScope(parent))
    ) {
      scopeStack.pop()
      currentScope = scopeStack.at(-1)!
    }
    walkNewIdentifier(node, registerBinding)
  }

  function registerBinding(id: Identifier) {
    if (currentScope) {
      currentScope[id.name] = id
    } else {
      error(
        'registerBinding called without active scope, something is wrong.',
        id,
      )
    }
  }

  function error(msg: string, node: Node) {
    const e = new Error(msg)
    ;(e as any).node = node
    throw e
  }
}

export function getRootScope(nodes: Node[]): Scope {
  const scope: Scope = {}
  for (const node of nodes) {
    walkNewIdentifier(node, (id) => {
      scope[id.name] = id
    })
  }
  return scope
}
