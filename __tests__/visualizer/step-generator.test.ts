import { generateStepsFromSql } from '../../app/visualizer/step-generator';

describe('generateStepsFromSql', () => {
  it('builds steps for core SELECT keywords', () => {
    const steps = generateStepsFromSql(`
      SELECT Students.name, Enrollments.course
      FROM Students
      INNER JOIN Enrollments ON Students.id = Enrollments.student_id
      WHERE Enrollments.status = 'active'
      ORDER BY Students.name
      LIMIT 3;
    `);

    const titles = steps.map((step) => step.title);
    // Step titles are in Hebrew; keywords (WHERE, ORDER BY, LIMIT) appear in titles
    expect(titles.some((title) => title.includes('JOIN'))).toBe(true);
    expect(titles.some((title) => title.includes('WHERE'))).toBe(true);
    expect(titles.some((title) => title.includes('ORDER BY'))).toBe(true);
    expect(titles.some((title) => title.includes('LIMIT'))).toBe(true);
    expect(titles.some((title) => title.includes('הקרנת'))).toBe(true);
  });

  it('adds a placeholder step when keyword coverage gaps are detected', () => {
    const steps = generateStepsFromSql('SELECT DISTINCT name FROM Students;');
    const coverageStep = steps.find((step) => step.id === 'step-coverage');

    expect(coverageStep).toBeDefined();
    expect(coverageStep?.nodes[0].kind).toBe('placeholder');
    expect(coverageStep?.nodes[0].notes).toEqual(
      expect.arrayContaining([expect.stringContaining('DISTINCT')])
    );
  });
});
