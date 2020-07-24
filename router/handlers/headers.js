const envVars = `http_user_agent request_method request_uri
script_name query_string auth_type content_length content_type
path_info path_translated remote_addr remote_host remote_ident remote_user server_name
server_port server_protocol gateway_interface
`
  .trim()
  .split(/\s+/)
  .sort()
  .map((s) => s.toUpperCase());

const output = `
http/1.1 200 Aight
content-type: text/html

Hi there! This was a request for ${Deno.env.get("REQUEST_URI")}

<pre>
${envVars.map((k) => `${k} = ${Deno.env.get(k)}`).join("\n")}
</pre>`;

console.log(output.trim().split("\n").join("\r\n"));
