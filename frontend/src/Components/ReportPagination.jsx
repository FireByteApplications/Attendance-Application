export default function ReportPagination({ count, page, pageSize, busy = false, onPageChange }) {
  const pageCount = Math.ceil(count / pageSize);
  if (pageCount <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, count);
  return (
    <nav className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3" aria-label="Report pages">
      <span aria-live="polite">Showing {first}–{last} of {count}</span>
      <div className="d-flex align-items-center gap-2">
        <button type="button" className="btn btn-outline-secondary" disabled={busy || page <= 1}
          onClick={() => onPageChange(page - 1)}>Previous</button>
        <span>Page {page} of {pageCount}</span>
        <button type="button" className="btn btn-outline-secondary" disabled={busy || page >= pageCount}
          onClick={() => onPageChange(page + 1)}>Next</button>
      </div>
    </nav>
  );
}
