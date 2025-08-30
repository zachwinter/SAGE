// src/stream-utils.ts
// Streaming utilities for backpressure handling and stream manipulation

/**
 * Creates an async queue for backpressure-friendly streaming with configurable buffer limits
 */
export class AsyncQueue<T> {
  private queue: T[] = [];
  private resolves: Array<(value: IteratorResult<T>) => void> = [];
  private rejectors: Array<(reason: any) => void> = [];
  private finished = false;
  private error: any = null;
  private readonly maxBufferSize: number;
  private droppedItems = 0;

  constructor(maxBufferSize = 1000) {
    this.maxBufferSize = maxBufferSize;
  }

  /**
   * Add a value to the queue with backpressure handling
   */
  push(value: T): boolean {
    if (this.finished) return false;
    
    if (this.resolves.length > 0) {
      const resolve = this.resolves.shift()!;
      resolve({ value, done: false });
      return true;
    } else {
      // Check buffer size limit
      if (this.queue.length >= this.maxBufferSize) {
        this.droppedItems++;
        return false; // Backpressure signal
      }
      
      this.queue.push(value);
      return true;
    }
  }

  /**
   * Signal that no more values will be added
   */
  finish(): void {
    if (this.finished) return;
    this.finished = true;
    
    // Resolve any pending next() calls with done
    while (this.resolves.length > 0) {
      const resolve = this.resolves.shift()!;
      resolve({ value: undefined as any, done: true });
    }
    
    // Reject any pending next() calls with error
    while (this.rejectors.length > 0) {
      const reject = this.rejectors.shift()!;
      reject(new Error("Stream finished"));
    }
  }

  /**
   * Signal an error and terminate the stream
   */
  fail(error: any): void {
    if (this.finished) return;
    this.finished = true;
    this.error = error;
    
    // Reject any pending next() calls with error
    while (this.rejectors.length > 0) {
      const reject = this.rejectors.shift()!;
      reject(error);
    }
    
    // Clear any pending resolvers
    this.resolves = [];
  }

  /**
   * Async iterator implementation
   */
  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        // If we already have an error, reject immediately
        if (this.error) {
          return Promise.reject(this.error);
        }
        
        // If we have values in the queue, return the next one
        if (this.queue.length > 0) {
          const value = this.queue.shift()!;
          return Promise.resolve({ value, done: false });
        }
        
        // If stream is finished, return done
        if (this.finished) {
          return Promise.resolve({ value: undefined as any, done: true });
        }
        
        // Otherwise, queue the resolve/reject for when we get a value
        return new Promise<IteratorResult<T>>((resolve, reject) => {
          this.resolves.push(resolve);
          this.rejectors.push(reject);
        });
      },
      return: (): Promise<IteratorResult<T>> => {
        this.finish();
        return Promise.resolve({ value: undefined as any, done: true });
      },
      throw: (error: any): Promise<IteratorResult<T>> => {
        this.fail(error);
        return Promise.reject(error);
      }
    };
  }

  /**
   * Get backpressure statistics
   */
  getStats(): { queueLength: number; droppedItems: number; maxBufferSize: number } {
    return {
      queueLength: this.queue.length,
      droppedItems: this.droppedItems,
      maxBufferSize: this.maxBufferSize
    };
  }

  /**
   * Check if the queue is experiencing backpressure
   */
  isBackpressured(): boolean {
    return this.queue.length >= this.maxBufferSize * 0.8; // 80% threshold
  }
}

/**
 * Utility to merge multiple async iterables into one
 */
export async function* mergeStreams<T>(...streams: Array<AsyncIterable<T>>): AsyncIterable<T> {
  // Convert streams to iterators
  const iterators = streams.map(stream => stream[Symbol.asyncIterator]());
  
  // Keep track of which iterators are still active
  const active = new Set(iterators);
  
  // Keep track of pending promises
  const promises = new Map();
  
  // Initialize promises for all iterators
  for (const iterator of active) {
    promises.set(iterator, iterator.next());
  }
  
  // Continue until all iterators are done
  while (active.size > 0) {
    // Wait for the first promise to resolve
    const promiseArray = Array.from(promises.values());
    const result = await Promise.race(promiseArray);
    
    // Find which iterator this result came from
    for (const [iterator, promise] of promises) {
      if (promise === promiseArray[promiseArray.indexOf(result)]) {
        // Remove the promise from tracking
        promises.delete(iterator);
        
        // Handle the result
        if (result.done) {
          // Iterator is finished
          active.delete(iterator);
        } else {
          // Yield the value
          yield result.value;
          
          // Schedule the next read from this iterator
          promises.set(iterator, iterator.next());
        }
        break;
      }
    }
  }
}

/**
 * Utility to transform a stream with a mapping function
 */
export async function* mapStream<T, U>(
  stream: AsyncIterable<T>,
  mapper: (value: T) => U | Promise<U>
): AsyncIterable<U> {
  for await (const value of stream) {
    yield await mapper(value);
  }
}

/**
 * Utility to filter a stream with a predicate function
 */
export async function* filterStream<T>(
  stream: AsyncIterable<T>,
  predicate: (value: T) => boolean | Promise<boolean>
): AsyncIterable<T> {
  for await (const value of stream) {
    if (await predicate(value)) {
      yield value;
    }
  }
}

/**
 * Add error boundary to a stream
 */
export async function* withErrorBoundary<T>(
  stream: AsyncIterable<T>,
  onError: (error: any) => T | null = () => null
): AsyncIterable<T> {
  try {
    for await (const value of stream) {
      yield value;
    }
  } catch (error) {
    const fallbackValue = onError(error);
    if (fallbackValue !== null) {
      yield fallbackValue;
    }
    // Otherwise, let the error propagate
    throw error;
  }
}

/**
 * Add timeout to stream processing
 */
export async function* withTimeout<T>(
  stream: AsyncIterable<T>,
  timeoutMs: number,
  onTimeout: () => T | null = () => null
): AsyncIterable<T> {
  const iterator = stream[Symbol.asyncIterator]();
  
  while (true) {
    const timeoutPromise = new Promise<IteratorResult<T>>((_, reject) => {
      setTimeout(() => reject(new Error(`Stream timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    
    const nextPromise = iterator.next();
    
    try {
      const result = await Promise.race([nextPromise, timeoutPromise]);
      
      if (result.done) {
        return;
      }
      
      yield result.value;
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        const fallbackValue = onTimeout();
        if (fallbackValue !== null) {
          yield fallbackValue;
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }
}

/**
 * Buffer stream events and emit in batches
 */
export async function* bufferStream<T>(
  stream: AsyncIterable<T>,
  batchSize: number,
  timeoutMs?: number
): AsyncIterable<T[]> {
  let buffer: T[] = [];
  let timeoutId: NodeJS.Timeout | null = null;
  const queue = new AsyncQueue<T[]>();

  const flushBuffer = () => {
    if (buffer.length > 0) {
      queue.push([...buffer]);
      buffer = [];
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const scheduleTimeout = () => {
    if (timeoutMs && !timeoutId) {
      timeoutId = setTimeout(flushBuffer, timeoutMs);
    }
  };

  // Process the stream
  (async () => {
    try {
      for await (const value of stream) {
        buffer.push(value);
        
        if (buffer.length >= batchSize) {
          flushBuffer();
        } else {
          scheduleTimeout();
        }
      }
      
      // Flush any remaining items
      flushBuffer();
      queue.finish();
    } catch (error) {
      queue.fail(error);
    }
  })();

  // Yield batches
  for await (const batch of queue) {
    yield batch;
  }
}