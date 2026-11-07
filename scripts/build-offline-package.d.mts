export function parseArgs(argv: string[]): { dir: string; entry: string; out: string; ignore: string[] };
export function buildOfflinePackage(opts?: {
  dir?: string;
  entry?: string;
  out?: string;
  ignore?: string[];
}): Promise<{
  builtAt: string;
  size: number;
  files: number;
  entry: string;
  sha256: string;
  excluded: string[];
  outDir: string;
}>;
