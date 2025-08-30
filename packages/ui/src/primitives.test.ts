import { describe, it, expect } from 'vitest';
import { Text, Row, Column, Box } from '../src/primitives';

describe('@sage/ui primitives', () => {
  it('should export Text component', () => {
    expect(Text).toBeDefined();
    expect(typeof Text).toBe('function');
  });

  it('should export Row component', () => {
    expect(Row).toBeDefined();
    expect(typeof Row).toBe('function');
  });

  it('should export Column component', () => {
    expect(Column).toBeDefined();
    expect(typeof Column).toBe('function');
  });

  it('should export Box component', () => {
    expect(Box).toBeDefined();
    expect(typeof Box).toBe('function');
  });

  it('should throw errors when components are used without adapters', () => {
    expect(() => Text({ children: 'test' })).toThrow('Text component must be implemented by a renderer adapter');
    expect(() => Row({ children: 'test' })).toThrow('Row component must be implemented by a renderer adapter');
    expect(() => Column({ children: 'test' })).toThrow('Column component must be implemented by a renderer adapter');
    expect(() => Box({ children: 'test' })).toThrow('Box component must be implemented by a renderer adapter');
  });
});