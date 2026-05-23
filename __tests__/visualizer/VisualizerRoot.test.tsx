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
          SELECT customers.segment, COUNT(*)
          FROM customers
          GROUP BY customers.segment
          HAVING COUNT(*) > 1
          ORDER BY customers.segment
          LIMIT 2;
        `
      }
    });
    const saveButton = screen.getByRole('button', { name: /שמור והפעל/i });
    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });
    fireEvent.click(saveButton);

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
        value: 'SELECT DISTINCT full_name FROM customers;'
      }
    });
    const saveButton = screen.getByRole('button', { name: /שמור והפעל/i });
    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });
    fireEvent.click(saveButton);

    const coverageButton = await screen.findByRole('button', { name: /בדיקת כיסוי/i });
    fireEvent.click(coverageButton);

    const placeholderCard = screen.getByRole('region', { name: 'Keyword coverage gaps' });

    expect(screen.getByText('Keyword coverage gaps')).toBeInTheDocument();
    expect(within(placeholderCard).getByText(/DISTINCT/i)).toBeInTheDocument();
  });
});
