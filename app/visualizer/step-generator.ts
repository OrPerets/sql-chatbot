import { getMockTable } from './mock-schema';
import { parseSql } from './sql-parser';
import { GlossaryHint, JoinPair, LearningPrompt, QueryStep, VisualizationNode } from './types';

const GLOSSARY: Record<string, string> = {
  SELECT: 'Chooses which columns or expressions appear in the final result.',
  FROM: 'Defines the source tables or subqueries used by the query.',
  WHERE: 'Filters rows before grouping or projection.',
  'INNER JOIN': 'Keeps only rows where the join condition matches.',
  'LEFT JOIN': 'Keeps all rows from the left table and matching rows from the right table.',
  'RIGHT JOIN': 'Keeps all rows from the right table and matching rows from the left table.',
  'FULL JOIN': 'Keeps rows from both tables, matching when possible.',
  'CROSS JOIN': 'Pairs every row from the left with every row from the right.',
  ON: 'Specifies the join condition that matches rows between tables.',
  'GROUP BY': 'Groups rows so aggregates can be computed per group.',
  HAVING: 'Filters groups after aggregation.',
  'ORDER BY': 'Sorts the result set by one or more columns.',
  LIMIT: 'Restricts the number of rows returned.',
  UNION: 'Combines results and removes duplicates.',
  INTERSECT: 'Keeps only rows that appear in both result sets.',
  EXCEPT: 'Keeps rows from the left result that are not in the right result.',
  CTE: 'Common Table Expression; a named subquery defined with WITH.',
  SUBQUERY: 'A nested query used as a data source.',
  INSERT: 'Adds new rows to a table.',
  UPDATE: 'Modifies existing rows in a table.',
  DELETE: 'Removes rows from a table.',
  AGGREGATE: 'Calculations like COUNT, SUM, or AVG over groups of rows.'
};

const buildGlossary = (terms: string[]): GlossaryHint[] => {
  const seen = new Set<string>();
  return terms
    .filter((term) => {
      if (seen.has(term)) {
        return false;
      }
      seen.add(term);
      return Boolean(GLOSSARY[term]);
    })
    .map((term) => ({
      term,
      definition: GLOSSARY[term]
    }));
};

type ColumnRef = {
  kind: 'column';
  column: string;
  table?: string;
};

type AggregateRef = {
  kind: 'aggregate';
  fn: string;
  column: string;
  table?: string;
  alias?: string;
};

type SelectItem = ColumnRef | AggregateRef;

type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';

type JoinClause = {
  type: JoinType;
  table: string;
  on?: {
    left: ColumnRef;
    right: ColumnRef;
  };
};

type FilterClause = {
  left: ColumnRef | AggregateRef;
  op: string;
  value: string | number;
};

type OrderByClause = {
  column: ColumnRef;
  direction: 'ASC' | 'DESC';
};

type TableSource = {
  name: string;
  kind: 'table' | 'cte' | 'subquery';
  query?: NormalizedQuery;
};

type SetOperation = {
  type: 'UNION' | 'INTERSECT' | 'EXCEPT';
  right: NormalizedQuery;
};

type NormalizedQuery = {
  select: SelectItem[];
  from: TableSource;
  joins: JoinClause[];
  where?: FilterClause;
  groupBy?: ColumnRef[];
  having?: FilterClause;
  orderBy?: OrderByClause;
  limit?: number;
  setOperation?: SetOperation;
};

type TableData = {
  columns: string[];
  rows: Array<Record<string, string | number>>;
};

const normalizeColumnRef = (column: Record<string, unknown>): ColumnRef => {
  return {
    kind: 'column',
    column: String(column.columnid ?? '*'),
    table: column.tableid ? String(column.tableid) : undefined
  };
};

const normalizeSelectItem = (column: Record<string, unknown>): SelectItem => {
  if (column.aggregatorid) {
    const expression = (column.expression as Record<string, unknown> | undefined) ?? {};

    return {
      kind: 'aggregate',
      fn: String(column.aggregatorid),
      column: String(expression.columnid ?? '*'),
      table: expression.tableid ? String(expression.tableid) : undefined,
      alias: column.as ? String(column.as) : undefined
    } satisfies AggregateRef;
  }

  return normalizeColumnRef(column);
};

const normalizePredicate = (expression?: Record<string, unknown>): FilterClause | undefined => {
  if (!expression) {
    return undefined;
  }

  const leftExpression = expression.left as Record<string, unknown> | undefined;

  if (!leftExpression) {
    return undefined;
  }

  const left = leftExpression.aggregatorid
    ? normalizeSelectItem(leftExpression)
    : normalizeColumnRef(leftExpression);

  return {
    left,
    op: String(expression.op ?? '='),
    value: (expression.right as { value?: string | number } | undefined)?.value ?? ''
  };
};

const normalizeFromClause = (fromClause: Record<string, unknown> | undefined): TableSource => {
  if (!fromClause) {
    throw new Error('A FROM clause is required for visualization.');
  }

  if (fromClause.tableid) {
    return {
      name: String(fromClause.tableid),
      kind: 'table'
    };
  }

  const alias = fromClause.as ? String(fromClause.as) : 'Subquery';
  return {
    name: alias,
    kind: 'subquery',
    query: normalizeStatement(fromClause)
  };
};

