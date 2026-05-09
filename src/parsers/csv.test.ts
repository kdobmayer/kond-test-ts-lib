import { parseCsv, parseCsvStream } from './csv';
import { DataRecord, StreamEvent } from '../types';

describe('parseCsv', () => {
  it('parses simple CSV with headers', () => {
    const input = 'name,age,active\nAlice,30,true\nBob,25,false';
    const result = parseCsv(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({ name: 'Alice', age: 30, active: true });
    expect(result.data[1]).toEqual({ name: 'Bob', age: 25, active: false });
  });

  it('handles quoted fields with commas', () => {
    const input = 'name,desc\n"Smith, John","A ""great"" person"';
    const result = parseCsv(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0]).toEqual({ name: 'Smith, John', desc: 'A "great" person' });
  });

  it('handles custom delimiter', () => {
    const input = 'name;age\nAlice;30';
    const result = parseCsv(input, { delimiter: ';' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0]).toEqual({ name: 'Alice', age: 30 });
  });

  it('handles explicit headers option', () => {
    const input = 'Alice,30\nBob,25';
    const result = parseCsv(input, { headers: ['name', 'age'] });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({ name: 'Alice', age: 30 });
  });

  it('skips empty lines', () => {
    const input = 'name,age\nAlice,30\n\nBob,25\n';
    const result = parseCsv(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(2);
  });

  it('returns error on empty input', () => {
    const result = parseCsv('');
    expect(result.success).toBe(false);
  });

  it('collects warnings for unclosed quotes with onError=collect', () => {
    const input = 'name,age\n"Alice,30\nBob,25';
    const result = parseCsv(input, { onError: 'collect' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.data).toHaveLength(1); // Only Bob parsed
  });

  it('stops on error with onError=stop', () => {
    const input = 'name,age\n"Alice,30\nBob,25';
    const result = parseCsv(input, { onError: 'stop' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.partial).toBeDefined();
  });

  it('warns about extra fields', () => {
    const input = 'name,age\nAlice,30,extra';
    const result = parseCsv(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.warnings).toContain('Line 2: 1 extra field(s) ignored');
  });

  it('handles null values for missing fields', () => {
    const input = 'a,b,c\n1,2';
    const result = parseCsv(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0]).toEqual({ a: 1, b: 2, c: null });
  });
});

describe('parseCsvStream', () => {
  it('emits data events for each record', () => {
    const input = 'name,age\nAlice,30\nBob,25';
    const events: StreamEvent<DataRecord>[] = [];
    parseCsvStream(input, (e) => events.push(e));

    const dataEvents = events.filter(e => e.type === 'data');
    expect(dataEvents).toHaveLength(2);
    expect(events[events.length - 1]).toEqual({ type: 'end', totalRecords: 2, errors: 0 });
  });

  it('emits error events for malformed lines', () => {
    const input = 'name,age\n"Alice,30\nBob,25';
    const events: StreamEvent<DataRecord>[] = [];
    parseCsvStream(input, (e) => events.push(e));

    const errorEvents = events.filter(e => e.type === 'error');
    expect(errorEvents).toHaveLength(1);
  });
});
