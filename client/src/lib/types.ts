export interface Paper {
  id: string;
  pmid?: string;
  doi?: string;
  title: string;
  authors: string[];
  journal: string;
  publishDate: string;
  abstract: string;
  citationCount?: number;
  references?: Paper[];
  citations?: Paper[];
  similarPapers?: Paper[];
  meshTerms?: string[];
}

export interface CitationRelationship {
  sourceId: string;
  targetId: string;
  type: 'references' | 'citations' | 'similar';
  strength?: number;
}

export interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface NetworkNode {
  id: string;
  label: string;
  paper: Paper;
  x?: number;
  y?: number;
  z?: number;
  size?: number;
  color?: string;
  type: 'main' | 'reference' | 'citation' | 'similar';
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  type: 'references' | 'citations' | 'similar';
  weight?: number;
}

export type VisualizationMode = 'cytoscape' | 'd3' | 'timeline' | 'orbit' | 'universe';