const normalizeStatement = (statement: Record<string, unknown>): NormalizedQuery => {
  const baseStatement = (statement.select as Record<string, unknown> | undefined) ?? statement;
  const columns = (baseStatement.columns as Record<string, unknown>[] | undefined) ?? [];
  const from = normalizeFromClause((baseStatement.from as Array<Record<string, unknown>> | undefined)?.[0]);

  const joins = ((baseStatement.joins as Array<Record<string, unknown>> | undefined) ?? []).map((join) => {
    const joinMode = String(join.joinmode ?? 'INNER').toUpperCase();
    const joinType: JoinType = joinMode === 'LEFT'
      ? 'LEFT'
      : joinMode === 'RIGHT'
        ? 'RIGHT'
        : joinMode === 'OUTER'
          ? 'FULL'
          : joinMode === 'CROSS'
            ? 'CROSS'
            : 'INNER';

    const on = join.on as { left?: Record<string, unknown>; right?: Record<string, unknown> } | undefined;
    const left = on?.left ?? {};
    const right = on?.right ?? {};

    return {
      type: joinType,
      table: String((join.table as { tableid?: string } | undefined)?.tableid ?? ''),
      on: joinType === 'CROSS'
        ? undefined
        : {
            left: normalizeColumnRef(left),
            right: normalizeColumnRef(right)
          }
    } satisfies JoinClause;
  });

  const whereExpression = (baseStatement.where as { expression?: Record<string, unknown> } | undefined)?.expression;
  const where = normalizePredicate(whereExpression);

  const groupBy = ((baseStatement.group as Array<Record<string, unknown>> | undefined) ?? []).map((group) =>
    normalizeColumnRef(group)
  );

  const havingExpression = baseStatement.having as Record<string, unknown> | undefined;
  const having = normalizePredicate(havingExpression);

  const orderExpression = (baseStatement.order as Array<Record<string, unknown>> | undefined)?.[0];
  const orderBy = orderExpression
    ? {
        column: normalizeColumnRef((orderExpression.expression as Record<string, unknown> | undefined) ?? {}),
        direction: String(orderExpression.direction ?? 'ASC') as 'ASC' | 'DESC'
      }
    : undefined;

  const limitValue = (baseStatement.limit as { value?: number } | undefined)?.value;

  const union = baseStatement.union as Record<string, unknown> | undefined;
  const intersect = baseStatement.intersect as Record<string, unknown> | undefined;
  const except = baseStatement.except as Record<string, unknown> | undefined;

  const setOperation: SetOperation | undefined = union
    ? { type: 'UNION', right: normalizeStatement(union) }
    : intersect
      ? { type: 'INTERSECT', right: normalizeStatement(intersect) }
      : except
        ? { type: 'EXCEPT', right: normalizeStatement(except) }
        : undefined;

  return {
    select: columns.length ? columns.map(normalizeSelectItem) : [{ kind: 'column', column: '*' }],
    from,
    joins,
    where,
    groupBy: groupBy.length ? groupBy : undefined,
    having,
    orderBy,
    limit: typeof limitValue === 'number' ? limitValue : undefined,
    setOperation
  };
};

const qualifyColumn = (table: string, column: string) => `${table}.${column}`;

