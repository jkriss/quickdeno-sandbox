console.log(`
http/1.1 200 OK\r
content-type: text/plain\r
\r
test page generated at ${new Date().toISOString()}
`.trim());
