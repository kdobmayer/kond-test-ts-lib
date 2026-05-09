import { DataRecord, DataValue, ParseResult, XmlOptions } from '../types';

const DEFAULT_OPTIONS: Required<XmlOptions> = {
  arrayTags: [],
  attributePrefix: '@',
  textKey: '#text',
  onError: 'collect',
};

interface XmlNode {
  tag: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
}

/**
 * Minimal XML tokenizer. NOT streaming - loads entire document into memory.
 * This is an intentional limitation; for large XML files, use a SAX-based parser.
 */
function tokenize(input: string): { tokens: XmlToken[]; errors: string[] } {
  const tokens: XmlToken[] = [];
  const errors: string[] = [];
  let pos = 0;

  while (pos < input.length) {
    if (input[pos] === '<') {
      if (input.startsWith('<!--', pos)) {
        // Comment
        const end = input.indexOf('-->', pos);
        if (end === -1) {
          errors.push(`Unclosed comment at position ${pos}`);
          break;
        }
        pos = end + 3;
      } else if (input.startsWith('<?', pos)) {
        // Processing instruction
        const end = input.indexOf('?>', pos);
        if (end === -1) {
          errors.push(`Unclosed processing instruction at position ${pos}`);
          break;
        }
        pos = end + 2;
      } else if (input.startsWith('<![CDATA[', pos)) {
        // CDATA
        const end = input.indexOf(']]>', pos);
        if (end === -1) {
          errors.push(`Unclosed CDATA at position ${pos}`);
          break;
        }
        tokens.push({ type: 'text', value: input.slice(pos + 9, end) });
        pos = end + 3;
      } else if (input.startsWith('</', pos)) {
        // Close tag
        const end = input.indexOf('>', pos);
        if (end === -1) {
          errors.push(`Unclosed close tag at position ${pos}`);
          break;
        }
        const tag = input.slice(pos + 2, end).trim();
        tokens.push({ type: 'close', tag });
        pos = end + 1;
      } else {
        // Open tag
        const end = input.indexOf('>', pos);
        if (end === -1) {
          errors.push(`Unclosed open tag at position ${pos}`);
          break;
        }
        const content = input.slice(pos + 1, end);
        const selfClosing = content.endsWith('/');
        const tagContent = selfClosing ? content.slice(0, -1) : content;
        const { tag, attributes } = parseTagContent(tagContent);
        tokens.push({ type: selfClosing ? 'selfclose' : 'open', tag, attributes });
        pos = end + 1;
      }
    } else {
      // Text content
      const end = input.indexOf('<', pos);
      const text = end === -1 ? input.slice(pos) : input.slice(pos, end);
      if (text.trim()) {
        tokens.push({ type: 'text', value: text.trim() });
      }
      pos = end === -1 ? input.length : end;
    }
  }

  return { tokens, errors };
}

type XmlToken =
  | { type: 'open'; tag: string; attributes: Record<string, string> }
  | { type: 'close'; tag: string }
  | { type: 'selfclose'; tag: string; attributes: Record<string, string> }
  | { type: 'text'; value: string };

function parseTagContent(content: string): { tag: string; attributes: Record<string, string> } {
  const trimmed = content.trim();
  const spaceIdx = trimmed.search(/\s/);
  if (spaceIdx === -1) {
    return { tag: trimmed, attributes: {} };
  }

  const tag = trimmed.slice(0, spaceIdx);
  const attrStr = trimmed.slice(spaceIdx + 1);
  const attributes: Record<string, string> = {};
  const attrRegex = /(\w[\w\-.:]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(attrStr)) !== null) {
    attributes[match[1]] = match[2] ?? match[3] ?? '';
  }

  return { tag, attributes };
}

function buildTree(tokens: XmlToken[]): XmlNode | null {
  const stack: XmlNode[] = [];
  let root: XmlNode | null = null;

  for (const token of tokens) {
    switch (token.type) {
      case 'open': {
        const node: XmlNode = { tag: token.tag, attributes: token.attributes, children: [], text: '' };
        if (stack.length > 0) {
          stack[stack.length - 1].children.push(node);
        }
        stack.push(node);
        if (!root) root = node;
        break;
      }
      case 'close': {
        if (stack.length > 0 && stack[stack.length - 1].tag === token.tag) {
          stack.pop();
        }
        break;
      }
      case 'selfclose': {
        const node: XmlNode = { tag: token.tag, attributes: token.attributes, children: [], text: '' };
        if (stack.length > 0) {
          stack[stack.length - 1].children.push(node);
        } else if (!root) {
          root = node;
        }
        break;
      }
      case 'text': {
        if (stack.length > 0) {
          stack[stack.length - 1].text += token.value;
        }
        break;
      }
    }
  }

  return root;
}

function nodeToRecord(node: XmlNode, opts: Required<XmlOptions>, prefix = ''): DataRecord {
  const record: DataRecord = {};
  const fullPrefix = prefix ? `${prefix}.` : '';

  // Add attributes
  for (const [key, value] of Object.entries(node.attributes)) {
    record[`${fullPrefix}${opts.attributePrefix}${key}`] = value as DataValue;
  }

  // Add text content
  if (node.text && node.children.length === 0) {
    record[`${fullPrefix}${opts.textKey}`] = coerceXmlValue(node.text);
  }

  // Add children
  for (const child of node.children) {
    const childRecord = nodeToRecord(child, opts, `${fullPrefix}${child.tag}`);
    Object.assign(record, childRecord);
  }

  return record;
}

function coerceXmlValue(text: string): DataValue {
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null') return null;
  const num = Number(text);
  if (!isNaN(num) && text.trim() !== '') return num;
  return text;
}

/**
 * Parse XML string into DataRecord array.
 * Loads entire document into memory (no streaming).
 * Array elements are identified by repeated child tags or arrayTags option.
 */
export function parseXml(input: string, options?: XmlOptions): ParseResult<DataRecord[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const warnings: string[] = [];

  const { tokens, errors } = tokenize(input);
  if (errors.length > 0) {
    if (opts.onError === 'stop') {
      return { success: false, error: errors[0], warnings };
    }
    warnings.push(...errors);
  }

  const root = buildTree(tokens);
  if (!root) {
    return { success: false, error: 'No root element found', warnings };
  }

  // Find the array of records - either root's children or a specific repeated tag
  const records: DataRecord[] = [];
  const arrayTags = new Set(opts.arrayTags);

  if (root.children.length === 0) {
    // Single element
    records.push(nodeToRecord(root, opts));
  } else {
    // Check if all children have the same tag (typical list pattern)
    const childTags = new Set(root.children.map(c => c.tag));
    if (childTags.size === 1 || root.children.some(c => arrayTags.has(c.tag))) {
      for (const child of root.children) {
        records.push(nodeToRecord(child, opts));
      }
    } else {
      // Mixed children - treat root as single record
      records.push(nodeToRecord(root, opts));
    }
  }

  return { success: true, data: records, warnings };
}
