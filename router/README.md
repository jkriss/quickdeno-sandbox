router.ts parses an http request in stdin, sets cgi variables, and evals js code to run handlers.

It uses the first path component to determine the handler script, e.g. `/stuff/things` will be
handled by `/handlers/stuff.js`.

You can run it with Deno:

    socat -v tcp4-listen:8888,reuseaddr,fork exec:"deno run --allow-read --allow-env router.ts"

Or you can compile it with quickdeno:

    quickdeno compile -ho router router.ts

...and run it with:

    socat -v tcp4-listen:8888,reuseaddr,fork exec:./router

## Example handlers

The handlers in the `/handlers` directory will run on their own.

Handlers with imports should be built with quickdeno, e.g.:

    quickdeno bundle src/timestreams.ts > handlers/streams.js
