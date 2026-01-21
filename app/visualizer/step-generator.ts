import { getMockTable } from './mock-schema';
import { parseSql } from './sql-parser';
import { JoinPair, QueryStep, VisualizationNode } from './types';

type ColumnRef = {
  column: string;
  table?: string;
};

type JoinClause = {
  type: 'INNER';
  table: string;
  on: {
    left: ColumnRef;
    right: ColumnRef;
  };
};

type FilterClause = {
  column: ColumnRef;
  op: string;
  value: string | number;
};

type OrderByClause = {
  column: ColumnRef;
  direction: 'ASC' | 'DESC';
};

type NormalizedQuery = {
  select: ColumnRef[];
  from: string;
  joins: JoinClause[];
  where?: FilterClause;
  orderBy?: OrderByClause;
  limit?: number;
};

const normalizeColumn = (column: Record<string, unknown>): ColumnRef => {
  return {
    column: String(column.columnid ?? '*'),
    table: column.tableid ? String(column.tableid) : undefined
  };
};

const normalizeStatement = (statement: Record<string, unknown>): NormalizedQuery => {
  const columns = (statement.columns as Record<string, unknown>[] | undefined) ?? [];
  const from = (statement.from as Array<{ tableid?: string }> | undefined)?.[0]?.tableid;

  if (!from) {
    throw new Error('A FROM clause is required for visualization.');
  }

  const joins = ((statement.joins as Array<Record<string, unknown>> | undefined) ?? []).map((join) => {
    const on = join.on as { left?: Record<string, unknown>; right?: Record<string, unknown> } | undefined;
    const left = on?.left ?? {};
    const right = on?.right ?? {};

    return {
      type: 'INNER',
      table: String((join.table as { tableid?: string } | undefined)?.tableid ?? ''),
      on: {
        left: {
          column: String(left.columnid ?? ''),
          table: left.tableid ? String(left.tableid) : undefined
        },
        right: {
          column: String(right.columnid ?? ''),
          table: right.tableid ? String(right.tableid) : undefined
        }
      }
    } satisfies JoinClause;
  });

  const whereExpression = (statement.where as { expression?: Record<string, unknown> } | undefined)?.expression;
  const where = whereExpression
    ? {
        column: {
          column: String((whereExpression.left as Record<string, unknown> | undefined)?.columnid ?? ''),
          table: (whereExpression.left as Record<string, unknown> | undefined)?.tableid
            ? String((whereExpression.left as Record<string, unknown>).tableid)
            : undefined
        },
        op: String(whereExpression.op ?? '='),
        value: (whereExpression.right as { value?: string | number } | undefined)?.value ?? ''
      }
    : undefined;

  const orderExpression = (statement.order as Array<Record<string, unknown>> | undefined)?.[0];
  const orderBy = orderExpression
    ? {
        column: {
          column: String((orderExpression.expression as Record<string, unknown> | undefined)?.columnid ?? ''),
          table: (orderExpression.expression as Record<string, unknown> | undefined)?.tableid
            ? String((orderExpression.expression as Record<string, unknown>).tableid)
            : undefined
        },
        direction: String(orderExpression.direction ?? 'ASC') as 'ASC' | 'DESC'
      }
    : undefined;

  const limitValue = (statement.limit as { value?: number } | undefined)?.value;

  return {
    select: columns.length ? columns.map(normalizeColumn) : [{ column: '*' }],
    from,
    joins,
    where,
    orderBy,
    limit: typeof limitValue === 'number' ? limitValue : undefined
  };
};

const qualifyColumn = (table: string, column: string) => `${table}.${column}`;

const buildQualifiedRows = (table: string) => {
  const source = getMockTable(table);
  const columns = source.columns.map((column) => qualifyColumn(table, column));
  const rows = source.rows.map((row) => {
    const qualifiedRow: Record<string, string | number> = {};

    source.columns.forEach((column) => {
      qualifiedRow[qualifyColumn(table, column)] = row[column];
    });

    return qualifiedRow;
  });

  return { columns, rows };
};

const resolveColumnKey = (row: Record<string, string | number>, column: ColumnRef) => {
  if (column.table) {
    const key = qualifyColumn(column.table, column.column);
    if (key in row) {
      return key;
    }
  }

  if (column.column in row) {
    return column.column;
  }

  const match = Object.keys(row).find((key) => key.endsWith(`.${column.column}`));
  return match ?? column.column;
};

