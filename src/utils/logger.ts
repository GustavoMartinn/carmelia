import pc from 'picocolors'

export const logger = {
  info(msg: string) {
    console.log(pc.blue('ℹ'), msg)
  },

  success(msg: string) {
    console.log(pc.green('✓'), msg)
  },

  warn(msg: string) {
    console.log(pc.yellow('⚠'), msg)
  },

  error(msg: string) {
    console.error(pc.red('✗'), msg)
  },

  dim(msg: string) {
    console.log(pc.dim(msg))
  },

  heading(msg: string) {
    console.log(`\n${pc.bold(pc.cyan(msg))}`)
  },

  list(items: string[], indent = 2) {
    const pad = ' '.repeat(indent)
    for (const item of items) {
      console.log(`${pad}${pc.dim('•')} ${item}`)
    }
  },

  table(rows: Array<[string, string]>, indent = 2) {
    const pad = ' '.repeat(indent)
    const maxKey = Math.max(...rows.map(([k]) => k.length))
    for (const [key, value] of rows) {
      console.log(`${pad}${pc.bold(key.padEnd(maxKey))}  ${value}`)
    }
  },
}
