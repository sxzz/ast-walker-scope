/* eslint-disable no-console */
import { walk } from './dist'

const code = `
const a = 'root level'

{
  const a = 'second level'
  let secondLevel = true
  console.log(a, secondLevel)
}

var err = undefined
try {
} catch (err) {
  console.log(err)
}

console.log(a)
`.trim()

walk(code, {
  leave(this, node) {
    if (node.type === 'CallExpression') {
      console.log(`\nLevel: ${this.level}`)
      for (const [name, node] of Object.entries(this.scope)) {
        console.log(
          `variable ${name} is located at line ${node.loc?.start.line}, column ${node.loc?.start.column}`,
        )
      }
    }
  },
})
