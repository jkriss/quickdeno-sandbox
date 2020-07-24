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

    // return 2 to skip processing body?
    return false;
  };
  // @ts-ignore
  parser[HTTPParser.kOnBody] = (args: any) => {
    // console.log("on body:", args);
    console.log("on body:", new TextDecoder().decode(args));
  };

  // @ts-ignore
  parser[HTTPParser.kOnMessageComplete] = () => {
    // console.log("!! request finished !!")
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

async function example() {
  const te = new TextEncoder();
  function writeLine(str?: string) {
    Deno.stdout.writeSync(te.encode((str || "") + "\r\n"));
  }

  const result = await parseRequest(Deno.stdin);

  // route based on url
  const host = result.headersObj.get("host") || "localhost";
  let baseUrl = `http://${host}`;
  if (Deno.env.get("PORT")) baseUrl += `:${Deno.env.get("PORT")}`;
  const url = new URL(result.url, baseUrl);
  let pathname = url.pathname;
  if (pathname === "/") pathname = "/index";

  const parts = pathname.slice(1).split("/");
  const handlerName = parts[0];
  // console.error("handling with", handlerName);

  Deno.env.set("REQUEST_URI", url.pathname);
  function setHeader(httpKey: string, cgiKey: string) {
    const val = result.headersObj.get(httpKey);
    if (val) Deno.env.set(cgiKey.toUpperCase(), val);
  }
  setHeader("user-agent", "HTTP_USER_AGENT");
  setHeader("content-type", "CONTENT_TYPE");
  setHeader("content-length", "CONTENT_LENGTH");
  Deno.env.set("REQUEST_METHOD", HTTPParser.methods[result.method]);
  Deno.env.set("QUERY_STRING", url.search.slice(1));
  Deno.env.set("GATEWAY_INTERFACE", "CGI/1.1");
  const pathInfo = "/" + parts.slice(1).join("/");
  Deno.env.set("PATH_INFO", pathInfo);
  Deno.env.set("PATH_TRANSLATED", `${Deno.cwd()}/www${pathInfo}`);
  Deno.env.set("SCRIPT_NAME", `${handlerName}.js`);
  Deno.env.set("SERVER_NAME", url.host.split(":")[0]);
  Deno.env.set("SERVER_PORT", url.port);
  Deno.env.set(
    "SERVER_PROTOCOL",
    `HTTP/${result.versionMajor}.${result.versionMinor}`,
  );

  async function readAndRun(handlerName: string) {
    scriptPath = `./handlers/${handlerName}.js`;
    const handlerCode = await Deno.readTextFile(scriptPath);
    eval(handlerCode);
  }

  let scriptPath;
  try {
    await readAndRun(handlerName);
  } catch (err) {
    // console.error(`error reading ${scriptPath}: `, err);
    // try the default handler if there is one
    try {
      Deno.env.set("PATH_INFO", pathname);
      Deno.env.set("PATH_TRANSLATED", `${Deno.cwd()}/www${url.pathname}`);
      readAndRun("default");
    } catch (err) {
      writeLine("HTTP/1.1 404 Not Found");
      writeLine();
    }
  }
}

example().catch((err) => {
  console.log(err);
  console.log(err.stack);
});
