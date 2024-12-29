import { plainToInstance } from "class-transformer";

export interface ParseSearchQueryOpts {
  supportedSortBy?: string[]
  defaultSort?: string
}

export function parseSearchQuery<T>(query: {[key: string]: string}, DTOClass: new () => T, opts: ParseSearchQueryOpts): T {
  let sort = query.sort;
  if (sort) {
    sort = sort.trim();
    const sortBy = sort.startsWith('-') ? sort.slice(1) : sort;
    if (!opts.supportedSortBy.includes(sortBy)) {
      sort = opts.defaultSort;
    }
  } else {
    sort = opts.defaultSort;
  }

  query.sort = sort;

  return plainToInstance(DTOClass, query);
}
