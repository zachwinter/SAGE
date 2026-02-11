import { read, write, bash, edit } from './tools.js';
import { confirm, input } from './util.js';

export async function runActLoop({ chat, aol, model, guarded }) {
  const stats = {
    tokens: 0,
    rounds: 0
  }

  const handlers = {
    onPromptProcessingProgress(index, progress) {
      aol.commit('PREFILL_PROGRESS', { index, progress })
    },
    onFirstToken(index) {
      aol.commit('PREDICTION_START', { index })
      stats.rounds = index
    },
    onToolCallRequestStart(index, id, info) {
      aol.commit('TOOL_CALL_REQUEST_START', { index, id, info })
    },
    onToolCallRequestNameReceived(index, id, name) {
      aol.commit('TOOL_CALL_REQUEST_NAME_RECEIVED', { index, id, name })
    },
    onToolCallRequestEnd(index, id, info) {
      aol.commit('TOOL_CALL_REQUEST_END', { index, id, info })
    },
    onToolCallRequestFailure(index, id, info) {
      aol.commit('TOOL_CALL_REQUEST_FAILURE', { index, id, info })
    },
    onToolCallRequestArgumentFragmentGenerated(index, id, content) {
      aol.commit('TOOL_CALL_REQUEST_FRAGMENT', { index, id, content })
      stats.tokens++
    },
    onMessage(message) {
      aol.commit('AGENT_MESSAGE', { ...message.data, stats });
      chat.append(message)
    },
    onPredictionFragment(token) {
      aol.commit('PREDICTION_FRAGMENT', token)
      stats.tokens++
    }
  }

  if (guarded) {
    handlers.guardToolCall = async (index, id, ctx) => {
      aol.commit('TOOL_CALL_REQUESTED', { index, id, ctx })

      if (await confirm()) {
        ctx.allow()
      } else {
        ctx.deny(await input('Reason? '))
      }
    }
  }

  try {
    await model.act(chat, [read, write, bash, edit], handlers);
  } catch (error) {
    aol.commit('ACT_LOOP_ERROR', {
      message: error.message,
      trace: console.trace(error)
    })
  }

  return stats
}