const getSelectItemLabel = (item: SelectItem) => {
  if (item.kind === 'column') {
    return item.table ? qualifyColumn(item.table, item.column) : item.column;
  }

  const columnLabel = item.column === '*'
    ? '*'
    : item.table
      ? qualifyColumn(item.table, item.column)
      : item.column;
  return item.alias ?? `${item.fn.toUpperCase()}(${columnLabel})`;
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

const getRowValue = (row: Record<string, string | number>, item: ColumnRef | AggregateRef) => {
  if (item.kind === 'column') {
    const key = resolveColumnKey(row, item);
    return row[key];
  }

  const label = getSelectItemLabel(item);
  return row[label];
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
  return rows.filter((row) => {
    const value = getRowValue(row, clause.left);
    return compareValues(value, clause.op, clause.value);
  });
};

const buildFilterStates = (rows: Array<Record<string, string | number>>, clause: FilterClause) => {
  return rows.map((row) => (compareValues(getRowValue(row, clause.left), clause.op, clause.value) ? 'kept' : 'filtered'));
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

const applyProjection = (rows: Array<Record<string, string | number>>, columns: SelectItem[], allColumns: string[]) => {
  if (columns.length === 1 && columns[0].kind === 'column' && columns[0].column === '*') {
    return {
      columns: allColumns,
      rows
    };
  }

  const outputColumns = columns.map(getSelectItemLabel);

  const projectedRows = rows.map((row) => {
    const projected: Record<string, string | number> = {};

    columns.forEach((column) => {
      const outputKey = getSelectItemLabel(column);
      projected[outputKey] = getRowValue(row, column);
    });

    return projected;
  });

  return {
    columns: outputColumns,
    rows: projectedRows
  };
};

const getTableData = (source: TableSource, cteRegistry: Map<string, TableData>): TableData => {
  if (source.kind === 'cte') {
    const table = cteRegistry.get(source.name);
    if (!table) {
      throw new Error(`No CTE registered for ${source.name}.`);
    }
    return table;
  }

  if (source.kind === 'subquery') {
    if (!source.query) {
      throw new Error(`No subquery data available for ${source.name}.`);
    }

    return buildQueryOutput(source.query, cteRegistry);
  }

  const table = getMockTable(source.name);
  return {
    columns: table.columns,
    rows: table.rows
  };
};

const buildQualifiedRows = (source: TableSource, cteRegistry: Map<string, TableData>) => {
  const sourceData = getTableData(source, cteRegistry);
  const columns = sourceData.columns.map((column) => qualifyColumn(source.name, column));
  const rows = sourceData.rows.map((row) => {
    const qualifiedRow: Record<string, string | number> = {};

    sourceData.columns.forEach((column) => {
      qualifiedRow[qualifyColumn(source.name, column)] = row[column];
    });

    return qualifiedRow;
  });

  return { columns, rows };
};

const buildEmptyRow = (columns: string[]) => {
  const row: Record<string, string> = {};
  columns.forEach((column) => {
    row[column] = '∅';
  });
  return row;
};

const joinRows = (
  leftRows: Array<Record<string, string | number>>,
  rightRows: Array<Record<string, string | number>>,
  join: JoinClause,
  leftColumns: string[],
  rightColumns: string[]
) => {
  const joined: Array<Record<string, string | number>> = [];
  const rowStates: Array<'matched' | 'unmatched'> = [];

  if (join.type === 'CROSS') {
    leftRows.forEach((leftRow) => {
      rightRows.forEach((rightRow) => {
        joined.push({ ...leftRow, ...rightRow });
        rowStates.push('matched');
      });
    });

    return { rows: joined, rowStates };
  }

  const leftColumn = join.on?.left;
  const rightColumn = join.on?.right;

  if (!leftColumn || !rightColumn) {
    return { rows: joined, rowStates };
  }

  const matchedRightIndexes = new Set<number>();

  leftRows.forEach((leftRow) => {
    const leftKey = resolveColumnKey(leftRow, leftColumn);
    const leftValue = leftRow[leftKey];
    let hasMatch = false;

    rightRows.forEach((rightRow, rightIndex) => {
      const rightKey = resolveColumnKey(rightRow, rightColumn);
      if (rightRow[rightKey] === leftValue) {
        joined.push({ ...leftRow, ...rightRow });
        rowStates.push('matched');
        matchedRightIndexes.add(rightIndex);
        hasMatch = true;
      }
    });

    if (!hasMatch && (join.type === 'LEFT' || join.type === 'FULL')) {
      joined.push({ ...leftRow, ...buildEmptyRow(rightColumns) });
      rowStates.push('unmatched');
    }
  });

  if (join.type === 'RIGHT' || join.type === 'FULL') {
    rightRows.forEach((rightRow, rightIndex) => {
      if (!matchedRightIndexes.has(rightIndex)) {
        joined.push({ ...buildEmptyRow(leftColumns), ...rightRow });
        rowStates.push('unmatched');
      }
    });
  }

  return { rows: joined, rowStates };
};

const buildJoinPairs = (
  leftRows: Array<Record<string, string | number>>,
  rightRows: Array<Record<string, string | number>>,
  join: JoinClause,
  leftTable: string,
  rightTable: string
): JoinPair[] => {
  if (join.type === 'CROSS' || !join.on) {
    return leftRows.slice(0, 3).map((_, index) => {
      const rightIndex = rightRows.length ? index % rightRows.length : 0;
      return {
        id: `pair-${index}`,
        left: `${leftTable} row ${index + 1}`,
        right: rightRows.length ? `${rightTable} row ${rightIndex + 1}` : 'No rows',
        matched: true
      };
    });
  }

  const pairs: JoinPair[] = [];
  const rightMatched = new Set<number>();

  leftRows.forEach((leftRow, index) => {
    const leftKey = resolveColumnKey(leftRow, join.on!.left);
    const leftValue = leftRow[leftKey];
    const matchIndex = rightRows.findIndex((rightRow) => {
      const rightKey = resolveColumnKey(rightRow, join.on!.right);
      return rightRow[rightKey] === leftValue;
    });

    if (matchIndex >= 0) {
      const rightRow = rightRows[matchIndex];
      const rightKey = resolveColumnKey(rightRow, join.on!.right);
      rightMatched.add(matchIndex);
      pairs.push({
        id: `pair-${index}`,
        left: `${leftTable}.${join.on!.left.column} = ${leftValue}`,
        right: `${rightTable}.${join.on!.right.column} = ${rightRow[rightKey]}`,
        matched: true
      });
    } else {
      pairs.push({
        id: `pair-${index}`,
        left: `${leftTable}.${join.on!.left.column} = ${leftValue}`,
        right: 'No match',
        matched: false
      });
    }
  });

  if (join.type === 'RIGHT' || join.type === 'FULL') {
    rightRows.forEach((rightRow, index) => {
      if (!rightMatched.has(index)) {
        const rightKey = resolveColumnKey(rightRow, join.on!.right);
        pairs.push({
          id: `pair-right-${index}`,
          left: 'No match',
          right: `${rightTable}.${join.on!.right.column} = ${rightRow[rightKey]}`,
          matched: false
        });
      }
    });
  }

  return pairs;
};

const applyAggregation = (rows: Array<Record<string, string | number>>, select: SelectItem[], groupBy: ColumnRef[]) => {
  const groups = new Map<string, { rows: Array<Record<string, string | number>>; keys: Record<string, string | number> }>();

  rows.forEach((row) => {
    const keyValues: Record<string, string | number> = {};
    const keyParts = groupBy.map((column) => {
      const key = resolveColumnKey(row, column);
      const value = row[key];
      keyValues[getSelectItemLabel(column)] = value;
      return String(value);
    });

    const groupKey = keyParts.join('|');
    const group = groups.get(groupKey) ?? { rows: [], keys: keyValues };
    group.rows.push(row);
    groups.set(groupKey, group);
  });

  const aggregateRows: Array<Record<string, string | number>> = [];

  groups.forEach((group) => {
    const aggregateRow: Record<string, string | number> = {};

    select.forEach((item) => {
      if (item.kind === 'column') {
        const label = getSelectItemLabel(item);
        aggregateRow[label] = group.keys[label];
        return;
      }

      const values = group.rows.map((row) => {
        if (item.column === '*') {
          return 1;
        }
        const key = resolveColumnKey(row, { kind: 'column', column: item.column, table: item.table });
        return row[key];
      });

      const numericValues = values.map((value) => Number(value)).filter((value) => !Number.isNaN(value));
      let aggregateValue: number = 0;
      const fn = item.fn.toUpperCase();

      if (fn === 'COUNT') {
        aggregateValue = values.length;
      } else if (fn === 'SUM') {
        aggregateValue = numericValues.reduce((sum, value) => sum + value, 0);
      } else if (fn === 'AVG') {
        aggregateValue = numericValues.length
          ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
          : 0;
      } else if (fn === 'MIN') {
        aggregateValue = numericValues.length ? Math.min(...numericValues) : 0;
      } else if (fn === 'MAX') {
        aggregateValue = numericValues.length ? Math.max(...numericValues) : 0;
      }

      aggregateRow[getSelectItemLabel(item)] = aggregateValue;
    });

    aggregateRows.push(aggregateRow);
  });

  if (!aggregateRows.length && groupBy.length === 0) {
    const emptyRow: Record<string, string | number> = {};
    select.forEach((item) => {
      emptyRow[getSelectItemLabel(item)] = item.kind === 'aggregate' && item.fn.toUpperCase() === 'COUNT' ? 0 : 0;
    });
    return { columns: select.map(getSelectItemLabel), rows: [emptyRow] };
  }

  return {
    columns: select.map(getSelectItemLabel),
    rows: aggregateRows
  };
};

const applyHaving = (rows: Array<Record<string, string | number>>, clause: FilterClause) => {
  return rows.filter((row) => {
    const value = getRowValue(row, clause.left);
    return compareValues(value, clause.op, clause.value);
  });
};

const applySetOperation = (left: TableData, right: TableData, type: SetOperation['type']): TableData => {
  const leftRows = left.rows;
  const rightRows = right.rows.map((row) => {
    const rowValues = right.columns.map((column) => row[column]);
    const aligned: Record<string, string | number> = {};

    left.columns.forEach((column, index) => {
      aligned[column] = rowValues[index] ?? '';
    });

    return aligned;
  });

  const serialize = (row: Record<string, string | number>) =>
    JSON.stringify(left.columns.map((column) => row[column]));

  const leftSet = new Map(leftRows.map((row) => [serialize(row), row]));
  const rightSet = new Map(rightRows.map((row) => [serialize(row), row]));

  if (type === 'UNION') {
    const combined = new Map(leftSet);
    rightSet.forEach((row, key) => {
      combined.set(key, row);
    });
    return { columns: left.columns, rows: Array.from(combined.values()) };
  }

  if (type === 'INTERSECT') {
    const rows = Array.from(leftSet.entries())
      .filter(([key]) => rightSet.has(key))
      .map(([, row]) => row);
    return { columns: left.columns, rows };
  }

  const rows = Array.from(leftSet.entries())
    .filter(([key]) => !rightSet.has(key))
    .map(([, row]) => row);
  return { columns: left.columns, rows };
};

const buildQueryOutput = (normalized: NormalizedQuery, cteRegistry: Map<string, TableData>): TableData => {
  const baseOutput = buildQueryOutputWithoutSet(normalized, cteRegistry);

  if (normalized.setOperation) {
    const rightOutput = buildQueryOutput(normalized.setOperation.right, cteRegistry);
    return applySetOperation(baseOutput, rightOutput, normalized.setOperation.type);
  }

  return baseOutput;
};

const buildQueryOutputWithoutSet = (normalized: NormalizedQuery, cteRegistry: Map<string, TableData>): TableData => {
  let current = buildQualifiedRows(normalized.from, cteRegistry);

  normalized.joins.forEach((join) => {
    if (!join.table) {
      return;
    }

    const rightSource: TableSource = cteRegistry.has(join.table)
      ? { name: join.table, kind: 'cte' }
      : { name: join.table, kind: 'table' };
    const right = buildQualifiedRows(rightSource, cteRegistry);
    const joined = joinRows(current.rows, right.rows, join, current.columns, right.columns);

    current = {
      columns: [...current.columns, ...right.columns],
      rows: joined.rows
    };
  });

  if (normalized.where) {
    current = {
      columns: current.columns,
      rows: applyFilter(current.rows, normalized.where)
    };
  }

  const hasAggregates = normalized.select.some((item) => item.kind === 'aggregate');
  if (normalized.groupBy || hasAggregates) {
    const groupColumns = normalized.groupBy ?? [];
    current = applyAggregation(current.rows, normalized.select, groupColumns);

    if (normalized.having) {
      current = {
        columns: current.columns,
        rows: applyHaving(current.rows, normalized.having)
      };
    }
  }

  if (normalized.orderBy) {
    current = {
      columns: current.columns,
      rows: applyOrder(current.rows, normalized.orderBy)
    };
  }

  if (typeof normalized.limit === 'number') {
    current = {
      columns: current.columns,
      rows: current.rows.slice(0, normalized.limit)
    };
  }

  return applyProjection(current.rows, normalized.select, current.columns);
};

const buildStep = (
  id: string,
  title: string,
  summary: string,
  nodes: VisualizationNode[],
  animationLabel: string,
  animationTargets: string[],
  options?: {
    narration?: string;
    caption?: string;
    glossaryTerms?: string[];
    quiz?: LearningPrompt;
  }
): QueryStep => {
  const glossary = options?.glossaryTerms ? buildGlossary(options.glossaryTerms) : undefined;

  return {
    id,
    title,
    summary,
    narration: options?.narration ?? summary,
    caption: options?.caption,
    glossary: glossary?.length ? glossary : undefined,
    quiz: options?.quiz,
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
  };
};

const buildStepsForSelect = (
  normalized: NormalizedQuery,
  cteRegistry: Map<string, TableData>
): { steps: QueryStep[]; output: TableData } => {
  const steps: QueryStep[] = [];
  const localRegistry = new Map(cteRegistry);

  if (normalized.from.kind === 'subquery' && normalized.from.query) {
    const subqueryOutput = buildQueryOutput(normalized.from.query, cteRegistry);
    localRegistry.set(normalized.from.name, subqueryOutput);

    const subqueryNode: VisualizationNode = {
      id: `subquery-${normalized.from.name}`,
      label: `Subquery ${normalized.from.name}`,
      kind: 'subquery',
      data: subqueryOutput
    };

    steps.push(
      buildStep(
        'step-subquery',
        `${steps.length + 1}. Resolve subquery`,
        `Evaluate the nested SELECT to produce ${normalized.from.name}.`,
        [subqueryNode],
        'Highlight subquery output',
        [subqueryNode.id],
        {
          narration: `We run the nested query first so its output can act like a temporary table named ${normalized.from.name}.`,
          caption: 'Resolve the nested SELECT before the outer query.',
          glossaryTerms: ['SUBQUERY', 'SELECT'],
          quiz: {
            id: `quiz-subquery-${normalized.from.name}`,
            question: 'Why does the subquery run before the outer query?',
            answer: 'The outer query needs the subquery result set as its data source.',
            hint: 'Subqueries behave like temporary tables.'
          }
        }
      )
    );
  }

  const fromTable = getTableData(normalized.from, localRegistry);
  const sourceNodes: VisualizationNode[] = [
    {
      id: `source-${normalized.from.name}`,
      label: normalized.from.name,
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

    const joinSource: TableSource = localRegistry.has(join.table)
      ? { name: join.table, kind: 'cte' }
      : { name: join.table, kind: 'table' };
    const joinTable = getTableData(joinSource, localRegistry);
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
      `${steps.length + 1}. Load source tables`,
      `Load ${sourceNodes.map((node) => node.label).join(' and ')}.`,
      sourceNodes,
      'Highlight input tables',
      sourceNodes.map((node) => node.id),
      {
        narration:
          'We bring the required tables into the visual workspace so each later step can reference their rows.',
        caption: 'Load the tables referenced in FROM and JOIN clauses.',
        glossaryTerms: ['FROM']
      }
    )
  );

  let current = buildQualifiedRows(normalized.from, localRegistry);

  normalized.joins.forEach((join, index) => {
    if (!join.table) {
      return;
    }

    const rightSource: TableSource = localRegistry.has(join.table)
      ? { name: join.table, kind: 'cte' }
      : { name: join.table, kind: 'table' };
    const right = buildQualifiedRows(rightSource, localRegistry);
    const joined = joinRows(current.rows, right.rows, join, current.columns, right.columns);
    const pairs = buildJoinPairs(
      current.rows,
      right.rows,
      join,
      normalized.from.name,
      join.table
    );

    const nodeId = `join-output-${index}`;
    const joinTerm = join.type === 'INNER' ? 'INNER JOIN' : `${join.type} JOIN`;
    const glossaryTerms = join.type === 'CROSS' ? [joinTerm] : [joinTerm, 'ON'];
    const joinNode: VisualizationNode = {
      id: nodeId,
      label: `Join output ${index + 1}`,
      kind: 'join',
      detail: join.type === 'CROSS'
        ? 'Cartesian product of both tables.'
        : `${join.on?.left.table ?? normalized.from.name}.${join.on?.left.column} = ${
            join.on?.right.table ?? join.table
          }.${join.on?.right.column}`,
      data: {
        columns: [...current.columns, ...right.columns],
        rows: joined.rows,
        rowStates: joined.rowStates
      },
      pairs
    };

    steps.push(
      buildStep(
        `step-join-${index + 1}`,
        `${steps.length + 1}. Match rows (${join.type} JOIN)`,
        join.type === 'CROSS'
          ? 'Pair every row from each table.'
          : `Match rows on ${joinNode.detail}.`,
        [joinNode],
        'Animate join pairing',
        [nodeId],
        {
          narration:
            join.type === 'CROSS'
              ? 'A CROSS JOIN pairs every row from the left table with every row from the right table.'
              : `We compare join keys to combine rows from ${normalized.from.name} and ${join.table}.`,
          caption: join.type === 'CROSS' ? 'Build all row combinations.' : 'Match rows on the join condition.',
          glossaryTerms,
          quiz: {
            id: `quiz-join-${index + 1}`,
            question:
              join.type === 'CROSS'
                ? 'How many row combinations does a CROSS JOIN produce?'
                : 'What happens to rows that do not match the join condition?',
            answer:
              join.type === 'CROSS'
                ? 'It produces every possible pairing of left and right rows.'
                : join.type === 'LEFT' || join.type === 'FULL'
                  ? 'Unmatched left rows still appear with empty placeholders.'
                  : join.type === 'RIGHT'
                    ? 'Unmatched right rows still appear with empty placeholders.'
                    : 'Unmatched rows are excluded from the result.',
            hint: 'Consider how the join type treats unmatched rows.'
          }
        }
      )
    );

    current = {
      columns: [...current.columns, ...right.columns],
      rows: joined.rows
    };
  });

  if (normalized.where) {
    const filteredRows = applyFilter(current.rows, normalized.where);
    const rowStates = buildFilterStates(current.rows, normalized.where);
    const filterNode: VisualizationNode = {
      id: 'filtered-rows',
      label: 'Filtered rows',
      kind: 'filter',
      data: {
        columns: current.columns,
        rows: current.rows,
        rowStates
      }
    };

    steps.push(
      buildStep(
        'step-filter',
        `${steps.length + 1}. Apply WHERE`,
        `Keep rows where ${getSelectItemLabel(normalized.where.left)} ${normalized.where.op} ${
          normalized.where.value
        }.`,
        [filterNode],
        'Highlight retained rows',
        [filterNode.id],
        {
          narration:
            'The WHERE clause checks each row against the condition and keeps only the rows that pass.',
          caption: 'Filter rows before grouping or projection.',
          glossaryTerms: ['WHERE'],
          quiz: {
            id: 'quiz-where',
            question: 'At what point does the WHERE clause filter rows?',
            answer: 'It filters rows before grouping, ordering, or projection steps run.',
            hint: 'WHERE happens early in the query pipeline.'
          }
        }
      )
    );

    current = {
      columns: current.columns,
      rows: filteredRows
    };
  }

  const hasAggregates = normalized.select.some((item) => item.kind === 'aggregate');
  if (normalized.groupBy || hasAggregates) {
    const groupColumns = normalized.groupBy ?? [];
    const aggregated = applyAggregation(current.rows, normalized.select, groupColumns);

    const aggregationNode: VisualizationNode = {
      id: 'grouped-rows',
      label: 'Grouped rows',
      kind: 'aggregation',
      data: aggregated
    };

    steps.push(
      buildStep(
        'step-group',
        `${steps.length + 1}. Apply GROUP BY`,
        groupColumns.length
          ? `Group rows by ${groupColumns.map(getSelectItemLabel).join(', ')}.`
          : 'Aggregate rows into summary totals.',
        [aggregationNode],
        'Highlight grouped rows',
        [aggregationNode.id],
        {
          narration: groupColumns.length
            ? 'GROUP BY collects rows with matching keys so aggregates can be calculated per group.'
            : 'Aggregate functions summarize all rows into a single set of totals.',
          caption: 'Group rows to compute aggregates.',
          glossaryTerms: groupColumns.length ? ['GROUP BY', 'AGGREGATE'] : ['AGGREGATE'],
          quiz: {
            id: 'quiz-group',
            question: groupColumns.length
              ? 'What determines which rows are placed in the same group?'
              : 'What does an aggregate without GROUP BY summarize?',
            answer: groupColumns.length
              ? 'Rows that share the same GROUP BY key values are grouped together.'
              : 'It summarizes the entire result set as a single group.',
            hint: 'Look at the columns listed in GROUP BY.'
          }
        }
      )
    );

    current = aggregated;

    if (normalized.having) {
      const havingRows = applyHaving(current.rows, normalized.having);
      const havingStates = buildFilterStates(current.rows, normalized.having);
      const havingNode: VisualizationNode = {
        id: 'having-rows',
        label: 'HAVING filter',
        kind: 'filter',
        data: {
          columns: current.columns,
          rows: current.rows,
          rowStates: havingStates
        }
      };

      steps.push(
        buildStep(
          'step-having',
          `${steps.length + 1}. Apply HAVING`,
          `Keep groups where ${getSelectItemLabel(normalized.having.left)} ${normalized.having.op} ${
            normalized.having.value
          }.`,
          [havingNode],
          'Highlight qualifying groups',
          [havingNode.id],
          {
            narration: 'HAVING filters the grouped results after aggregation has already happened.',
            caption: 'Filter groups after aggregation.',
            glossaryTerms: ['HAVING'],
            quiz: {
              id: 'quiz-having',
              question: 'How is HAVING different from WHERE?',
              answer: 'HAVING filters grouped results, while WHERE filters individual rows first.',
              hint: 'HAVING comes after GROUP BY.'
            }
          }
        )
      );

      current = {
        columns: current.columns,
        rows: havingRows
      };
    }
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
        [sortNode.id],
        {
          narration: 'ORDER BY arranges the rows so the final output appears in a consistent sequence.',
          caption: 'Sort rows based on the ORDER BY clause.',
          glossaryTerms: ['ORDER BY'],
          quiz: {
            id: 'quiz-order',
            question: 'Does ORDER BY change which rows appear in the result?',
            answer: 'No, it only changes the order of the rows that are already selected.',
            hint: 'Sorting does not filter.'
          }
        }
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
        [limitNode.id],
        {
          narration: 'LIMIT trims the result set down to the first N rows after sorting.',
          caption: 'Restrict the output to a fixed number of rows.',
          glossaryTerms: ['LIMIT'],
          quiz: {
            id: 'quiz-limit',
            question: 'When does LIMIT usually apply in the query flow?',
            answer: 'After other steps like filtering and ordering are complete.',
            hint: 'LIMIT typically comes at the end of the pipeline.'
          }
        }
      )
    );

    current = {
      columns: current.columns,
      rows: limitedRows
    };
  }

  const projection = applyProjection(current.rows, normalized.select, current.columns);
  const projectionSourceNode: VisualizationNode = {
    id: 'projection-source',
    label: 'Before projection',
    kind: 'projection',
    data: {
      columns: current.columns,
      rows: current.rows,
      highlightColumns: projection.columns
    }
  };
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
      [projectionSourceNode, projectionNode],
      'Reveal projected columns',
      [projectionSourceNode.id, projectionNode.id],
      {
        narration: 'Projection chooses which columns to keep so the result matches the SELECT list.',
        caption: 'Keep only the requested output columns.',
        glossaryTerms: ['SELECT']
      }
    )
  );

  return { steps, output: projection };
};

