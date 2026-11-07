export function missingScriptFiles(
  pkg: { scripts?: Record<string, string> },
  exists?: (p: string) => boolean,
): { script: string; file: string }[];
