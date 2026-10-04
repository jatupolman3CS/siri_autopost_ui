// Small RFC 4180 helpers behind the link and post exports/imports. Client-only: the server never
// parses these files, the web app sends it the parsed rows (see group-links.ts).

export type CsvValue = string | number | boolean | null | undefined;

/** Written first so Excel opens the Thai text as UTF-8. */
export const CSV_BOM = '\ufeff';

export const CSV_MIME = 'text/csv;charset=utf-8';

// A text cell that starts with one of these is read as a formula by spreadsheets (CSV injection).
const FORMULA_START = /^'*[=+\-@\t\r]/;
const ESCAPED_FORMULA = /^'+[=+\-@\t\r]/;

/**
 * One cell: quoted (and inner quotes doubled) only when it holds a separator, quote or line break.
 * Text that a spreadsheet would run as a formula (a leading `=`, `+`, `-`, `@`, TAB or CR) gets a
 * leading apostrophe, so a post or link name from the web cannot become a formula; numbers are
 * written as they are. `unescapeFormulaCell` undoes it on import.
 */
export function csvCell(value: CsvValue): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\t\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Takes the apostrophe `csvCell` put in front of a formula-like text off again, so an export read
 * back gives the original text. A cell that merely starts with an apostrophe stays as it is.
 */
export function unescapeFormulaCell(cell: string): string {
  return ESCAPED_FORMULA.test(cell) ? cell.slice(1) : cell;
}

export function csvLine(values: readonly CsvValue[]): string {
  return values.map(csvCell).join(',');
}

/** Rows joined with CRLF (RFC 4180), no trailing line break. */
export function csvText(rows: readonly (readonly CsvValue[])[]): string {
  return rows.map(csvLine).join('\r\n');
}

/**
 * Reads CSV text into records of trimmed cells. A comma OR a tab separates cells (spreadsheets paste
 * tabs), a cell that starts with a quote may hold separators, line breaks and doubled quotes, a
 * leading BOM is dropped and blank records are skipped. A quote that is never closed is taken as a
 * plain character instead of swallowing the rest of the file.
 */
export function parseCsvRecords(text: string | null | undefined): string[][] {
  const src = String(text ?? '').replace(/^\ufeff/, '');
  const literalQuotes = new Set<number>();
  for (;;) {
    const result = scan(src, literalQuotes);
    if (typeof result !== 'number') return result;
    literalQuotes.add(result);
  }
}

/** Returns the records, or the index of an opening quote that was never closed. */
function scan(src: string, literalQuotes: ReadonlySet<number>): string[][] | number {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  // True while the current cell holds only spaces: a quote may still open it.
  let atCellStart = true;
  let quoted = false;
  let quoteAt = -1;

  const endCell = () => {
    row.push(cell.trim());
    cell = '';
    atCellStart = true;
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c !== '')) records.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (src[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = false;
        atCellStart = false;
      }
      continue;
    }
    if (ch === '"' && atCellStart && !literalQuotes.has(i)) {
      quoted = true;
      quoteAt = i;
      cell = '';
    } else if (ch === ',' || ch === '\t') {
      endCell();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRow();
    } else {
      cell += ch;
      if (ch.trim() !== '') atCellStart = false;
    }
  }
  if (quoted) return quoteAt;
  endRow();
  return records;
}