const buildStepsForQuery = (
  normalized: NormalizedQuery,
  cteRegistry: Map<string, TableData>
): { steps: QueryStep[]; output: TableData } => {
  const baseNormalized = { ...normalized, setOperation: undefined };
  const baseResult = buildStepsForSelect(baseNormalized, cteRegistry);

  if (!normalized.setOperation) {
    return baseResult;
  }

  const rightOutput = buildQueryOutput(normalized.setOperation.right, cteRegistry);
  const combined = applySetOperation(baseResult.output, rightOutput, normalized.setOperation.type);

  const setNodeLeft: VisualizationNode = {
    id: 'set-left',
    label: 'Left result',
    kind: 'set',
    data: baseResult.output
  };
  const setNodeRight: VisualizationNode = {
    id: 'set-right',
    label: 'Right result',
    kind: 'set',
    data: rightOutput
  };
  const setNodeOutput: VisualizationNode = {
    id: 'set-output',
    label: `${normalized.setOperation.type} output`,
    kind: 'set',
    data: combined
  };

  const setStep = buildStep(
    'step-set',
    `${baseResult.steps.length + 1}. Combine results (${normalized.setOperation.type})`,
    `Merge the two result sets using ${normalized.setOperation.type}.`,
    [setNodeLeft, setNodeRight, setNodeOutput],
    'Highlight set operation output',
    [setNodeOutput.id],
    {
      narration: 'Set operations compare two result sets to combine or filter rows.',
      caption: `Apply ${normalized.setOperation.type} to both result sets.`,
      glossaryTerms: [normalized.setOperation.type],
      quiz: {
        id: 'quiz-set',
        question: `What does ${normalized.setOperation.type} do to the two result sets?`,
        answer:
          normalized.setOperation.type === 'UNION'
            ? 'It combines both results and removes duplicates.'
            : normalized.setOperation.type === 'INTERSECT'
              ? 'It keeps only rows that appear in both results.'
              : 'It keeps rows from the left result that are not in the right result.',
        hint: 'Each set operator compares rows across both result sets.'
      }
    }
  );

  return {
    steps: [...baseResult.steps, setStep],
    output: combined
  };
};

