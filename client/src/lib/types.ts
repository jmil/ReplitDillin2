export interface Paper {
  id: string;
  pmid?: string;
  doi?: string;
  title: string;
  authors: string[];
  journal: string;
  publishDate: string;
  publishDateRaw?: string; // Original date string from PubMed API
  publishGranularity?: 'year' | 'month' | 'day'; // Level of date detail available
  abstract: string;
  citationCount?: number;
  volume?: string; // Journal volume number
  issue?: string; // Journal issue number
  pages?: string; // Page numbers (e.g., "123-130" or "e1234")
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
  clusterId?: string;
  clusterColor?: string;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  type: 'references' | 'citations' | 'similar';
  weight?: number;
}

export type VisualizationMode = 'cytoscape' | 'd3' | 'timeline' | 'orbit' | 'universe';

// Filter interfaces
export interface SearchFilters {
  searchQuery: string;
  yearRange: [number, number];
  paperTypes: ('main' | 'reference' | 'citation' | 'similar')[];
  journals: string[];
  authors: string[];
  minCitations: number;
  maxCitations: number;
  selectedClusters: string[];
}

export interface FilterStats {
  totalPapers: number;
  filteredPapers: number;
  yearRange: [number, number];
  availableJournals: string[];
  availableAuthors: string[];
  citationRange: [number, number];
  availableClusters: ClusterInfo[];
}

// Clustering interfaces
export type ClusteringAlgorithm = 'kmeans' | 'hierarchical' | 'community' | 'hybrid';

export interface ClusterInfo {
  id: string;
  name: string;
  description: string;
  color: string;
  paperIds: string[];
  size: number;
  keywords: string[];
  representativePaper?: Paper;
  coherenceScore?: number;
}

export interface FeatureVector {
  paperId: string;
  textFeatures: number[];
  networkFeatures: {
    degree: number;
    betweenness: number;
    closeness: number;
    clustering: number;
  };
  temporalFeatures: {
    publicationYear: number;
    citationAge: number;
  };
  categoricalFeatures: {
    journal: string;
    authors: string[];
    meshTerms: string[];
  };
}

export interface ClusteringConfig {
  algorithm: ClusteringAlgorithm;
  numClusters?: number;
  features: {
    useText: boolean;
    useNetwork: boolean;
    useTemporal: boolean;
    useCategorical: boolean;
  };
  textProcessing: {
    method: 'tfidf' | 'embeddings';
    minWordLength: number;
    maxFeatures: number;
    removeStopwords: boolean;
    scalingMethod?: 'zscore' | 'minmax';
  };
  networkWeights: {
    degree: number;
    betweenness: number;
    closeness: number;
    clustering: number;
  };
  featureWeights?: {
    text: number;
    network: number;
    temporal: number;
    categorical: number;
  };
  performance?: {
    useWebWorker?: boolean;
    maxSilhouetteSamples?: number;
    timeout?: number;
  };
}

export interface ClusteringResult {
  id: string;
  algorithm: ClusteringAlgorithm;
  config: ClusteringConfig;
  clusters: ClusterInfo[];
  assignments: Record<string, string>; // paperId -> clusterId
  quality: {
    silhouetteScore?: number;
    modularityScore?: number;
    inertia?: number;
  };
  createdAt: Date;
  processingTime: number;
}

export interface TextDocument {
  id: string;
  title: string;
  abstract: string;
  keywords: string[];
  meshTerms: string[];
  combinedText: string;
}

export interface ClusteringState {
  isActive: boolean;
  currentResult: ClusteringResult | null;
  availableResults: ClusteringResult[];
  isProcessing: boolean;
  config: ClusteringConfig;
}
