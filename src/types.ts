import { type ParserPlugin } from '@babel/parser'
import { type Node } from '@babel/types'

export interface ParseOptions {
  filename?: string
  parserPlugins?: ParserPlugin[]
}

export type Scope = Record<string, Node>

export interface WalkerContext {
  skip: () => void
  remove: () => void
  replace: (node: Node) => void
}

export interface ScopeContext {
  parent: Node | undefined | null
  key: string | undefined | null
  index: number | undefined | null

  scope: Scope
  scopes: Scope[]
  level: number
}

export interface WalkerHooks {
  enter?: (this: WalkerContext & ScopeContext, node: Node) => void
  enterAfter?: (this: ScopeContext, node: Node) => void
  leave?: (this: WalkerContext & ScopeContext, node: Node) => void
  leaveAfter?: (this: ScopeContext, node: Node) => void
}
