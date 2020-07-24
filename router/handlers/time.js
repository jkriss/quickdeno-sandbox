const output = `
http/1.1 200 ok
content-type: application/json

${JSON.stringify({ time: new Date().toISOString() })}

`;
console.log(output.trim().split("\n").join("\r\n"));
