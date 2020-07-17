export interface Link {
  rel: string;
  url: string;
  [x: string]: string
}

export function parseAttributes(attrs:string) {
  const obj = {}
  return createObjects(obj, attrs)
}

function createObjects(acc: Record<string,string>, p: string) {
  // rel="next" => 1: rel 2: next
  var m = p.match(/\s*(.+)\s*=\s*"?([^"]+)"?/);
  if (m) acc[m[1]] = m[2];
  return acc;
}

function parseLink(link: string): Link | undefined {
  var m = link.match(/<?([^>]*)>(.*)/),
    linkUrl = m && m[1],
    parts = m && m[2] && m[2].split(";");
  if (parts) {
    parts.shift();
    var info = parts.reduce(createObjects, {});
    if (linkUrl) info.url = linkUrl;
    if (!info.url || !info.rel) return
    // @ts-ignore
    return info;
  }
}

export function parseLinkHeader(header?: string): Link[] {
  if (!header) return [];
  // @ts-ignore
  return header.split(/,\s*</).map(parseLink).filter(p => typeof p !== 'undefined');
}

export function stringify(links: Link[]) {
  return links
    .map((link) => {
      const parts: string[] = [`<${link.url}>`];
      for (const k of Object.keys(link).filter(k => k !== 'url')) {
        parts.push(`${k}="${link[k]}`)
      }
      return parts.join("; ");
    })
    .join(", ");
}