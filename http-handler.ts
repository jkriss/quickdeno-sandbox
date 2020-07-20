import { HTTPParser } from "./http.js";

export interface RequestInfo extends HTTPPayloadInfo {
  url: string;
}

export interface HTTPPayloadInfo {
  headersObj: Headers;
  [i: string]: any;
}

async function parseRequest(reader: Deno.Reader): Promise<RequestInfo> {
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

    // return 2 to skip processing body?
    return 0;
  };
  // @ts-ignore
  parser[HTTPParser.kOnBody] = (...args: any) => {
    console.log("on body:", args);
  };
  let len: number | null = -1;
  const buffer = new Uint8Array(1024);
  while (len) {
    len = await reader.read(buffer);
    if (len) parser.execute(buffer, 0, len);
  }
  parser.finish();
  if (!headersObj) throw new Error(`Invalid http payload, no headers found`);
  return Object.assign(infoResult, {
    headersObj,
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
  // prettier-ignore
  const reqString = `
POST / HTTP/1.1
Host: localhost:8000
Accept: text/plain
Content-Type: text/plain

this is a body
  `.trim().split("\n").join("\r\n");
  console.log("req string is:", JSON.stringify(reqString));
  // const req = new Deno.Buffer(new Uint8Array(new TextEncoder().encode(reqString)))
  const req = arrayReader(new Uint8Array(new TextEncoder().encode(reqString)));
  const result = await parseRequest(req);

  console.log("result:", JSON.stringify(result, null, 2));
}

example().catch((err) => {
  console.error(err);
  console.error(err.stack);
});
