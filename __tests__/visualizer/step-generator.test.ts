import { generateStepsFromSql } from '../../app/visualizer/step-generator';

describe('generateStepsFromSql', () => {
  it('builds steps for core SELECT keywords', () => {
    const steps = generateStepsFromSql(`
      SELECT customers.full_name, orders.status
      FROM customers
      INNER JOIN orders ON customers.id = orders.customer_id
      WHERE orders.status = 'delivered'
      ORDER BY customers.full_name
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
    const steps = generateStepsFromSql('SELECT DISTINCT full_name FROM customers;');
    const coverageStep = steps.find((step) => step.id === 'step-coverage');

    expect(coverageStep).toBeDefined();
    expect(coverageStep?.nodes[0].kind).toBe('placeholder');
    expect(coverageStep?.nodes[0].notes).toEqual(
      expect.arrayContaining([expect.stringContaining('DISTINCT')])
    );
  });
});
