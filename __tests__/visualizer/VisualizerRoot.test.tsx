import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import VisualizerRoot from '../../app/visualizer/VisualizerRoot';

describe('VisualizerRoot', () => {
  it('renders timeline steps for grouped queries', async () => {
    render(<VisualizerRoot />);

    const textarea = screen.getByLabelText('שאילתת SQL');
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

    await waitFor(() => {
      expect(screen.getByText(/Apply GROUP BY/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Apply HAVING/i)).toBeInTheDocument();
    expect(screen.getByText(/Apply ORDER BY/i)).toBeInTheDocument();
    expect(screen.getByText(/Apply LIMIT/i)).toBeInTheDocument();
  });

  it('surfaces placeholder coverage details when needed', async () => {
    render(<VisualizerRoot />);

    const textarea = screen.getByLabelText('שאילתת SQL');
    fireEvent.change(textarea, {
      target: {
        value: 'SELECT DISTINCT name FROM Students;'
      }
    });

    const coverageButton = await screen.findByRole('button', { name: /Coverage check/i });
    fireEvent.click(coverageButton);

    const placeholderCard = screen.getByRole('region', { name: 'Keyword coverage gaps' });

    expect(screen.getByText('Keyword coverage gaps')).toBeInTheDocument();
    expect(within(placeholderCard).getByText(/DISTINCT/i)).toBeInTheDocument();
  });
});
