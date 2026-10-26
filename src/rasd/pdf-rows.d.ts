type Field = { key: string; label: string; type: string };
export declare function linesToRows(lines: string[][], fields: Field[]): Record<string, string>[];
export declare function extractPdfRows(file: File, fields: Field[]): Promise<Record<string, string>[]>;