const buildStepsForInsert = (statement: Record<string, unknown>): QueryStep[] => {
  const tableName = String((statement.into as { tableid?: string } | undefined)?.tableid ?? '');
  const table = getMockTable(tableName);
  const columns = (statement.columns as Array<{ columnid?: string }> | undefined)?.map((column) => String(column.columnid));
  const values = (statement.values as Array<Array<{ value?: string | number }>> | undefined) ?? [];

  const rowsToInsert = values.map((valueRow) => {
    const row: Record<string, string | number> = {};
    table.columns.forEach((column, index) => {
      const valueIndex = columns ? columns.indexOf(column) : index;
      row[column] = valueRow[valueIndex]?.value ?? '';
    });
    return row;
  });

  const previewRows = [...table.rows, ...rowsToInsert];
  const rowStates = previewRows.map((_, index) => (index >= table.rows.length ? 'inserted' : 'default'));

  const insertNode: VisualizationNode = {
    id: 'insert-preview',
    label: 'Insert preview',
    kind: 'mutation',
    data: {
      columns: table.columns,
      rows: previewRows,
      rowStates
    }
  };

  return [
    buildStep(
      'step-insert',
      '1. Insert rows',
      `Add ${rowsToInsert.length} row(s) to ${tableName}.`,
      [insertNode],
      'Highlight inserted rows',
      [insertNode.id],
      {
        narration: 'INSERT adds new rows to the table based on the provided values.',
        caption: 'Add new rows to the target table.',
        glossaryTerms: ['INSERT'],
        quiz: {
          id: 'quiz-insert',
          question: 'What does an INSERT statement change?',
          answer: 'It adds new rows to a table.',
          hint: 'Think of adding data.'
        }
      }
    )
  ];
};

