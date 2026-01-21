export type VisualizationKind =
  | 'table'
  | 'projection'
  | 'filter'
  | 'join'
  | 'aggregation'
  | 'sort'
  | 'limit'
  | 'placeholder';

export type AnimationStyle = 'highlight' | 'fade' | 'pulse' | 'move';

export type VisualizationNode = {
  id: string;
  label: string;
  kind: VisualizationKind;
  data?: {
    columns: string[];
    rows: Array<Record<string, string | number>>;
  };
  detail?: string;
};

export type AnimationStep = {
  id: string;
  label: string;
  style: AnimationStyle;
  durationMs: number;
  targetNodeIds: string[];
};

export type QueryStep = {
  id: string;
  title: string;
  summary: string;
  nodes: VisualizationNode[];
  animations: AnimationStep[];
};
