export const REPORT_PAGE_SIZE = 50;

export function pageSlice(rows, page, pageSize = REPORT_PAGE_SIZE) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const totalPages = Math.max(1, Math.ceil(safeRows.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  return safeRows.slice(start, start + pageSize);
}
