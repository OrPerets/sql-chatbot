import { http } from "./http";
import type { SqlExecutionRequest, SqlExecutionResponse } from "../types";

const BASE_PATH = "/api/sql/execute";

export async function executeSql(payload: SqlExecutionRequest) {
  return http<SqlExecutionResponse>(BASE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
