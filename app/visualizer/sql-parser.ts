import alasql from '../../node_modules/alasql/dist/alasql.min.js';

type ParsedQueryResult = {
  statements?: Array<Record<string, unknown>>;
};

export const parseSql = (sql: string) => {
  const result = alasql.parse(sql) as ParsedQueryResult;
  const statement = result.statements?.[0];

  if (!statement) {
    throw new Error('Unable to parse SQL query.');
  }

  return statement;
};
