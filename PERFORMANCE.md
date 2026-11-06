# Phase 3 performance baseline

The frontend loads the landing route immediately and loads other pages on navigation. Moment Timezone is imported only by the two admin report routes, so it stays out of the initial bundle. Bootstrap CSS is bundled locally; the app has no Bootstrap icon or other CDN dependency. The API retains Moment for server-side date handling.

`cd frontend && npm run build` generates a Vite manifest and checks gzipped assets against these budgets (KiB = 1024 bytes):

| Payload | Budget | Current baseline |
| --- | ---: | ---: |
| Initial JavaScript | 90 KiB | 82.7 KiB |
| Initial CSS | 40 KiB | 31.0 KiB |
| Initial JavaScript + CSS | 130 KiB | 113.7 KiB |
| Any non-report route, including initial assets | 145 KiB | 113.9–118.4 KiB |
| Either admin report route, including initial assets | 190 KiB | 176.0–176.2 KiB |

The build fails when a budget is exceeded. These are transfer-size budgets for JavaScript and CSS, not end-to-end load-time targets. Recheck thresholds after intentional design changes and measure real route load times separately. The report routes still load a large Moment Timezone chunk (about 61 KiB gzip); replacing that library is a future optimization if those routes become performance-critical.

Detailed attendance and role reports request 50 records per page. The API accepts `page` and `pageSize` on the report-run endpoints, validates them, and returns `count`, `page`, `pageSize`, and the current records. Legacy callers without pagination keep their existing response shape. Summary attendance reports are aggregated on the server and paged in the browser. Exports continue to include all matching records, subject to their existing limits. Offset paging is capped at 1,000 pages; very large result sets should use narrower filters or a later cursor-based API.

## MongoDB index review

The local `JRFBLogin_Dev` database had only `_id` indexes on `Records` and `Events` when reviewed on 5 November 2026. Six query-specific indexes were then created in that local database. `cd api && npm run review:indexes` compares the configured database with indexes for the date-sorted report pages, event-number attendance lookup, and event lists. It makes no changes. Run `npm run review:indexes -- --apply` to create missing indexes for a different database after reviewing its query plans and write cost. Index creation is deliberately not part of application startup or deployment.

The report filters use case-insensitive regular expressions, which may limit how much a name or role index helps. The proposed report indexes start with `epochTimestamp` to support the bounded date range and stable page order. For Azure Cosmos DB, review RU and indexing policy impact against staging data before applying indexes to production.
