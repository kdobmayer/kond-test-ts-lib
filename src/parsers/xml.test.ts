import { parseXml } from './xml';

describe('parseXml', () => {
  it('parses simple XML with repeated elements', () => {
    const input = '<users><user><name>Alice</name><age>30</age></user><user><name>Bob</name><age>25</age></user></users>';
    const result = parseXml(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({ 'name.#text': 'Alice', 'age.#text': 30 });
  });

  it('handles attributes', () => {
    const input = '<items><item id="1" type="book"><title>Test</title></item></items>';
    const result = parseXml(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0]['@id']).toBe('1');
    expect(result.data[0]['@type']).toBe('book');
  });

  it('returns error for empty input', () => {
    const result = parseXml('');
    expect(result.success).toBe(false);
  });

  it('handles mixed children as single record', () => {
    const input = '<config><host>localhost</host><port>8080</port></config>';
    const result = parseXml(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]['host.#text']).toBe('localhost');
    expect(result.data[0]['port.#text']).toBe(8080);
  });
});
