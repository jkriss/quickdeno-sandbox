import { HTTPParser } from "./http.js";

export interface RequestInfo extends HTTPPayloadInfo {
  url: string;
}

export interface HTTPPayloadInfo {
  headersObj: Headers;
  [i: string]: any;
}

async function parseRequest(reader: Deno.Reader): Promise<RequestInfo> {
  // console.log("-- going to parse request from reader:")
  const info = await parseHeaders(HTTPParser.REQUEST, reader);
  if (!info.url) throw new Error(`No url found in request`);
  // @ts-ignore
  return info;
}

async function parseHeaders(
  type: string,
  reader: Deno.Reader,
): Promise<HTTPPayloadInfo> {
  const parser = new HTTPParser(type);
  let headersObj: Headers | undefined;
  let infoResult: any;
  // @ts-ignore
  parser[HTTPParser.kOnHeadersComplete] = (info: any) => {
    headersObj = new Headers();
    let k: string = "";
    info.headers.forEach((element: string, i: number) => {
      if (i % 2 === 0) k = element;
      else headersObj?.set(k, element);
    });
    infoResult = info;
    // console.log("got info", infoResult)

    // return 2 to skip processing body?
    return 0;
  };
  // @ts-ignore
  parser[HTTPParser.kOnBody] = (...args: any) => {
    // console.log("on body:", args);
  };
  let len: number | null = -1;
  const buffer = new Uint8Array(1024);
  return new Promise(async (resolve) => {
    while (len !== null && !headersObj) {
      len = await reader.read(buffer);
      if (len) parser.execute(buffer, 0, len);
    }
    parser.finish();
    if (!headersObj) throw new Error(`Invalid http payload, no headers found`);
    const result = Object.assign(infoResult, {
      headersObj,
    });
    resolve(result);
  });
}

function arrayReader(src: Uint8Array): Deno.Reader {
  let pos = 0;
  return {
    read: async function (p: Uint8Array): Promise<number | null> {
      const len = Math.min(p.byteLength, src.byteLength - pos);
      if (len > 0) {
        for (let i = pos; i < pos + len; i++) {
          p[i - pos] = src[i];
        }
        pos += len;
        return len;
      } else {
        return null;
      }
    },
  };
}

async function example() {
  const te = new TextEncoder();
  function writeLine(str?: string) {
    Deno.stdout.writeSync(te.encode((str || "") + "\r\n"));
  }

  writeLine("HTTP/1.1 200 OK");
  writeLine("content-type: text/plain");
  writeLine("connection: close");
  writeLine();
  // console.error("reading from", JSON.stringify(Object.keys(Deno.stdin)))
  const result = await parseRequest(Deno.stdin);
  // console.log("-- got result --")

  // console.log("hi there!")
  console.log("result:", JSON.stringify(result, null, 2));
}

example().catch((err) => {
  console.log(err);
  console.log(err.stack);
});
