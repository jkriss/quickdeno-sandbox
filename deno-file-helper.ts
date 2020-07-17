import { TimestreamFileHelper, pad } from "./timestreams-core.ts";

export default function helper(
  base: string,
  mimes: Record<string, string>,
  seperator?: string,
): TimestreamFileHelper {
  const sep = seperator || "/";

  function filesWithPrefix(base: string, path: string): string[] {
    const parts = path.split(sep);
    parts.pop();
    parts.unshift(base);
    const dir = parts.join(sep);
    const files: string[] = [];
    try {
      const relativeDir = dir.replace(base + sep, "");
      for (const { name } of Deno.readDirSync(dir)) {
        const relativePath = [relativeDir, name].join(sep);
        if (relativePath.startsWith(path)) files.push(relativePath);
      }
      return files;
    } catch (err) {
      return [];
    }
  }

  const helper: TimestreamFileHelper = {
    fileText: (path: string) => Deno.readTextFileSync([base, path].join(sep)),
    fileExists: (path: string) => {
      try {
        return Deno.statSync([base, path].join(sep))?.isFile;
      } catch (err) {
        return false;
      }
    },
    typeForExtension: (ext: string) => mimes[ext],
    filesWithPrefix: (path: string) => filesWithPrefix(base, path),
    separator: sep,
    earliestDay: () => {
      let minYear = 9999;
      for (const f of Deno.readDirSync(base)) {
        const num = parseInt(f.name);
        if (num < minYear) minYear = num;
      }
      return { year: minYear, month: 1, day: 1 };
    },
    filesForDay: ({ year, month, day }) => {
      const files: string[] = [];
      const dayDir = `${year}/${pad(month)}/${pad(day)}`;
      try {
        for (const f of Deno.readDirSync(`${base}/${dayDir}`)) {
          files.push(`${dayDir}/${f.name}`);
        }
        return files;
      } catch (err) {
        return [];
      }
    },
  };
  return helper;
}
