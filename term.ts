import * as c from "https://deno.land/std/fmt/colors.ts";
import { parseLinkHeader } from "./link.ts";

// console.log(`hi, this should be ${c.bgCyan(c.yellow(c.bold(' bold ')))}`)

function wrap(str: string, width?: number): string[] {
  if (!width) width = 80;
  const inputLines = str.split("\n");
  const lines: string[] = [];
  for (const inputLine of inputLines) {
    const words = inputLine.split(/ /);
    let line = "";
    for (const w of words) {
      if (line.length > 0) {
        line += " ";
      }
      if (line.length + w.length > width) {
        lines.push(line);
        line = "";
      }
      line += w;
    }
    lines.push(line);
  }
  return lines;
}

function colorize(str: string) {
  return c.rgb24(c.bgRgb24(str, 0x212121), 0xbbbbbb);
}

function pretty(str: string, width?: number) {
  if (!width) width = 80;
  const padding = 2;
  let p = "";
  for (let i = 0; i < padding; i++) p += " ";
  const lines = wrap(str, width - 2 * padding).map((s) => p + s);
  lines.unshift("");
  lines.push(" ");
  return (
    lines
      // @ts-ignore
      .map((str) => colorize(str.padEnd(width, " ")))
      .join("\n")
  );
}

try {
  // this is quickjs-specific stuff, will fail in deno
  // @ts-ignore
  console.log("window size is", os.ttyGetWinSize(std.out.fileno()));
  // this has to be quoted so the ampersand doesn't mess up the exec call
  // that quickjs is doing
  const url =
    `"http://code.jklabs.net:8000/timestreams.cgi?stream=posts&post=20200601000000Z-image.jpeg"`;
  console.log("fetching url", url);
  // @ts-ignore
  const res = std.urlGet(url, { full: true, binary: true });
  console.log("got response:", res.response);
  const headerLines: string[] = res.responseHeaders.trim().split("\r\n");
  const headerList: string[][] = [];
  for (const line of headerLines) {
    const idx = line.indexOf(": ");
    const k = line.slice(0, idx);
    const v = line.slice(idx + 2);
    headerList.push([k, v]);
  }
  const headers = new Headers(headerList);
  // for (const [k,v] of headers.entries()) {
  //   console.log("got header:", k, "=", v)
  // }
  const links = parseLinkHeader(headers.get("link"));
  console.log("links:", JSON.stringify(links, null, 2));
} catch {}

console.log(
  pretty(
    `

this is some text. it might go on for a while. might even wrap.

did that really work on the first try? that would be amazing.

well, not quite the first try. but it's working now.

`.trim(),
    40,
  ),
);
