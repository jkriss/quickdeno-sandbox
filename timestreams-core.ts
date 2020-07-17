import * as LinkHeader from "./link.ts";

export interface TimeAndName {
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
  filepath: string;
}

export enum PostHeaders {
  type = "Content-Type",
  time = "Post-Time",
  version = "Time-Streams-Version",
  link = "Link",
}

export interface TimestreamFileHelper {
  // dirExists(path: string): boolean;
  earliestDay(): DateParts | Promise<DateParts>;
  fileExists(path: string): boolean | Promise<boolean>;
  filesWithPrefix(path: string): string[] | Promise<string[]>;
  filesForDay(d: DateParts): string[] | Promise<string[]>;
  separator?: string;
  fileText(path: string): string | undefined | Promise<string | undefined>;
  typeForExtension(ext: string): string;
}

const timePatternStr = `(\\d{2})(\\d{2})(\\d{2})Z`;
const timePattern = new RegExp(timePatternStr);
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
    return {
      name,
      dateParts,
    };
  } else {
    return undefined;
  }
}

export function fileForId(
  id: string,
  helper: TimestreamFileHelper,
): string | undefined {
  const timeAndName = parseId(id);
  if (!timeAndName) return undefined;
  return fileForMeta(timeAndName, helper);
}

export function pad(n: number | undefined) {
  return n ? n.toString().padStart(2, "0") : "00";
}

function compactDay({ year, month, day }: DateParts): string {
  return `${year}${pad(month)}${pad(day)}`;
}

export function fileForMeta(
  meta: TimeAndName,
  helper: TimestreamFileHelper,
): string | undefined {
  const sep = helper?.separator || "/";
  const { year, month, day, hour, minute, second } = meta.dateParts;
  let str = [year, pad(month), pad(day), ""].join(sep);
  if (hour || minute || second) {
    str += `${pad(hour)}${pad(minute)}${pad(second)}Z-`;
  }
  str += meta.name;
  return str;
}

export function idForMeta(
  meta: TimeAndName,
  helper: TimestreamFileHelper,
): string {
  const { year, month, day, hour, minute, second } = meta.dateParts;
  return `${year}${pad(month)}${pad(day)}${pad(hour)}${pad(minute)}${
    pad(second)
  }Z-${meta.name}`;
}

export function idForFile(
  path: string,
  helper: TimestreamFileHelper,
): string | undefined {
  const sep = helper.separator || "/";
  const re = new RegExp(`^(\\d{4})${sep}(\\d{2})${sep}(\\d{2})${sep}(.*)`);
  const m = path.match(re);
  if (m) {
    const [_all, year, month, day, rest] = m;
    let name = rest;
    const dateParts = {
      year: parseInt(year),
      month: parseInt(month),
      day: parseInt(day),
      hour: 0,
      minute: 0,
      second: 0,
    };
    const timeMatch = rest.match(timePattern);
    if (timeMatch) {
      const [all, hour, minute, second] = timeMatch;
      dateParts.hour = parseInt(hour);
      dateParts.minute = parseInt(minute);
      dateParts.second = parseInt(second);

      name = rest.slice(all.length + 1); // plus the - delimiter
    }
    return idForMeta({ dateParts, name }, helper);
  }
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
  const otherFiles = files
    .filter((p) => p !== path)
    .sort(function (a, b) {
      return a.localeCompare(b);
    });

  for (const f of otherFiles) {
    const suffix = f.split("$")[1];
    if (!suffix) continue;
    const [first, second, third] = suffix.split(".");
    // special case for self attributes
    if (first === "self") {
      if (second === "attributes") {
        const content = await helper.fileText(f);
        if (content) {
          const attrs = LinkHeader.parseAttributes(content);
          Object.assign(self, attrs);
        }
      }
    } else if (first && second) {
      if (!third) {
        // this is a rel with an alternate format
        // it may also have a .attributes file
        const rel = first;
        const ext = second;
        const type = helper.typeForExtension("." + ext);
        const link: LinkHeader.Link = {
          rel,
          url: `${id}$${suffix}`,
        };
        if (type) link.type = type;
        links.push(link);
      } else if (third === "attributes") {
        // add these attributes to an existing rel
        const ext = second;
        const link = links.find(
          (link) =>
            link.rel === first &&
            link.type === helper.typeForExtension("." + ext),
        );
        if (link) {
          const content = await helper.fileText(f);
          if (content) {
            Object.assign(link, LinkHeader.parseAttributes(content));
          }
        }
      }
    }
  }

  return links;
}

// add tests just for this
export function subtractDay({ year, month, day }: DateParts): DateParts {
  if (day > 1) {
    return { year, month, day: day - 1 };
  } else if (month > 1) {
    // this might not be a real date, but that's ok
    return { year, month: month - 1, day: 31 };
  } else {
    return { year: year - 1, month: 12, day: 31 };
  }
}

export async function getFilesOnDateOrBefore(
  date: DateParts,
  helper: TimestreamFileHelper,
): Promise<string[]> {
  const minDate = await helper.earliestDay();
  const minDateStr = compactDay(minDate);
  let dayFiles: string[] = [];
  while (dayFiles.length === 0 && compactDay(date) >= minDateStr) {
    dayFiles = await helper.filesForDay(date);
    date = subtractDay(date);
  }
  return dayFiles.sort(function (a, b) {
    return a.localeCompare(b);
  });
}

export async function getPreviousId(
  meta: TimeAndName,
  helper: TimestreamFileHelper,
): Promise<string | undefined> {
  // get any with the same date, filter out $ files, filter out this prefix,
  // see if there are any after it lexigraphically
  let sameDayFiles = await getFilesOnDateOrBefore(meta.dateParts, helper);
  sameDayFiles = sameDayFiles.filter((f) => !f.includes("$"));
  const thisFile = fileForMeta(meta, helper);
  let foundThisFile = false;
  let path: string | undefined;
  for (const f of sameDayFiles) {
    // if we found a the file on the last iteration,
    // now we're on the next in the list
    if (foundThisFile) {
      path = f;
      break;
    }
    if (f === thisFile) foundThisFile = true;
  }
  if (!path) {
    // if not, get files for the next earliest date, return the first non $
    let earlierFiles = await getFilesOnDateOrBefore(
      subtractDay(meta.dateParts),
      helper,
    );
    earlierFiles = earlierFiles.filter((f) => !f.includes("$"));
    path = earlierFiles[0];
  }
  return path ? idForFile(path, helper) : undefined;
}

export async function getPost(
  id: string,
  helper: TimestreamFileHelper,
): Promise<Post | undefined> {
  const meta = parseId(id);
  if (!meta) return;
  const p = fileForMeta(meta, helper);
  if (!p) return undefined;
  if (helper.fileExists(p)) {
    const headers = new Headers();
    headers.set(
      PostHeaders.time,
      new Date(toUTC(meta.dateParts)).toUTCString(),
    );
    headers.set(PostHeaders.version, "1");
    const extMatch = p.match(/\.\w+$/);
    const ext = extMatch ? extMatch[0] : undefined;
    const type = ext && helper.typeForExtension(ext) ||
      "application/octet-stream";
    headers.set(PostHeaders.type, type);
    const links = await makeLinks({ id, type, path: p, helper });
    const previousId = await getPreviousId(meta, helper);
    if (previousId) {
      links.push({
        rel: "previous",
        url: previousId,
      });
    }
    headers.set(PostHeaders.link, LinkHeader.stringify(links));

    return {
      headers,
      filepath: p,
    };
  }
}
