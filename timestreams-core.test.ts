import { assert, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import {
  parseId,
  fileForId,
  timeToDateParts,
  TimestreamFileHelper,
  getPost,
  PostHeaders,
  pad,
  idForFile,
  getBefore,
} from "./timestreams-core.ts";
import * as LinkHeader from "./link.ts";

const fakeFiles: Record<string, string> = {
  "2020/07/01/hello.txt": "hello",
  "2020/07/01/hello.txt$self.attributes": `title="test post";`,
  "2020/07/01/hello.txt$describedby.txt": "This is a test post",
  "2020/07/01/hello.txt$describedby.txt.attributes": "title=Description",
  "2020/07/01/z.txt": "last of the day",
  "2020/06/01/a.txt": "from an earlier month",
};

const mimes: Record<string, string> = {
  ".txt": "text/plain",
};

const helper: TimestreamFileHelper = {
  typeForExtension: (ext) => mimes[ext],
  fileExists: (path) => Object.keys(fakeFiles).includes(path),
  fileText: (path) => fakeFiles[path],
  filesWithPrefix,
  earliestDay: () => ({ year: 2020, month: 6, day: 1 }),
  filesForDay: ({ year, month, day }) => {
    const files: string[] = [];
    const prefix = `${year}/${pad(month)}/${pad(day)}`;
    for (const k of Object.keys(fakeFiles)) {
      if (k.startsWith(prefix)) files.push(k);
    }
    return files;
  },
};

function filesWithPrefix(p: string): string[] {
  return Object.keys(fakeFiles).filter((f) => f.startsWith(p));
}

const te = new TextEncoder();
function fileReader(path: string) {
  const str = fakeFiles[path];
  const reader = new Deno.Buffer(te.encode(str));
  return {
    read: reader.read,
    close: () => {},
  };
}

Deno.test("parse an id into a time and a name", () => {
  const d = new Date("2020-07-16T10:10:05Z");
  const parsed = parseId("20200716101005Z-hi.txt");
  delete parsed?.dateParts;
  assertEquals(parsed, {
    name: "hi.txt",
  });
  assertEquals(parseId("not-an-id"), undefined);
});

Deno.test("get a relative file path for an id", () => {
  assertEquals(
    fileForId("20200716101005Z-hi.txt", helper),
    "2020/07/16/101005Z-hi.txt",
  );
  assertEquals(
    fileForId("20200716000000Z-hi.txt", helper),
    "2020/07/16/hi.txt",
  );
});

Deno.test("get an id from a path", () => {
  assertEquals(
    idForFile("2020/07/16/101005Z-hi.txt", helper),
    "20200716101005Z-hi.txt",
  );
  assertEquals(
    idForFile("2020/07/16/hi.txt", helper),
    "20200716000000Z-hi.txt",
  );
});

Deno.test("parse a time into date parts", () => {
  const d = new Date("2020-07-16T10:12:05Z");
  const p = timeToDateParts(d);
  assertEquals(p.year, 2020);
  assertEquals(p.month, 7);
  assertEquals(p.day, 16);
  assertEquals(p.hour, 10);
  assertEquals(p.minute, 12);
  assertEquals(p.second, 5);
});

Deno.test("get a post by id", async () => {
  const id = "20200701000000Z-hello.txt";
  const expectedPath = fileForId(id, helper);
  assert(expectedPath);

  const post = await getPost(id, helper);
  assert(post, "post should exist");
  assertEquals(post.filepath, "2020/07/01/hello.txt");
  assertEquals(
    post.headers.get(PostHeaders.time),
    new Date("2020-07-01T00:00:00Z").toUTCString(),
  );
  assertEquals(post.headers.get(PostHeaders.version), "1");
  assertEquals(post.headers.get(PostHeaders.type), "text/plain");
  const linkHeader = post.headers.get(PostHeaders.link);
  assert(linkHeader);
  const links = LinkHeader.parseLinkHeader(linkHeader);

  const self = links.find((link) => link.rel === "self");
  assert(self);
  assertEquals(self.url, id);
  assertEquals(self.title, "test post");
  const describedByText = links.find(
    (link) => link.rel === "describedby" && link.type === "text/plain",
  );
  assert(describedByText, "should have describedby test");
  assertEquals(describedByText.title, "Description");

  const previousLink = links.find((link) => link.rel === "previous");
  assert(previousLink, "should have a previous link");
  const previous = await getPost(previousLink.url, helper);
  assert(previous, "previous post should exist");

  const prevLinkHeader = previous.headers.get("link");
  // this one should be from a different day
  assert(prevLinkHeader, "previous should have a previous of its own");
  const earlierLink = LinkHeader.parseLinkHeader(prevLinkHeader).find((link) =>
    link.rel === "previous"
  );
  assert(earlierLink, "should be one more earlier, too");

  assert(
    !(await getPost("blah", helper)),
    "shouldn't return anything for a bad id",
  );
});

Deno.test("get first post", async () => {
  const post = await getBefore(undefined, helper);
  assert(post, "first post should exist");
  assertEquals(post.filepath, "2020/07/01/hello.txt");
});

Deno.test("get first post before a date", async () => {
  const d = Date.UTC(2020, 6 - 1, 5);
  const post = await getBefore(d, helper);
  assert(post, "first post before this date should exist");
  assertEquals(post.filepath, "2020/06/01/a.txt");
});
