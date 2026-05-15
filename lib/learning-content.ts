import { getAllowedConceptsForWeek, SQL_CURRICULUM_MAP } from '@/lib/sql-curriculum';

export type LearningAssetType = 'lecture' | 'practice';

export type LearningAsset = {
  id: string;
  filename: string;
  type: LearningAssetType;
  week: number;
  label: string;
  concepts: string[];
};

const BASE_LEARNING_PDFS: Omit<LearningAsset, 'concepts'>[] = [
  { id: 'lecture01', filename: 'lecture01.pdf', type: 'lecture', week: 1, label: 'הרצאה 1' },
  { id: 'lecture02', filename: 'lecture02.pdf', type: 'lecture', week: 2, label: 'הרצאה 2' },
  { id: 'lecture03', filename: 'lecture03.pdf', type: 'lecture', week: 3, label: 'הרצאה 3' },
  { id: 'lecture04', filename: 'lecture04.pdf', type: 'lecture', week: 4, label: 'הרצאה 4' },
  { id: 'lecture05', filename: 'lecture05.pdf', type: 'lecture', week: 5, label: 'הרצאה 5' },
  { id: 'lecture06', filename: 'lecture06.pdf', type: 'lecture', week: 6, label: 'הרצאה 6' },
  { id: 'lecture07', filename: 'lecture07.pdf', type: 'lecture', week: 7, label: 'הרצאה 7' },
  { id: 'lecture08', filename: 'lecture08.pdf', type: 'lecture', week: 8, label: 'הרצאה 8' },
  { id: 'lecture09', filename: 'lecture09.pdf', type: 'lecture', week: 9, label: 'הרצאה 9' },
  { id: 'lecture10', filename: 'lecture10.pdf', type: 'lecture', week: 10, label: 'הרצאה 10' },
  { id: 'lecture11', filename: 'lecture11.pdf', type: 'lecture', week: 11, label: 'הרצאה 11' },
  { id: 'lecture12', filename: 'lecture12.pdf', type: 'lecture', week: 12, label: 'הרצאה 12' },
  { id: 'lecture13', filename: 'lecture13.pdf', type: 'lecture', week: 13, label: 'הרצאה 13' },
  { id: 'lecture14', filename: 'lecture14.pdf', type: 'lecture', week: 14, label: 'הרצאה 14' },
  { id: 'tergul01', filename: 'tergul01.pdf', type: 'practice', week: 1, label: 'תרגול 1' },
  { id: 'tergul02', filename: 'tergul02.pdf', type: 'practice', week: 2, label: 'תרגול 2' },
  { id: 'tergul03', filename: 'tergul03.pdf', type: 'practice', week: 3, label: 'תרגול 3' },
  { id: 'tergul04', filename: 'tergul04.pdf', type: 'practice', week: 4, label: 'תרגול 4' },
  { id: 'tergul05', filename: 'tergul05.pdf', type: 'practice', week: 5, label: 'תרגול 5' },
  { id: 'tergul05b', filename: 'tergul05B.pdf', type: 'practice', week: 5, label: 'תרגול 5ב' },
  { id: 'tergul06', filename: 'tergul06.pdf', type: 'practice', week: 6, label: 'תרגול 6' },
  { id: 'tergul06b', filename: 'tergul06B.pdf', type: 'practice', week: 6, label: 'תרגול 6ב' },
  { id: 'tergul07', filename: 'tergul07.pdf', type: 'practice', week: 7, label: 'תרגול 7' },
  { id: 'tergul08', filename: 'tergul08.pdf', type: 'practice', week: 8, label: 'תרגול 8' },
  { id: 'tergul09', filename: 'tergul09.pdf', type: 'practice', week: 9, label: 'תרגול 9' },
  { id: 'tergul10', filename: 'tergul10.pdf', type: 'practice', week: 10, label: 'תרגול 10' },
  { id: 'tergul11', filename: 'tergul11.pdf', type: 'practice', week: 11, label: 'תרגול 11' },
];

export const LEARNING_PDFS: LearningAsset[] = BASE_LEARNING_PDFS.map((asset) => ({
  ...asset,
  concepts: SQL_CURRICULUM_MAP[asset.week]?.concepts ?? getAllowedConceptsForWeek(asset.week),
}));

export const LEARNING_PDF_FILENAMES = new Set(LEARNING_PDFS.map((item) => item.filename));