const compareValues = (left: string | number, op: string, right: string | number) => {
  switch (op) {
    case '=':
      return left === right;
    case '!=':
    case '<>':
      return left !== right;
    case '>':
      return left > right;
    case '<':
      return left < right;
    case '>=':
      return left >= right;
    case '<=':
      return left <= right;
    default:
      return left === right;
  }
};

const applyFilter = (rows: Array<Record<string, string | number>>, clause: FilterClause) => {
  const key = (row: Record<string, string | number>) => resolveColumnKey(row, clause.column);
  return rows.filter((row) => compareValues(row[key(row)], clause.op, clause.value));
};

const applyOrder = (
  rows: Array<Record<string, string | number>>,
  clause: OrderByClause
): Array<Record<string, string | number>> => {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    const keyA = resolveColumnKey(a, clause.column);
    const keyB = resolveColumnKey(b, clause.column);
    const valueA = a[keyA];
    const valueB = b[keyB];

    if (valueA === valueB) {
      return 0;
    }

    if (valueA > valueB) {
      return clause.direction === 'ASC' ? 1 : -1;
    }

    return clause.direction === 'ASC' ? -1 : 1;
  });

  return sorted;
};

const applyProjection = (rows: Array<Record<string, string | number>>, columns: ColumnRef[], allColumns: string[]) => {
  if (columns.length === 1 && columns[0].column === '*') {
    return {
      columns: allColumns,
      rows
    };
  }

  const outputColumns = columns.map((column) =>
    column.table ? qualifyColumn(column.table, column.column) : column.column
  );

  const projectedRows = rows.map((row) => {
    const projected: Record<string, string | number> = {};

    columns.forEach((column) => {
      const key = resolveColumnKey(row, column);
      const outputKey = column.table ? qualifyColumn(column.table, column.column) : column.column;
      projected[outputKey] = row[key];
    });

    return projected;
  });

  return {
    columns: outputColumns,
    rows: projectedRows
  };
};

const buildJoinPairs = (
  leftRows: Array<Record<string, string | number>>,
  rightRows: Array<Record<string, string | number>>,
  leftColumn: ColumnRef,
  rightColumn: ColumnRef,
  leftTable: string,
  rightTable: string
): JoinPair[] => {
  return leftRows.map((leftRow, index) => {
    const leftKey = resolveColumnKey(leftRow, leftColumn);
    const leftValue = leftRow[leftKey];
    const match = rightRows.find((rightRow) => {
      const rightKey = resolveColumnKey(rightRow, rightColumn);
      return rightRow[rightKey] === leftValue;
    });

    return {
      id: `pair-${index}`,
      left: `${leftTable}.${leftColumn.column} = ${leftValue}`,
      right: match ? `${rightTable}.${rightColumn.column} = ${match[resolveColumnKey(match, rightColumn)]}` : 'No match',
      matched: Boolean(match)
    };
  });
};

const joinRows = (
  leftRows: Array<Record<string, string | number>>,
  rightRows: Array<Record<string, string | number>>,
  join: JoinClause
) => {
  const joined: Array<Record<string, string | number>> = [];
  const leftColumn = join.on.left;
  const rightColumn = join.on.right;

  leftRows.forEach((leftRow) => {
    const leftKey = resolveColumnKey(leftRow, leftColumn);
    const leftValue = leftRow[leftKey];
    rightRows.forEach((rightRow) => {
      const rightKey = resolveColumnKey(rightRow, rightColumn);
      if (rightRow[rightKey] === leftValue) {
        joined.push({ ...leftRow, ...rightRow });
      }
    });
  });

  return joined;
};

const buildStep = (
  id: string,
  title: string,
  summary: string,
  nodes: VisualizationNode[],
  animationLabel: string,
  animationTargets: string[]
): QueryStep => ({
  id,
  title,
  summary,
  nodes,
  animations: [
    {
      id: `${id}-animation`,
      label: animationLabel,
      style: 'highlight',
      durationMs: 700,
      targetNodeIds: animationTargets
    }
  ]
});

