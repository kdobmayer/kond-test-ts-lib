import { parseJson, parseJsonStream } from './json';
import { DataRecord, StreamEvent } from '../types';

describe('parseJson', () => {
  it('parses a JSON array of objects', () => {
    const input = JSON.stringify([
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]);
    const result = parseJson(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({ name: 'Alice', age: 30 });
  });

  it('parses a single object', () => {
    const input = JSON.stringify({ name: 'Alice', age: 30 });
    const result = parseJson(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({ name: 'Alice', age: 30 });
  });

  it('extracts nested path', () => {
    const input = JSON.stringify({
      response: { data: { items: [{ id: 1 }, { id: 2 }] } },
    });
    const result = parseJson(input, { path: 'response.data.items' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({ id: 1 });
  });

  it('flattens nested objects', () => {
    const input = JSON.stringify([{ user: { name: 'Alice', address: { city: 'NYC' } } }]);
    const result = parseJson(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0]).toEqual({ 'user.name': 'Alice', 'user.address.city': 'NYC' });
  });

  it('returns error for invalid JSON', () => {
    const result = parseJson('not json');
    expect(result.success).toBe(false);
  });

  it('returns error for invalid path', () => {
    const input = JSON.stringify({ a: 1 });
    const result = parseJson(input, { path: 'b.c' });
    expect(result.success).toBe(false);
  });

  it('skips non-object array items with warning', () => {
    const input = JSON.stringify([{ id: 1 }, 'string', { id: 2 }]);
    const result = parseJson(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(2);
    expect(result.warnings).toHaveLength(1);
  });

  it('stringifies arrays in flat records', () => {
    const input = JSON.stringify([{ tags: ['a', 'b'] }]);
    const result = parseJson(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0].tags).toBe('["a","b"]');
  });
});

describe('parseJsonStream', () => {
  it('parses NDJSON line by line', () => {
    const input = '{"name":"Alice","age":30}\n{"name":"Bob","age":25}';
    const events: StreamEvent<DataRecord>[] = [];
    parseJsonStream(input, (e) => events.push(e));

    const dataEvents = events.filter(e => e.type === 'data');
    expect(dataEvents).toHaveLength(2);
    expect(events[events.length - 1]).toEqual({ type: 'end', totalRecords: 2, errors: 0 });
  });

  it('emits errors for invalid lines', () => {
    const input = '{"name":"Alice"}\nnot json\n{"name":"Bob"}';
    const events: StreamEvent<DataRecord>[] = [];
    parseJsonStream(input, (e) => events.push(e));

    const errorEvents = events.filter(e => e.type === 'error');
    expect(errorEvents).toHaveLength(1);
  });
});
