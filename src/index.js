#!/usr/bin/env node

import { initialize, input, stdin } from './util.js';
import { runActLoop } from './agent.js';
import { config } from 'dotenv';

config()

const { aol, chat, model, state: { interactive, prompt } } = await initialize();

const step = async () => {
  const text = interactive ? await input(prompt) : await stdin()

  if (!text || !text?.length) process.exit(0)

  aol.commit('USER_MESSAGE', { role: 'user', content: [{ type: 'text', text }] })
  chat.append('user', text)

  const output = await runActLoop({ aol, chat, model, guarded: interactive })

  if (!interactive) {
    console.error(JSON.stringify(output))
    process.exit(0);
  } else {
    await step()
  }
}

try {
  await step()
} catch (e) {
  process.exit(1)
}