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
    expect(titles.some((title) => title.includes('Match rows'))).toBe(true);
    expect(titles.some((title) => title.includes('Apply WHERE'))).toBe(true);
    expect(titles.some((title) => title.includes('Apply ORDER BY'))).toBe(true);
    expect(titles.some((title) => title.includes('Apply LIMIT'))).toBe(true);
    expect(titles.some((title) => title.includes('Project columns'))).toBe(true);
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
