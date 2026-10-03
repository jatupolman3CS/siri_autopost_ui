// Types for zip.js, a byte-identical copy of the extension's client/lib/zip.js.

/** Every file of the zip (folders skipped), paths with "/". */
export function readZip(input: ArrayBuffer | Uint8Array): Promise<Map<string, Uint8Array>>;