export const generateStepsFromSql = (sql: string): QueryStep[] => {
  const statement = parseSql(sql);
  const normalized = normalizeStatement(statement);

  const steps: QueryStep[] = [];

  const fromTable = getMockTable(normalized.from);
  const sourceNodes: VisualizationNode[] = [
    {
      id: `source-${normalized.from}`,
      label: normalized.from,
      kind: 'table',
      data: {
        columns: fromTable.columns,
        rows: fromTable.rows
      }
    }
  ];

  normalized.joins.forEach((join) => {
    if (!join.table) {
      return;
    }

    const joinTable = getMockTable(join.table);
    sourceNodes.push({
      id: `source-${join.table}`,
      label: join.table,
      kind: 'table',
      data: {
        columns: joinTable.columns,
        rows: joinTable.rows
      }
    });
  });

  steps.push(
    buildStep(
      'step-sources',
      '1. Load source tables',
      `Load ${sourceNodes.map((node) => node.label).join(' and ')}.`,
      sourceNodes,
      'Highlight input tables',
      sourceNodes.map((node) => node.id)
    )
  );

  let current = buildQualifiedRows(normalized.from);

  normalized.joins.forEach((join, index) => {
    if (!join.table) {
      return;
    }

    const right = buildQualifiedRows(join.table);
    const joinedRows = joinRows(current.rows, right.rows, join);
    const pairs = buildJoinPairs(
      current.rows,
      right.rows,
      join.on.left,
      join.on.right,
      join.on.left.table ?? normalized.from,
      join.on.right.table ?? join.table
    );

    const nodeId = `join-output-${index}`;
    const joinNode: VisualizationNode = {
      id: nodeId,
      label: `Join output ${index + 1}`,
      kind: 'join',
      detail: `${join.on.left.table ?? normalized.from}.${join.on.left.column} = ${
        join.on.right.table ?? join.table
      }.${join.on.right.column}`,
      data: {
        columns: [...current.columns, ...right.columns],
        rows: joinedRows
      },
      pairs
    };

    steps.push(
      buildStep(
        `step-join-${index + 1}`,
        `${steps.length + 1}. Match rows (INNER JOIN)`,
        `Match rows on ${joinNode.detail}.`,
        [joinNode],
        'Animate join pairing',
        [nodeId]
      )
    );

    current = {
      columns: [...current.columns, ...right.columns],
      rows: joinedRows
    };
  });

  if (normalized.where) {
    const filteredRows = applyFilter(current.rows, normalized.where);
    const filterNode: VisualizationNode = {
      id: 'filtered-rows',
      label: 'Filtered rows',
      kind: 'filter',
      data: {
        columns: current.columns,
        rows: filteredRows
      }
    };

    steps.push(
      buildStep(
        'step-filter',
        `${steps.length + 1}. Apply WHERE`,
        `Keep rows where ${normalized.where.column.column} ${normalized.where.op} ${normalized.where.value}.`,
        [filterNode],
        'Highlight retained rows',
        [filterNode.id]
      )
    );

    current = {
      columns: current.columns,
      rows: filteredRows
    };
  }

  if (normalized.orderBy) {
    const sortedRows = applyOrder(current.rows, normalized.orderBy);
    const sortNode: VisualizationNode = {
      id: 'sorted-rows',
      label: 'Sorted rows',
      kind: 'sort',
      data: {
        columns: current.columns,
        rows: sortedRows
      }
    };

    steps.push(
      buildStep(
        'step-order',
        `${steps.length + 1}. Apply ORDER BY`,
        `Order by ${normalized.orderBy.column.column} (${normalized.orderBy.direction}).`,
        [sortNode],
        'Highlight sorted rows',
        [sortNode.id]
      )
    );

    current = {
      columns: current.columns,
      rows: sortedRows
    };
  }

  if (typeof normalized.limit === 'number') {
    const limitedRows = current.rows.slice(0, normalized.limit);
    const limitNode: VisualizationNode = {
      id: 'limited-rows',
      label: 'Limited rows',
      kind: 'limit',
      data: {
        columns: current.columns,
        rows: limitedRows
      }
    };

    steps.push(
      buildStep(
        'step-limit',
        `${steps.length + 1}. Apply LIMIT`,
        `Keep the first ${normalized.limit} rows.`,
        [limitNode],
        'Highlight limited rows',
        [limitNode.id]
      )
    );

    current = {
      columns: current.columns,
      rows: limitedRows
    };
  }

  const projection = applyProjection(current.rows, normalized.select, current.columns);
  const projectionNode: VisualizationNode = {
    id: 'projection-output',
    label: 'Final result',
    kind: 'projection',
    data: projection
  };

  steps.push(
    buildStep(
      'step-projection',
      `${steps.length + 1}. Project columns`,
      'Select the output columns for the final result set.',
      [projectionNode],
      'Reveal projected columns',
      [projectionNode.id]
    )
  );

  return steps;
};
