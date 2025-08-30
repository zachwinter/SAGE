// Node.js crypto support
let nodeCrypto: typeof import('crypto') | undefined;
try {
  nodeCrypto = require('crypto');
} catch {
  // Browser environment or crypto not available
}

export async function sha256(input: string | Uint8Array): Promise<string> {
  // Convert string to Uint8Array if needed
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  
  // Try Node.js crypto first
  if (nodeCrypto) {
    const hash = nodeCrypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }
  
  // Fallback to Web Crypto API (browser)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  throw new Error('No SHA-256 implementation available. Node.js crypto or Web Crypto API required.');
}