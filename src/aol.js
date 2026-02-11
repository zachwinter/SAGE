import { mkdirSync, appendFileSync, existsSync, createReadStream, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import os from 'os'
import process from 'process';

/**
 * @class AOL (Append-Only Log)
 * @reason We need a persistent, immutable log that's 1) token-by-token, and 2) bound to the CWD, always.
 * @todo: make this its own thing. 
 */
export class AOL {
  constructor() {
    const logPath = process.cwd() + '/.sage/events.json'
    mkdirSync(path.dirname(logPath), { recursive: true });
    this.events = [];
    this.logPath = logPath;
    this.buildState = this.buildState.bind(this)
    this.commit = this.commit.bind(this)
    this.reduce = this.reduce.bind(this)
    this.reduceSince = this.reduceSince.bind(this)
    this.pipe = this.pipe.bind(this)
    this.toFile = this.toFile.bind(this)
    this.eventsOfType = this.eventsOfType.bind(this)
    this.buildStatePromise = this.buildState()
  }

  async buildState() {
    if (!existsSync(this.logPath)) return this.events;
    const readStream = createReadStream(this.logPath);
    const rl = createInterface({ input: readStream });
    for await (const line of rl) {
      if (line.trim()) {
        try {
          const event = JSON.parse(line);
          this.events.push(event);
        } catch (e) {
          // console.warn('Failed to parse event:', line, e.message);
        }
      }
    }
    return this.events;
  }

  async ready() {
    return this.buildStatePromise;
  }

  set renderer(val) {
    this._renderer = val
  }

  async commit(type, data) {
    const event = {
      type,
      data,
      ts: new Date().toISOString(),
      user: os.userInfo(),
      channel: process.cwd()
    };
    appendFileSync(this.logPath, JSON.stringify(event) + '\n');
    this.events.push(event);
    if (this._renderer) await this._renderer(event)
    return event;
  }

  reduce(initialState, reducer) {
    let state = initialState;
    for (const event of this.events) state = reducer(state, event);
    return state;
  }

  reduceSince(timestamp, initialState, reducer) {
    const filtered = this.events.filter(e => e.ts > timestamp);
    return this.reduce(initialState, (state, event) => {
      if (event.ts > timestamp) return reducer(state, event);
      return state;
    });
  }

  async pipe(...reducers) {
    let state = {};
    for (const reducer of reducers) state = await this.reduce(state, reducer);
    return state;
  }

  toFile(filePath) {
    const content = JSON.stringify(this.events, null, 2);
    writeFileSync(filePath, content);
    return content;
  }

  eventsOfType(type) {
    return this.events.filter(e => e.type === type).map(v => v.data);
  }

  useRenderer(rndr = null) {
    this._renderer = this._renderer ?? rndr ?? null
    if (!this._renderer) return
    this.events.forEach(event => this._renderer(event))
  }
}
