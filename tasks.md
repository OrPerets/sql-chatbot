# /visualizer enhancements

1. Validate SQL when the user edits the query
- Add validation that runs whenever the SQL text is changed.
- Show a clear inline error message if the query is invalid (syntax or unsupported structure).
- Disable query execution/visualization actions until the SQL is valid.

2. Create a small demo database for visualization
- Build a sample database (for the visualizer context) with 2-3 related tables.
- Include realistic relations (for example: `customers`, `orders`, `products`).
- Seed each table with a small amount of test data so queries produce meaningful results.

3. Add a "הצג בסיס נתונים" button with popup details
- Add a button labeled exactly: `הצג בסיס נתונים`.
- On click, open a popup/modal that displays:
  - Database name
  - List of tables
  - For each table: columns/schema + a small sample of rows
- Ensure the popup is readable and works well on desktop and mobile.
