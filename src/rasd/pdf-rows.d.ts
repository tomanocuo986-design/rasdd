type Field = { key: string; label: string; type: string };
export declare function linesToRows(lines: string[][], fields: Field[]): Record<string, string>[];
export declare function extractPdfRows(file: File, fields: Field[], onStatus?: (m: string) => void): Promise<Record<string, string>[]>;
