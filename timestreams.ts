import { getPost, TimestreamFileHelper, pad } from "./timestreams-core.ts";

const writeLine = (str?: string) => console.log(`${str || ""}\r`);

const mimes: Record<string, string> = {
  ".txt": "text/plain",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".md": "text/markodwn",
};

const sep = "/";

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

async function run() {
  const method = Deno.env.get("REQUEST_METHOD") || "GET";
  const qs = Deno.env.get("QUERY_STRING");
  const query = new URLSearchParams(qs);
  const streamName = query.get("stream");
  const postId = query.get("post");

  const base = `${streamName}.timestream`;

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

  if (["GET", "HEAD"].includes(method) && streamName && postId) {
    const post = await getPost(postId, helper);

    if (post) {
      const fullPath = [base, post.filepath].join(sep);
      for (const [k, v] of post?.headers.entries()) {
        writeLine(`${k}: ${v}`);
      }
      const stat = Deno.statSync(fullPath);
      if (stat) writeLine(`content-length: ${stat.size}`);
      writeLine();
      if (method === "GET") {
        const buffer = new Uint8Array(4096);
        const f = await Deno.open(fullPath);
        let len: number | null = null;
        do {
          len = f.readSync(buffer);
          if (len) {
            const b = buffer.byteLength === len
              ? buffer
              : buffer.subarray(0, len);
            Deno.stdout.writeSync(b);
          }
        } while (len !== null);
        f.close();
      }
    } else {
      writeLine("Content-Type: text/plain");
      writeLine("Status: 404");
      writeLine();
      writeLine("Post not found");
    }
  } else {
    writeLine("Content-Type: text/plain");
    writeLine("Status: 404");
    writeLine();
    writeLine("Need to specify stream and post");
  }
}

run().catch((err) => console.log(`Error! ${err}\n${err.stack}`));
