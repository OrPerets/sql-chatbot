export type VisualizationKind =
  | 'table'
  | 'projection'
  | 'filter'
  | 'join'
  | 'aggregation'
  | 'sort'
  | 'limit'
  | 'set'
  | 'cte'
  | 'subquery'
  | 'mutation'
  | 'placeholder';

export type AnimationStyle = 'highlight' | 'fade' | 'pulse' | 'move';

export type JoinPair = {
  id: string;
  left: string;
  right: string;
  matched: boolean;
};

export type RowState =
  | 'default'
  | 'kept'
  | 'filtered'
  | 'matched'
  | 'unmatched'
  | 'inserted'
  | 'updated'
  | 'deleted';

export type VisualizationNode = {
  id: string;
  label: string;
  kind: VisualizationKind;
  data?: {
    columns: string[];
    rows: Array<Record<string, string | number>>;
    rowStates?: RowState[];
    highlightColumns?: string[];
  };
  detail?: string;
  pairs?: JoinPair[];
  notes?: string[];
};

export type AnimationStep = {
  id: string;
  label: string;
  style: AnimationStyle;
  durationMs: number;
  targetNodeIds: string[];
};

export type GlossaryHint = {
  term: string;
  definition: string;
};

export type LearningPrompt = {
  id: string;
  question: string;
  answer: string;
  hint?: string;
};

export type QueryStep = {
  id: string;
  title: string;
  summary: string;
  narration?: string;
  caption?: string;
  glossary?: GlossaryHint[];
  quiz?: LearningPrompt;
  nodes: VisualizationNode[];
  animations: AnimationStep[];
};
