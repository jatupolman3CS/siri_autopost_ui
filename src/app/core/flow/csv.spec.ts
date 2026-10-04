import { CSV_BOM, csvCell, csvLine, csvText, parseCsvRecords } from './csv';

describe('csvCell', () => {
  it('leaves plain text, Thai text and numbers unquoted', () => {
    expect(csvCell('abc')).toBe('abc');
    expect(csvCell('กลุ่มขายของ')).toBe('กลุ่มขายของ');
    expect(csvCell(12)).toBe('12');
    expect(csvCell(0)).toBe('0');
  });

  it('writes null and undefined as an empty cell', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes cells with a comma, tab, quote or line break and doubles inner quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('a\tb')).toBe('"a\tb"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('one\ntwo')).toBe('"one\ntwo"');
    expect(csvCell('one\r\ntwo')).toBe('"one\r\ntwo"');
  });

  it('writes booleans as words', () => {
    expect(csvCell(true)).toBe('true');
    expect(csvCell(false)).toBe('false');
  });
});

describe('csvLine / csvText', () => {
  it('joins cells with commas and rows with CRLF, without a trailing break', () => {
    expect(csvLine(['a', 'b,c', 3])).toBe('a,"b,c",3');
    expect(
      csvText([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toBe('a,b\r\nc,d');
  });

  it('is empty for no rows', () => {
    expect(csvText([])).toBe('');
  });
});

describe('parseCsvRecords', () => {
  it('splits records on LF, CRLF and CR', () => {
    expect(parseCsvRecords('a,b\nc,d\r\ne,f\rg,h')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
      ['g', 'h'],
    ]);
  });

  it('accepts commas and tabs as separators, even in one line', () => {
    expect(parseCsvRecords('a\tb,c')).toEqual([['a', 'b', 'c']]);
  });

  it('trims cells and skips blank and whitespace-only records', () => {
    expect(parseCsvRecords('  a , b \n\n   \n\t\nc,d\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('drops a leading BOM', () => {
    expect(parseCsvRecords(CSV_BOM + 'a,b')).toEqual([['a', 'b']]);
  });

  it('reads quoted cells with separators, doubled quotes and line breaks', () => {
    expect(parseCsvRecords('"a,b","say ""hi""","x\ny"\nz')).toEqual([
      ['a,b', 'say "hi"', 'x\ny'],
      ['z'],
    ]);
    expect(parseCsvRecords('"a\tb",c')).toEqual([['a\tb', 'c']]);
  });

  it('keeps empty cells', () => {
    expect(parseCsvRecords('a,,c,')).toEqual([['a', '', 'c', '']]);
    expect(parseCsvRecords('"",x')).toEqual([['', 'x']]);
  });

  it('opens a quote only at the start of a cell', () => {
    expect(parseCsvRecords('5" pipe,b')).toEqual([['5" pipe', 'b']]);
    expect(parseCsvRecords('  "a,b" ,c')).toEqual([['a,b', 'c']]);
  });

  it('takes an unclosed quote as a plain character and keeps the following lines', () => {
    expect(parseCsvRecords('"set,name,url\nb,c,d')).toEqual([
      ['"set', 'name', 'url'],
      ['b', 'c', 'd'],
    ]);
  });

  it('only the quote that is never closed becomes a plain character', () => {
    expect(parseCsvRecords('"a,b\nc"\n"d,e\nf,g')).toEqual([['a,b\nc'], ['"d', 'e'], ['f', 'g']]);
  });

  it('returns nothing for empty input', () => {
    expect(parseCsvRecords('')).toEqual([]);
    expect(parseCsvRecords(null)).toEqual([]);
    expect(parseCsvRecords(undefined)).toEqual([]);
  });

  it('round-trips what csvText writes', () => {
    const rows = [
      ['set', 'name', 'url'],
      ['ชุด "A", ใหญ่', 'บรรทัด\nสอง', 'https://x'],
    ];
    expect(parseCsvRecords(csvText(rows))).toEqual(rows);
  });
});