const buildStepsForUpdate = (statement: Record<string, unknown>): QueryStep[] => {
  const tableName = String((statement.table as { tableid?: string } | undefined)?.tableid ?? '');
  const table = getMockTable(tableName);
  const updates = (statement.columns as Array<Record<string, unknown>> | undefined) ?? [];
  const whereExpression = statement.where as Record<string, unknown> | undefined;
  const where = normalizePredicate(whereExpression);

  const beforeRows = table.rows;
  const rowStates = beforeRows.map((row) => {
    if (!where) {
      return 'updated';
    }
    const key = where.left.kind === 'column' ? resolveColumnKey(row, where.left) : getSelectItemLabel(where.left);
    const matches = compareValues(row[key], where.op, where.value);
    return matches ? 'updated' : 'default';
  });

  const updatedRows = beforeRows.map((row, index) => {
    if (rowStates[index] !== 'updated') {
      return row;
    }

    const updatedRow = { ...row };
    updates.forEach((update) => {
      const columnId = (update.column as { columnid?: string } | undefined)?.columnid;
      const value = (update.expression as { value?: string | number } | undefined)?.value;
      if (columnId) {
        updatedRow[String(columnId)] = value ?? '';
      }
    });
    return updatedRow;
  });

  const beforeNode: VisualizationNode = {
    id: 'update-before',
    label: 'Rows to update',
    kind: 'mutation',
    data: {
      columns: table.columns,
      rows: beforeRows,
      rowStates
    }
  };

  const afterNode: VisualizationNode = {
    id: 'update-after',
    label: 'Updated rows',
    kind: 'mutation',
    data: {
      columns: table.columns,
      rows: updatedRows,
      rowStates
    }
  };

  return [
    buildStep(
      'step-update',
      '1. Update rows',
      `Modify matching rows in ${tableName}.`,
      [beforeNode, afterNode],
      'Highlight updated rows',
      [beforeNode.id, afterNode.id],
      {
        narration: 'UPDATE changes the values of matching rows while keeping the row count the same.',
        caption: 'Modify existing rows that match the condition.',
        glossaryTerms: ['UPDATE', 'WHERE'],
        quiz: {
          id: 'quiz-update',
          question: 'Does UPDATE add or remove rows?',
          answer: 'No, it edits values in existing rows.',
          hint: 'UPDATE modifies data in place.'
        }
      }
    )
  ];
};

