let output = `
http/1.1 404 Not Found
content-type: text/html

File not found
`;

let file = Deno.env.get("PATH_TRANSLATED");
if (!file) throw new Error(`PATH_TRANSLATED was not provided`);
if (file && file.endsWith("/")) file += "index.html";

try {
  // console.error("looking for", file);

  const f = Deno.openSync(file);

  let len = 0;
  let buf = new Uint8Array(4096);
  let first = true;
  while (len !== null) {
    len = f.readSync(buf);
    if (first) {
      // do this after the first read
      // to make sure it's likely to succeed
      console.log("http/1.1 200 OK\r");
      // if we leave the content type out,
      // the browser will guess based on extension
      console.log("\r");
      first = false;
    }
    if (len) Deno.stdout.writeSync(buf.subarray(0, len));
  }
} catch (err) {
  console.error(`Error reading file: ${err}`);
  console.log(output.trim().split("\n").join("\r\n"));
}
