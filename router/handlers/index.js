const output = `
http/1.1 200 ok
content-type: text/html

<style>
body {
  font-family: Georgia, serif;
  font-size: 1.4em;
  background: #eee;
  color: #222;
  margin: 1.5rem;
}
</style>

<h1>Hello</h1>

This is an index page, generated at ${new Date().toISOString()} just for you.

`;
console.log(output.trim().split("\n").join("\r\n"));