const buildStepsForDelete = (statement: Record<string, unknown>): QueryStep[] => {
  const tableName = String((statement.table as { tableid?: string } | undefined)?.tableid ?? '');
  const table = getMockTable(tableName);
  const whereExpression = statement.where as Record<string, unknown> | undefined;
  const where = normalizePredicate(whereExpression);

  const rowStates = table.rows.map((row) => {
    if (!where) {
      return 'deleted';
    }
    const key = where.left.kind === 'column' ? resolveColumnKey(row, where.left) : getSelectItemLabel(where.left);
    const matches = compareValues(row[key], where.op, where.value);
    return matches ? 'deleted' : 'default';
  });

  const remainingRows = table.rows.filter((_, index) => rowStates[index] !== 'deleted');

  const beforeNode: VisualizationNode = {
    id: 'delete-before',
    label: 'Rows to delete',
    kind: 'mutation',
    data: {
      columns: table.columns,
      rows: table.rows,
      rowStates
    }
  };

  const afterNode: VisualizationNode = {
    id: 'delete-after',
    label: 'Remaining rows',
    kind: 'mutation',
    data: {
      columns: table.columns,
      rows: remainingRows
    }
  };

  return [
    buildStep(
      'step-delete',
      '1. Delete rows',
      `Remove matching rows from ${tableName}.`,
      [beforeNode, afterNode],
      'Highlight deleted rows',
      [beforeNode.id, afterNode.id],
      {
        narration: 'DELETE removes rows that meet the condition from the table.',
        caption: 'Remove rows that match the delete condition.',
        glossaryTerms: ['DELETE', 'WHERE'],
        quiz: {
          id: 'quiz-delete',
          question: 'What happens to rows that match the DELETE condition?',
          answer: 'They are removed from the table.',
          hint: 'DELETE reduces the number of rows.'
        }
      }
    )
  ];
};

