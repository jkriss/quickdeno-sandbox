router.ts parses an http request in stdin, sets cgi variables, and evals js code to run handlers.

You can run it with Deno:

    socat -v tcp4-listen:8888,reuseaddr,fork exec:"deno run --allow-read --allow-env router.ts"

Or you can compile it with quickdeno:

    quickdeno compile -ho router router.ts

...and run it with:

    socat -v tcp4-listen:8888,reuseaddr,fork exec:./router
