import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SqlQueryBuilder from '../../app/components/SqlQueryBuilder/SqlQueryBuilder';

describe('SqlQueryBuilder', () => {
  const mockProps = {
    isOpen: true,
    onClose: jest.fn(),
    onQueryGenerated: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders operation selection when open', () => {
    render(<SqlQueryBuilder {...mockProps} />);
    
    expect(screen.getByText('בחר סוג פעולה')).toBeInTheDocument();
    expect(screen.getByText('צור טבלה חדשה')).toBeInTheDocument();
    expect(screen.getByText('הכנס נתונים')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<SqlQueryBuilder {...mockProps} isOpen={false} />);
    
    expect(screen.queryByText('בחר סוג פעולה')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<SqlQueryBuilder {...mockProps} />);
    
    const closeButton = screen.getByLabelText('סגור');
    fireEvent.click(closeButton);
    
    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when escape key is pressed', () => {
    render(<SqlQueryBuilder {...mockProps} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('progresses to create table form when create option is selected', () => {
    render(<SqlQueryBuilder {...mockProps} />);
    
    const createOption = screen.getByText('צור טבלה חדשה');
    fireEvent.click(createOption);
    
    expect(screen.getByText('צור טבלה חדשה')).toBeInTheDocument();
    expect(screen.getByLabelText('שם הטבלה *')).toBeInTheDocument();
  });

  it('progresses to insert data form when insert option is selected', () => {
    render(<SqlQueryBuilder {...mockProps} />);
    
    const insertOption = screen.getByText('הכנס נתונים');
    fireEvent.click(insertOption);
    
    expect(screen.getByText('הכנס נתונים')).toBeInTheDocument();
    expect(screen.getByLabelText('שם הטבלה *')).toBeInTheDocument();
  });

  it('shows progress steps correctly', () => {
    render(<SqlQueryBuilder {...mockProps} />);
    
    expect(screen.getByText('בחר פעולה')).toBeInTheDocument();
    expect(screen.getByText('מלא פרטים')).toBeInTheDocument();
    expect(screen.getByText('אשר שאילתה')).toBeInTheDocument();
  });

  it('handles keyboard navigation for operation selection', () => {
    render(<SqlQueryBuilder {...mockProps} />);
    
    const createOption = screen.getByRole('button', { name: /צור טבלה חדשה/ });
    fireEvent.keyDown(createOption, { key: 'Enter' });
    
    expect(screen.getByText('צור טבלה חדשה')).toBeInTheDocument();
  });
});

describe('SqlQueryBuilder Create Table Flow', () => {
  const mockProps = {
    isOpen: true,
    onClose: jest.fn(),
    onQueryGenerated: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates table name requirement', async () => {
    render(<SqlQueryBuilder {...mockProps} />);
    
    // Select create table
    fireEvent.click(screen.getByText('צור טבלה חדשה'));
    
    // Try to submit without table name
    const submitButton = screen.getByText('צור שאילתה');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getAllByText('שם הטבלה הוא שדה חובה')).toHaveLength(2);
    });
  });

  it('generates CREATE TABLE query correctly', async () => {
    render(<SqlQueryBuilder {...mockProps} />);
    
    // Select create table
    fireEvent.click(screen.getByText('צור טבלה חדשה'));
    
    // Fill table name
    const tableNameInput = screen.getByLabelText('שם הטבלה *');
    fireEvent.change(tableNameInput, { target: { value: 'users' } });
    
    // Fill first column (should be pre-populated)
    const columnNameInputs = screen.getAllByPlaceholderText(/לדוגמה: user_id, name, email/);
    fireEvent.change(columnNameInputs[0], { target: { value: 'id' } });
    
    // Set as primary key
    const primaryKeyCheckbox = screen.getByLabelText('מפתח ראשי (Primary Key)');
    fireEvent.click(primaryKeyCheckbox);
    
    // Submit form
    const submitButton = screen.getByText('צור שאילתה');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('בדוק את השאילתה')).toBeInTheDocument();
    });
    
    // Confirm query
    const confirmButton = screen.getByText('הוסף לצ\'אט');
    fireEvent.click(confirmButton);
    
    expect(mockProps.onQueryGenerated).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE users')
    );
    expect(mockProps.onQueryGenerated).toHaveBeenCalledWith(
      expect.stringContaining('id VARCHAR(255) PRIMARY KEY')
    );
  });
});

describe('SqlQueryBuilder Insert Data Flow', () => {
  const mockProps = {
    isOpen: true,
    onClose: jest.fn(),
    onQueryGenerated: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates INSERT query correctly', async () => {
    render(<SqlQueryBuilder {...mockProps} />);
    
    // Select insert data
    fireEvent.click(screen.getByText('הכנס נתונים'));
    
    // Fill table name
    const tableNameInput = screen.getByLabelText('שם הטבלה *');
    fireEvent.change(tableNameInput, { target: { value: 'users' } });
    
    // Fill column name
    const columnInputs = screen.getAllByPlaceholderText(/עמודה/);
    fireEvent.change(columnInputs[0], { target: { value: 'name' } });
    
    // Fill data value
    const valueInputs = screen.getAllByPlaceholderText(/ערך/);
    fireEvent.change(valueInputs[0], { target: { value: 'John Doe' } });
    
    // Submit form
    const submitButton = screen.getByText('צור שאילתה');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('בדוק את השאילתה')).toBeInTheDocument();
    });
    
    // Confirm query
    const confirmButton = screen.getByText('הוסף לצ\'אט');
    fireEvent.click(confirmButton);
    
    expect(mockProps.onQueryGenerated).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users')
    );
    expect(mockProps.onQueryGenerated).toHaveBeenCalledWith(
      expect.stringContaining("'John Doe'")
    );
  });

  it('handles CSV paste functionality', async () => {
    render(<SqlQueryBuilder {...mockProps} />);
    
    // Select insert data
    fireEvent.click(screen.getByText('הכנס נתונים'));
    
    // Mock window.confirm for CSV headers
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);
    
    // Find the CSV import area and simulate paste
    const csvArea = screen.getByText(/העתק נתונים מ-Excel או CSV/);
    const pasteEvent = new Event('paste', { bubbles: true });
    Object.assign(pasteEvent, {
      clipboardData: {
        getData: () => 'name,email\nJohn Doe,john@example.com\nJane Smith,jane@example.com'
      }
    });
    
    fireEvent(csvArea, pasteEvent);
    
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('האם השורה הראשונה מכילה כותרות עמודות?');
    });
    
    // Restore original confirm
    window.confirm = originalConfirm;
  });
});