export const generateStepsFromSql = (sql: string): QueryStep[] => {
  const statement = parseSql(sql);

  if ('into' in statement) {
    return buildStepsForInsert(statement);
  }

  if ('table' in statement && 'columns' in statement && !('from' in statement)) {
    return buildStepsForUpdate(statement);
  }

  if ('table' in statement && !('columns' in statement) && !('from' in statement)) {
    return buildStepsForDelete(statement);
  }

  const cteRegistry = new Map<string, TableData>();
  const withStatements = (statement.withs as Array<Record<string, unknown>> | undefined) ?? [];
  const steps: QueryStep[] = [];

  withStatements.forEach((withStatement) => {
    const cteName = String(withStatement.name ?? 'CTE');
    const cteSelect = withStatement.select as Record<string, unknown> | undefined;
    if (!cteSelect) {
      return;
    }

    const normalizedCte = normalizeStatement(cteSelect);
    const cteOutput = buildQueryOutput(normalizedCte, cteRegistry);
    cteRegistry.set(cteName, cteOutput);

    const cteNode: VisualizationNode = {
      id: `cte-${cteName}`,
      label: `CTE ${cteName}`,
      kind: 'cte',
      data: cteOutput
    };

    steps.push(
      buildStep(
        `step-cte-${cteName}`,
        `${steps.length + 1}. Build CTE`,
        `Generate ${cteName} for reuse in the main query.`,
        [cteNode],
        'Highlight CTE output',
        [cteNode.id],
        {
          narration: `We compute ${cteName} once and store it as a named result set for later steps.`,
          caption: 'Build the CTE before running the main query.',
          glossaryTerms: ['CTE', 'SELECT'],
          quiz: {
            id: `quiz-cte-${cteName}`,
            question: 'Why use a CTE in a query?',
            answer: 'It creates a named, reusable subquery that can simplify complex SQL.',
            hint: 'CTEs act like temporary named tables.'
          }
        }
      )
    );
  });

  const normalized = normalizeStatement(statement);
  if (cteRegistry.size && normalized.from.kind === 'table' && cteRegistry.has(normalized.from.name)) {
    normalized.from = { name: normalized.from.name, kind: 'cte' };
  }

  const result = buildStepsForQuery(normalized, cteRegistry);
  return [...steps, ...result.steps];
};
