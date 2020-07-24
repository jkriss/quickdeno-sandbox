import { loadScript, getenv } from "std";

const filename = getenv("QUICKJS_SCRIPT");
if (filename) {
  console.log("running", filename);

  loadScript(filename);
} else {
  console.log("no file provided via QUICKJS_SCRIPT, exiting");
}
