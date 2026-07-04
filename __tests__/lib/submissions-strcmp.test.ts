import { rewriteStrcmpScalarSubqueries } from "@/lib/submissions";

describe("rewriteStrcmpScalarSubqueries", () => {
  it("evaluates scalar SELECT arguments before STRCMP execution", () => {
    const executedSql: string[] = [];
    const sql = `
      SELECT STRCMP(
        (
          SELECT City
          FROM Students
          JOIN Enrollments USING(StudentID)
          JOIN Courses USING(CourseID)
          WHERE Grade = (
            SELECT MIN(Grade)
            FROM Enrollments
            JOIN Courses USING(CourseID)
            WHERE CourseName = 'Database'
          )
        ),
        (
          SELECT City
          FROM Lecturers
          WHERE CAST(Seniority AS INTEGER) = (
            SELECT MAX(CAST(Seniority AS INTEGER))
            FROM Lecturers
          )
        )
      ) AS result
    `;

    const rewritten = rewriteStrcmpScalarSubqueries(sql, (scalarSql) => {
      executedSql.push(scalarSql);
      return scalarSql.includes("FROM Students")
        ? [{ City: "Haifa" }]
        : [{ City: "Ramat Gan" }];
    });

    expect(executedSql).toHaveLength(2);
    expect(executedSql[0]).toContain("SELECT MIN(Grade)");
    expect(executedSql[1]).toContain("MAX(CAST(Seniority AS INTEGER))");
    expect(rewritten).toContain("STRCMP('Haifa', 'Ramat Gan') AS result");
  });

  it("leaves non-subquery STRCMP calls unchanged", () => {
    const sql = "SELECT STRCMP(City, 'Haifa') AS result FROM Students";
    const executeScalarSql = jest.fn();

    expect(rewriteStrcmpScalarSubqueries(sql, executeScalarSql)).toBe(sql);
    expect(executeScalarSql).not.toHaveBeenCalled();
  });

  it("allows alasql to execute nested scalar subqueries inside STRCMP", () => {
    const alasql = require("alasql");
    alasql.fn.STRCMP = (left: unknown, right: unknown) => {
      const leftString = String(left);
      const rightString = String(right);
      if (leftString < rightString) return -1;
      if (leftString > rightString) return 1;
      return 0;
    };

    alasql("DROP TABLE IF EXISTS Students");
    alasql("DROP TABLE IF EXISTS Courses");
    alasql("DROP TABLE IF EXISTS Enrollments");
    alasql("DROP TABLE IF EXISTS Lecturers");
    alasql("CREATE TABLE Students (StudentID TEXT, City TEXT)");
    alasql("CREATE TABLE Courses (CourseID INT, CourseName TEXT)");
    alasql("CREATE TABLE Enrollments (StudentID TEXT, CourseID INT, Grade INT)");
    alasql("CREATE TABLE Lecturers (City TEXT, Seniority TEXT)");
    alasql("INSERT INTO Students VALUES ('s1', 'Haifa')");
    alasql("INSERT INTO Courses VALUES (106, 'Database')");
    alasql("INSERT INTO Enrollments VALUES ('s1', 106, 61)");
    alasql("INSERT INTO Lecturers VALUES ('Ramat Gan', '16'), ('Haifa', 'D')");

    const sql = `
      SELECT STRCMP(
        (
          SELECT City
          FROM Students
          JOIN Enrollments USING(StudentID)
          JOIN Courses USING(CourseID)
          WHERE Grade = (
            SELECT MIN(Grade)
            FROM Enrollments
            JOIN Courses USING(CourseID)
            WHERE CourseName = 'Database'
          )
        ),
        (
          SELECT City
          FROM Lecturers
          WHERE CAST(Seniority AS INTEGER) = (
            SELECT MAX(CAST(Seniority AS INTEGER))
            FROM Lecturers
            WHERE Seniority GLOB '[0-9]*'
          )
          AND Seniority GLOB '[0-9]*'
        )
      ) AS result
    `;

    const rewritten = rewriteStrcmpScalarSubqueries(sql, (scalarSql) => alasql(scalarSql));

    expect(alasql(rewritten)).toEqual([{ result: -1 }]);
  });
});
