import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

interface ExtraTimeRecord {
  studentId: string;
  percentage: number;
  createdAt: Date;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload .xlsx or .csv files only.' },
        { status: 400 }
      );
    }

    // Read file content
    const buffer = await file.arrayBuffer();
    let workbook: XLSX.WorkBook;

    if (fileName.endsWith('.csv')) {
      const csvText = new TextDecoder().decode(buffer);
      workbook = XLSX.read(csvText, { type: 'string' });
    } else {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    }

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      return NextResponse.json(
        { error: 'File must contain at least a header row and one data row' },
        { status: 400 }
      );
    }

    // Extract headers and validate
    const headers = jsonData[0] as string[];
    const idColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('id') || h.toLowerCase().includes('student')
    );
    const percentageColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('percentage') || h.toLowerCase().includes('percent')
    );

    if (idColumnIndex === -1 || percentageColumnIndex === -1) {
      return NextResponse.json(
        { error: 'File must contain columns for ID and PERCENTAGE' },
        { status: 400 }
      );
    }

    // Process data rows
    const records: ExtraTimeRecord[] = [];
    const errors: string[] = [];
    const processedIds = new Set<string>();

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (!row || row.length === 0) continue;

      const studentId = String(row[idColumnIndex] || '').trim();
      const percentageStr = String(row[percentageColumnIndex] || '').trim();

      // Validate student ID
      if (!studentId) {
        errors.push(`Row ${i + 1}: Missing student ID`);
        continue;
      }

      // Validate percentage
      const percentage = parseFloat(percentageStr);
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        errors.push(`Row ${i + 1}: Invalid percentage (${percentageStr}). Must be between 0 and 100.`);
        continue;
      }

      // Check for duplicates (last row wins)
      if (processedIds.has(studentId)) {
        // Remove previous record for this student
        const existingIndex = records.findIndex(r => r.studentId === studentId);
        if (existingIndex !== -1) {
          records.splice(existingIndex, 1);
        }
      }

      records.push({
        studentId,
        percentage,
        createdAt: new Date()
      });

      processedIds.add(studentId);
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Validation errors found',
          details: errors,
          validRecords: records.length
        },
        { status: 400 }
      );
    }

    // Send to backend server
    const backendUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://mentor-server-theta.vercel.app';
    
    const response = await fetch(`${backendUrl}/admin/uploadExtraTime`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records,
        uploadedBy: 'admin', // You might want to get this from session
        uploadTime: new Date().toISOString()
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: 'Failed to save to database', details: errorData },
        { status: 500 }
      );
    }

    const result = await response.json();

  } catch (error) {
    console.error('Error processing extra time upload:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 