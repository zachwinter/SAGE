import chalk from "chalk";

const state = {
  line: '',
  tokens: 0,
  map: new Map(),
  active: null,
  name: null,
  parameter: null
}

export default async function renderer({ type, data }, jsonMode = false) {
  if (jsonMode) return process.stdout.write(`${JSON.stringify({ type, data })}\n`)

  switch (type) {
    case 'USER_MESSAGE':
      newline()
      write(`${data.content?.[0]?.text}`)
      newline()
      state.tokens++
      break
    case 'PREDICTION_START':
      newline()
      break;
    case 'PREDICTION_FRAGMENT':
      write(data.content)
      state.tokens++
      state.line += data.token
      break
    case 'TOOL_CALL_REQUEST_START':
      state.map.set(data.id, data)
      state.active = data.id
      newline()
      break
    case 'AGENT_MESSAGE':
      data.content.forEach(v => {
        try {
          const parsed = JSON.parse(v?.[v.type] ?? v.content ?? v)
          const result = parsed?.result ?? parsed ?? v
          const success = parsed.success
          if (success) {
            header(`✓`)
          } else {
            header(`✕`)
          }

          process.stdout.write(chalk.dim(`${success ? `✓` : '✕ '} ${result.split('\n').length} lines\n`))
          newline()
        } catch (e) {

        }
      })
      break
    case 'TOOL_CALL_REQUEST_NAME_RECEIVED':
      if (data.name) write(`⎡ ${chalk.magenta(data.name)} ⎦ `)
      break
    case 'TOOL_CALL_REQUEST_FRAGMENT':
      state.tokens++;

      if (data.content.includes('<parameter=') || data.content === '_path') {
        newline()
      } else if (data.content.includes('</parameter>')) {
        newline()
      } else if (data.content === '>') {
        newline()
      } else if (data.content) {
        write(chalk.dim(data.content))
        state.line += data.content
      }

      break
    case 'TOOL_CALL_REQUESTED':
      newline()
      break
    case 'TOOL_APPROVED':
      write(header(`✓`, 'green'))
      break
    case 'TOOL_REJECTED':
      write(header('✕', 'red') + `\n${data.reason}`)
      break
    case 'TOOL_CALL_REQUEST_END':
      newline()
      break;
    case 'PREDICTION_END':
      newline()
      break;
  }
}

function newline() {
  if (state.line.length === 0) return
  state.line = ''
  write('\n')
}

function write(token) {
  process.stdout.write(`${token}`)
}

function header(str, color = 'dim') {
  return `\n⎡ ${chalk?.[color]?.(str)} ⎦ `
}