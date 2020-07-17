const writeLine = (str:string) => console.log(`${str}\r`)

const method = Deno.env.get('REQUEST_METHOD')
const qs = Deno.env.get('QUERY_STRING')
const query = new URLSearchParams(qs)
const streamName = query.get('stream')
const postId = query.get('post')

writeLine('content-type: text/plain')
writeLine('')

writeLine(`
method is ${method}, stream is ${streamName}, post is ${postId}
`.trim())