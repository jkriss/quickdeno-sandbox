const writeLine = (str:string) => console.log(`${str}\r`)

const envVars = `http_host http_user_agent https request_method request_uri
local_uri script_filename script_name query_string
`.trim().split(/\s+/).sort().map(s => s.toUpperCase())


writeLine('content-type: text/plain')
writeLine('')

writeLine(`

Hi there! This was a request for ${Deno.env.get('REQUEST_URI')}

${envVars.map(k => `${k} = ${Deno.env.get(k)}`).join("\n")}

`.trim())

// setTimeout(() => {
//   writeLine("writing this a little later")
// }, 20)