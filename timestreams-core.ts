import * as LinkHeader from "./link.ts";

export interface TimeAndName {
  time: number;
  dateParts: DateParts;
  name: string;
}

export interface DateParts {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}

export interface Post {
  headers: Headers;
  getReader(): Promise<Deno.Reader & Deno.Closer>;
}

export enum PostHeaders {
  type = "Content-Type",
  time = "Post-Time",
  version = "Time-Streams-Version",
  link = "Link",
}

export interface TimestreamFileHelper {
  // dirExists(path: string): boolean;
  // earliestYear(): number;
  fileExists(path: string): boolean | Promise<boolean>;
  filesWithPrefix(path: string): string[] | Promise<string[]>;
  separator?: string;
  fileReader(
    path: string
  ): (Deno.Reader & Deno.Closer) | Promise<Deno.Reader & Deno.Closer>;
  fileText(path:string): string | undefined | Promise<string|undefined>
  typeForExtension(ext: string): string;
}

const timePatternStr = `(\\d{2})(\\d{2})(\\d{2})Z`;
const compactDayPatternStr = `(\\d{4})(\\d{2})(\\d{2})`;
const idPattern = new RegExp(`${compactDayPatternStr}${timePatternStr}-(.*)`);

export function toDateParts(parts: (string | number)[]): DateParts {
  const [
    year,
    month,
    day,
    hour,
    minute,
    second,
  ] = parts.map((s: string | number) =>
    typeof s === "string" ? parseInt(s) : s
  );
  return { year, month, day, hour, minute, second };
}

export function timeToDateParts(d: number | Date): DateParts {
  const time = typeof d === "number" ? new Date(d) : d;
  return {
    year: time.getUTCFullYear(),
    month: time.getUTCMonth() + 1,
    day: time.getUTCDate(),
    hour: time.getUTCHours(),
    minute: time.getUTCMinutes(),
    second: time.getUTCSeconds(),
  };
}

export function toUTC({
  year,
  month,
  day,
  hour,
  minute,
  second,
}: DateParts): number {
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

export function parseId(id: string): TimeAndName | undefined {
  const m = id.match(idPattern);
  if (m) {
    m.shift();
    const name = m.pop();
    if (!name) return undefined;
    const dateParts = toDateParts(m);
    const time = toUTC(dateParts);
    return {
      time,
      name,
      dateParts,
    };
  } else {
    return undefined;
  }
}

export function fileForId(id: string): string | undefined {
  const timeAndName = parseId(id);
  if (!timeAndName) return undefined;
  return fileForMeta(timeAndName);
}

function pad(n: number | undefined) {
  return n ? n.toString().padStart(2, "0") : "00";
}

export function fileForMeta(
  meta: TimeAndName,
  helper?: TimestreamFileHelper
): string | undefined {
  const sep = helper?.separator || "/";
  const { year, month, day, hour, minute, second } = meta.dateParts;
  let str = [year, pad(month), pad(day), ""].join(sep);
  if (hour || minute || second)
    str += `${pad(hour)}${pad(minute)}${pad(second)}Z-`;
  str += meta.name;
  return str;
}

export async function makeLinks({
  id,
  type,
  path,
  helper,
}: {
  id: string;
  type: string;
  path: string;
  helper: TimestreamFileHelper;
}): Promise<LinkHeader.Link[]> {
  const links: LinkHeader.Link[] = [];
  const self = {
    rel: "self",
    url: id,
    type,
  };
  links.push(self);
  const files = await helper.filesWithPrefix(path);
  // filter out the file itself, sort lexicographically
  const otherFiles = files.filter((p) => p !== path).sort(function (a, b) {
    return a.localeCompare(b);
  });

  for (const f of otherFiles) {
    const suffix = f.split('$')[1]
    const [first, second, third] = suffix.split('.')
    // special case for self attributes
    if (first === 'self') {
      if (second === 'attributes') {
        const content = await helper.fileText(f)
        if (content) {
          const attrs = LinkHeader.parseAttributes(content)
          Object.assign(self, attrs)
        }
      }
    } else if (first && second) {
      if (!third) {
        // this is a rel with an alternate format
        // it may also have a .attributes file
        const rel = first
        const ext = second
        links.push({
          rel,
          type: helper.typeForExtension('.'+ext),
          url: `${id}$${suffix}`
        })
      } else if (third === 'attributes') {
        // add these attributes to an existing rel
        const ext = second
        const link = links.find(link => link.rel === first && link.type === helper.typeForExtension('.'+ext))
        if (link) {
          const content = await helper.fileText(f)
          if (content) {
            Object.assign(link, LinkHeader.parseAttributes(content))
          }
        }
      }
    }
  }

  return links;
}

export async function getPost(
  id: string,
  helper: TimestreamFileHelper
): Promise<Post | undefined> {
  const meta = parseId(id);
  if (!meta) return;
  const p = fileForMeta(meta, helper);
  if (!p) return undefined;
  if (helper.fileExists(p)) {
    const headers = new Headers();
    headers.set(
      PostHeaders.time,
      new Date(toUTC(meta.dateParts)).toUTCString()
    );
    headers.set(PostHeaders.version, "1");
    const extMatch = p.match(/\.\w+$/);
    const ext = extMatch ? extMatch[0] : undefined;
    const type = ext
      ? helper.typeForExtension(ext)
      : "application/octet-stream";
    headers.set(PostHeaders.type, type);
    const links = await makeLinks({ id, type, path: p, helper });
    // TODO get previous
    headers.set(PostHeaders.link, LinkHeader.stringify(links));

    return {
      headers,
      getReader: async () => helper.fileReader(p),
    };
  }
}
