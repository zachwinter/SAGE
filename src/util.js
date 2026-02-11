#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface, emitKeypressEvents } from 'node:readline'
import os from 'node:os'
import ora from 'ora';
import { Chat, LMStudioClient } from "@lmstudio/sdk";
import { AOL } from './aol.js';
import renderer from './renderer.js'

const model = process.env.MODEL ?? "qwen-3-coder-next"
const user = os.userInfo()
const cwd = process.cwd()
const interactive = !process.argv.includes('--json')
const newline_literal = `
`

const initialState = {
  model,
  user,
  channel: cwd,
  turn: 'user',
  interactive,
  abortController: null,
  prompt: ``
}

async function loadModel(m) {
  const client = new LMStudioClient();
  const model = await asyncTask(`loading ${m}`, client.llm.model(m, {
    verbose: false,
    onProgress(p) { }
  }))
  return model
}

export async function initialize(state = initialState) {
  if (state.interactive) emitKeypressEvents(process.stdin);
  const model = await loadModel(state.model)
  const aol = new AOL(); // always cwd
  await aol.ready();
  aol.useRenderer((evt) => renderer(evt, !state.interactive));
  const messages = aol.eventsOfType('USER_MESSAGE').concat(aol.eventsOfType('AGENT_MESSAGE'))
  const chat = Chat.from({ messages });

  return {
    aol,
    messages,
    chat,
    model,
    state
  }
}

export const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function asyncTask(text, promise, c = {}) {
  const prefixText = c?.prefixText ?? ''
  const color = c?.color ?? 'magenta'
  const spin = ora({ ...{ prefixText, text, color }, ...{ ...(c ?? {}) } })
  return new Promise(async (resolve, reject) => {
    try {
      spin.start()
      resolve(await (typeof promise === 'function' ? promise() : promise))
    } catch (e) {
      reject(e)
    } finally {
      spin.stop()
    }
  })
}

export async function call(cmd, args = []) {
  process.stdout.write(newline_literal)
  const child = spawn(cmd, args, {
    stdio: ['inherit', 'pipe', 'inherit']
  });

  let output = '';

  child.stdout.on('data', (data) => {
    const text = data.toString();
    process.stdout.write(text);
    output += text;
  });

  const [code] = await once(child, 'close');
  return { output, code };
}

export async function confirm(message = 'Are you sure?') {
  const { code } = await call('gum', ['confirm', message])
  return code === 0
}

export async function input(prompt = 'Enter input:') {
  const result = await call('gum', ['write', '--placeholder', prompt]);
  return result.output
}

export async function stdin() {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', chunk => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      try {
        const parsed = JSON.parse(data.trim())
        resolve(parsed?.content ?? parsed?.text ?? parsed);
      } catch (e) {
        resolve(data.trim())
      }
    });

    process.stdin.on('error', reject);
  });
}

export async function readline(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write('\n'); // necessary; agent messages disappear without it
  return new Promise(resolve => rl.question(prompt, resolve));
}

process.on('SIGINT', () => {
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.exit(0);
});

process.on('exit', () => process.stdin.isRaw ? (() => {
  process.stdin.setRawMode(false);
  process.stdin.pause()
  console.clear()
})() : console.clear())
