import { getPost, getBefore } from "./timestreams-core.ts";
import { parseLinkHeader, stringify } from "./link.ts";
import makeHelper from "./deno-file-helper.ts";

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

async function run() {
  const method = Deno.env.get("REQUEST_METHOD") || "GET";
  const qs = Deno.env.get("QUERY_STRING");
  const query = new URLSearchParams(qs);
  // const streamName = query.get("stream");
  // const postId = query.get("post");
  const beforeString = query.get("before");
  const beforeDate = beforeString ? Date.parse(beforeString) : undefined;

  const path = Deno.env.get("PATH_INFO");
  const requestUri = Deno.env.get("REQUEST_URI");
  if (!path) throw new Error(`PATH_INFO not provided`);
  if (!requestUri) throw new Error(`REQUEST_URI not provided`);
  const pathParts = path.slice(1).split("/");
  const [streamName, postId] = pathParts;

  // const base = `${streamName}.timestream`;
  const pathTranslated = Deno.env.get("PATH_TRANSLATED");
  if (!pathTranslated) throw new Error(`PATH_TRANSLATED is not available`);
  const base = postId
    ? `${pathTranslated.replace(`/${postId}`, "")}.timestream`
    : `${pathTranslated}.timestream`;
  const helper = makeHelper(base, mimes, sep);
  const timestreamBaseUrl = `${
    requestUri.slice(0, requestUri.lastIndexOf(path))
  }/${streamName}/`;

  if (["GET", "HEAD"].includes(method) && streamName) {
    const post = postId
      ? await getPost(postId, helper)
      : await getBefore(beforeDate, helper);
    // const post = await getPost(postId, helper);

    if (post) {
      writeLine("http/1.1 200 OK");
      const fullPath = [base, post.filepath].join(sep);
      // rewrite link header to have correct paths
      const links = parseLinkHeader(post.headers.get("link"));
      for (const link of links) {
        if (!link.url.match(/^http/)) {
          link.url = `${timestreamBaseUrl}${encodeURIComponent(link.url)}`;
        }
      }
      post.headers.set("link", stringify(links));
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
      writeLine("http/1.1 404 Not Found");
      writeLine("Content-Type: text/plain");
      writeLine();
      writeLine("Post not found");
    }
  } else {
    writeLine("http/1.1 404 Not Found");
    writeLine("Content-Type: text/plain");
    writeLine();
    writeLine("Need to specify stream and post");
  }
}

run().catch((err) => console.error(`Error! ${err}\n${err.stack}`));
