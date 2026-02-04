import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import VisualizerRoot from '../../app/visualizer/VisualizerRoot';

const openSqlEditor = async () => {
  const editButton = screen.getByTitle('ערוך שאילתה');
  fireEvent.click(editButton);
  const textarea = await screen.findByLabelText(/שאילתת ה-SQL/i);
  return textarea;
};

describe('VisualizerRoot', () => {
  it('renders timeline steps for grouped queries', async () => {
    render(<VisualizerRoot />);

    const textarea = await openSqlEditor();
    fireEvent.change(textarea, {
      target: {
        value: `
          SELECT Students.cohort, COUNT(*)
          FROM Students
          GROUP BY Students.cohort
          HAVING COUNT(*) > 1
          ORDER BY Students.cohort
          LIMIT 2;
        `
      }
    });
    fireEvent.click(screen.getByRole('button', { name: /שמור והפעל/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /GROUP BY/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /HAVING/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ORDER BY/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /LIMIT/i })).toBeInTheDocument();
  });

  it('surfaces placeholder coverage details when needed', async () => {
    render(<VisualizerRoot />);

    const textarea = await openSqlEditor();
    fireEvent.change(textarea, {
      target: {
        value: 'SELECT DISTINCT name FROM Students;'
      }
    });
    fireEvent.click(screen.getByRole('button', { name: /שמור והפעל/i }));

    const coverageButton = await screen.findByRole('button', { name: /בדיקת כיסוי/i });
    fireEvent.click(coverageButton);

    const placeholderCard = screen.getByRole('region', { name: 'Keyword coverage gaps' });

    expect(screen.getByText('Keyword coverage gaps')).toBeInTheDocument();
    expect(within(placeholderCard).getByText(/DISTINCT/i)).toBeInTheDocument();
  });
});
