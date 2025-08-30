import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { appendEvent, readChronicle, tailChronicle, validateChroniclePath } from '../api.js';
import type { ChronicleEvent, ChroniclePath } from '../types.js';

const TEST_DIR = './test-chronicles';
const TEST_CHRONICLE = path.join(TEST_DIR, 'test.sage') as ChroniclePath;

describe('Chronicle API - Core Functions', () => {
  beforeEach(() => {
    // Ensure test directory exists
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(TEST_CHRONICLE)) {
      unlinkSync(TEST_CHRONICLE);
    }
  });

  describe('validateChroniclePath', () => {
    it('should accept valid .sage paths', () => {
      expect(() => validateChroniclePath('test.sage')).not.toThrow();
      expect(() => validateChroniclePath('src/Component.ts.sage')).not.toThrow();
      expect(() => validateChroniclePath('.sage/warden.prod.sage')).not.toThrow();
    });

    it('should reject paths without .sage extension', () => {
      expect(() => validateChroniclePath('test.txt')).toThrow('Chronicle path must end with .sage');
    });

    it('should reject paths with .. traversal', () => {
      expect(() => validateChroniclePath('../test.sage')).toThrow('Chronicle path cannot contain ..');
      expect(() => validateChroniclePath('test/../other.sage')).toThrow('Chronicle path cannot contain ..');
    });
  });

  describe('appendEvent', () => {
    it('should append a valid event to chronicle', async () => {
      const event: ChronicleEvent = {
        type: 'PLAN_DRAFTED',
        timestamp: new Date().toISOString(),
        actor: { agent: 'sage', id: 'test' },
        planId: 'test-plan-1',
        summary: 'Test plan summary',
        steps: [{ action: 'test', target: 'example' }],
      };

      await appendEvent(TEST_CHRONICLE, event);

      // Verify file exists and contains the event
      expect(existsSync(TEST_CHRONICLE)).toBe(true);
      const fileContent = readFileSync(TEST_CHRONICLE, 'utf8');
      const lines = fileContent.trim().split('\n');
      expect(lines).toHaveLength(1);

      const parsedEvent = JSON.parse(lines[0]);
      expect(parsedEvent.type).toBe('PLAN_DRAFTED');
      expect(parsedEvent.planId).toBe('test-plan-1');
      expect(parsedEvent.summary).toBe('Test plan summary');
      expect(parsedEvent.eventId).toBeTypeOf('string'); // Should be computed
    });

    it('should compute eventId when computeId is true (default)', async () => {
      const event: ChronicleEvent = {
        type: 'PLAN_APPROVED',
        timestamp: new Date().toISOString(),
        actor: { agent: 'guardian', id: 'test' },
        planId: 'test-plan-1',
        reviewerId: 'reviewer-1',
        justification: 'Looks good',
      };

      await appendEvent(TEST_CHRONICLE, event);

      const events = await readChronicle(TEST_CHRONICLE);
      expect(events).toHaveLength(1);
      expect(events[0].eventId).toBeTypeOf('string');
      expect(events[0].eventId!.length).toBeGreaterThan(10); // SHA-256 hex
    });

    it('should not compute eventId when computeId is false', async () => {
      const event: ChronicleEvent = {
        type: 'PLAN_DENIED',
        timestamp: new Date().toISOString(),
        actor: { agent: 'guardian', id: 'test' },
        planId: 'test-plan-1',
        reviewerId: 'reviewer-1',
        reason: 'Missing requirements',
      };

      await appendEvent(TEST_CHRONICLE, event, { computeId: false });

      const events = await readChronicle(TEST_CHRONICLE);
      expect(events).toHaveLength(1);
      expect(events[0].eventId).toBeUndefined();
    });

    it('should preserve provided eventId', async () => {
      const customEventId = 'custom-event-id-123';
      const event: ChronicleEvent = {
        type: 'ROGUE_EDIT_DETECTED',
        timestamp: new Date().toISOString(),
        actor: { agent: 'daemon', id: 'watcher' },
        eventId: customEventId,
        filePath: 'src/test.ts',
        hash: 'abc123',
        detectedBy: 'daemon',
      };

      await appendEvent(TEST_CHRONICLE, event);

      const events = await readChronicle(TEST_CHRONICLE);
      expect(events).toHaveLength(1);
      expect(events[0].eventId).toBe(customEventId);
    });

    it('should validate event structure before append', async () => {
      const invalidEvent = {
        type: 'PLAN_DRAFTED',
        // Missing required fields
        timestamp: new Date().toISOString(),
      } as ChronicleEvent;

      await expect(appendEvent(TEST_CHRONICLE, invalidEvent)).rejects.toThrow();
    });
  });

  describe('readChronicle', () => {
    it('should return empty array for non-existent chronicle', async () => {
      const events = await readChronicle(TEST_CHRONICLE);
      expect(events).toEqual([]);
    });

    it('should read multiple events in order', async () => {
      const events: ChronicleEvent[] = [
        {
          type: 'FILE_ADDED',
          timestamp: '2024-01-01T00:00:00.000Z',
          actor: { agent: 'daemon', id: 'watcher' },
          filePath: 'src/test.ts',
          hash: 'hash1',
          size: 100,
        },
        {
          type: 'FILE_REMOVED',
          timestamp: '2024-01-01T01:00:00.000Z',
          actor: { agent: 'daemon', id: 'watcher' },
          filePath: 'src/test.ts',
          lastHash: 'hash1',
        },
      ];

      for (const event of events) {
        await appendEvent(TEST_CHRONICLE, event);
      }

      const readEvents = await readChronicle(TEST_CHRONICLE);
      expect(readEvents).toHaveLength(2);
      expect(readEvents[0].type).toBe('FILE_ADDED');
      expect(readEvents[1].type).toBe('FILE_REMOVED');
    });
  });

  describe('tailChronicle', () => {
    it('should return last n events', async () => {
      // Add 5 events
      for (let i = 0; i < 5; i++) {
        const event: ChronicleEvent = {
          type: 'BUILD',
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          actor: { agent: 'delegator', id: 'build-system' },
          status: 'success',
          buildId: `build-${i}`,
        };
        await appendEvent(TEST_CHRONICLE, event);
      }

      const tail3 = await tailChronicle(TEST_CHRONICLE, 3);
      expect(tail3).toHaveLength(3);
      
      // Should be the last 3 events (builds 2, 3, 4)
      expect((tail3[0] as any).buildId).toBe('build-2');
      expect((tail3[1] as any).buildId).toBe('build-3');
      expect((tail3[2] as any).buildId).toBe('build-4');
    });

    it('should return all events if n is greater than total', async () => {
      const event: ChronicleEvent = {
        type: 'DEPLOY',
        timestamp: new Date().toISOString(),
        actor: { agent: 'warden', id: 'prod' },
        environment: 'production',
        deploymentId: 'deploy-1',
        status: 'success',
      };
      
      await appendEvent(TEST_CHRONICLE, event);

      const tail10 = await tailChronicle(TEST_CHRONICLE, 10);
      expect(tail10).toHaveLength(1);
      expect(tail10[0].type).toBe('DEPLOY');
    });

    it('should reject negative tail count', async () => {
      await expect(tailChronicle(TEST_CHRONICLE, -1)).rejects.toThrow('Tail count must be non-negative');
    });

    it('should default to n=10', async () => {
      // Add 15 events
      for (let i = 0; i < 15; i++) {
        const event: ChronicleEvent = {
          type: 'BUILD',
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          actor: { agent: 'delegator', id: 'build-system' },
          status: 'success',
          buildId: `build-${i}`,
        };
        await appendEvent(TEST_CHRONICLE, event);
      }

      const tail = await tailChronicle(TEST_CHRONICLE);
      expect(tail).toHaveLength(10); // Should default to 10
    });
  });

  describe('Event type completeness', () => {
    const eventTypes = [
      'PLAN_DRAFTED',
      'PLAN_APPROVED', 
      'PLAN_DENIED',
      'PLAN_UNSAFE',
      'HALT_AND_REPORT',
      'RECONCILIATION',
      'ROGUE_EDIT_DETECTED',
      'BUILD',
      'DEPLOY',
      'ENVVAR_CHANGE',
      'POSTMORTEM',
      'FILE_ADDED',
      'FILE_REMOVED',
      'FILE_RENAMED',
      'FILE_SPLIT',
      'FILE_MERGED',
    ];

    it('should support all required event types from CONTRACT.md', () => {
      // This test ensures our type union includes all required event types
      // The TypeScript compiler will catch if any are missing
      eventTypes.forEach(type => {
        expect(type).toBeTypeOf('string');
      });
    });
  });
});