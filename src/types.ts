import type { ParserPlugin } from '@babel/parser'
import type { Node } from '@babel/types'

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

export interface HookContext extends WalkerContext {
  parent: Node
  key: string
  index: number

  scope: Scope
  scopes: Scope[]
  level: number
}

export interface WalkerHooks {
  enter?: (this: HookContext, node: Node) => void
  leave?: (this: HookContext, node: Node) => void
}
