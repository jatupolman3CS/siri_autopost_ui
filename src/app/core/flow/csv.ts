// Small RFC 4180 helpers behind the link and post exports/imports. Client-only: the server never
// parses these files, the web app sends it the parsed rows (see group-links.ts).

export type CsvValue = string | number | boolean | null | undefined;

/** Written first so Excel opens the Thai text as UTF-8. */
export const CSV_BOM = '\ufeff';

export const CSV_MIME = 'text/csv;charset=utf-8';

/** One cell: quoted (and inner quotes doubled) only when it holds a separator, quote or line break. */
export function csvCell(value: CsvValue): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\t\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
