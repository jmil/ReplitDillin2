import { 
  Paper, 
  NetworkData, 
  NetworkNode, 
  NetworkEdge, 
  ClusteringAlgorithm,
  ClusteringConfig,
  ClusteringResult,
  ClusterInfo,
  FeatureVector 
} from "./types";
import { FeatureExtractor, SimilarityCalculator } from "./textProcessing";

/**
 * Utility functions for clustering
 */
export class ClusteringUtils {
  private static clusterColors = [
    "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", 
    "#EC4899", "#14B8A6", "#F97316", "#84CC16", "#6366F1",
    "#DC2626", "#059669", "#D97706", "#7C3AED", "#DB2777",
    "#0D9488", "#EA580C", "#65A30D", "#5B21B6", "#BE185D"
  ];

  /**
   * Get a color for a cluster
   */
  static getClusterColor(clusterIndex: number): string {
    return this.clusterColors[clusterIndex % this.clusterColors.length];
  }

  /**
   * Generate a unique cluster ID
   */
  static generateClusterId(): string {
    return `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate cluster centroid
   */
  static calculateCentroid(vectors: number[][]): number[] {
    if (vectors.length === 0) return [];
    
    const dimensions = vectors[0].length;
    const centroid = new Array(dimensions).fill(0);
    
    vectors.forEach(vector => {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += vector[i];
      }
    });
    
    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= vectors.length;
    }
    
    return centroid;
  }

  /**
   * Calculate Within-Cluster Sum of Squares (WCSS)
   */
  static calculateWCSS(vectors: number[][], assignments: number[], centroids: number[][]): number {
    let wcss = 0;
    
    vectors.forEach((vector, vectorIndex) => {
      const clusterIndex = assignments[vectorIndex];
      const centroid = centroids[clusterIndex];
      
      if (centroid) {
        const distance = SimilarityCalculator.euclideanDistance(vector, centroid);
        wcss += distance * distance; // Sum of squared distances
      }
    });
    
    return wcss;
  }

  /**
   * Calculate silhouette score for clustering quality (optimized for large datasets)
   */
  static calculateSilhouetteScore(
    vectors: number[][],
    clusterAssignments: number[],
    sampleSize: number = 800
  ): number {
    const n = vectors.length;
    if (n <= 1) return 0;

    // Use sampling for large datasets to improve performance
    const shouldSample = n > sampleSize;
    const sampleIndices = shouldSample ? 
      Array.from({length: sampleSize}, () => Math.floor(Math.random() * n)) :
      Array.from({length: n}, (_, i) => i);

    let totalScore = 0;
    const clusterCounts = new Map<number, number>();
    
    // Count points in each cluster
    clusterAssignments.forEach(cluster => {
      clusterCounts.set(cluster, (clusterCounts.get(cluster) || 0) + 1);
    });

    for (const i of sampleIndices) {
      const currentCluster = clusterAssignments[i];
      
      // Skip if cluster has only one point
      if (clusterCounts.get(currentCluster) === 1) continue;

      // Calculate average distance to points in same cluster (a)
      let aSum = 0;
      let aCount = 0;
      
      // Calculate minimum average distance to points in other clusters (b)
      const bScores = new Map<number, { sum: number; count: number }>();

      // Use a subset for distance calculations to improve performance
      const maxComparisons = Math.min(n, 200);
      const stepSize = Math.max(1, Math.floor(n / maxComparisons));
      
      for (let j = 0; j < n; j += stepSize) {
        if (i === j) continue;
        
        const distance = SimilarityCalculator.euclideanDistance(vectors[i], vectors[j]);
        const otherCluster = clusterAssignments[j];
        
        if (otherCluster === currentCluster) {
          aSum += distance;
          aCount++;
        } else {
          if (!bScores.has(otherCluster)) {
            bScores.set(otherCluster, { sum: 0, count: 0 });
          }
          const bScore = bScores.get(otherCluster)!;
          bScore.sum += distance;
          bScore.count++;
        }
      }

      const a = aCount > 0 ? aSum / aCount : 0;
      let b = Infinity;

      bScores.forEach(score => {
        const avgDistance = score.sum / score.count;
        b = Math.min(b, avgDistance);
      });

      if (b === Infinity) b = 0;

      const silhouette = (b - a) / Math.max(a, b);
      totalScore += silhouette;
    }

    return totalScore / sampleIndices.length;
  }
}

/**
 * K-means clustering implementation
 */
export class KMeansClusterer {
  private k: number;
  private maxIterations: number;
  private tolerance: number;

  constructor(k: number, maxIterations: number = 100, tolerance: number = 1e-4) {
    this.k = k;
    this.maxIterations = maxIterations;
    this.tolerance = tolerance;
  }

  /**
   * Perform K-means clustering
   */
  cluster(vectors: number[][]): { assignments: number[]; centroids: number[][]; iterations: number } {
    if (vectors.length === 0) {
      return { assignments: [], centroids: [], iterations: 0 };
    }

    const n = vectors.length;
    const d = vectors[0].length;
    
    // Initialize centroids randomly
    let centroids = this.initializeCentroids(vectors, this.k);
    let assignments = new Array(n).fill(0);
    let iterations = 0;

    for (let iter = 0; iter < this.maxIterations; iter++) {
      iterations = iter + 1;
      
      // Assign points to closest centroids
      const newAssignments = new Array(n);
      for (let i = 0; i < n; i++) {
        let minDistance = Infinity;
        let closestCentroid = 0;
        
        for (let j = 0; j < this.k; j++) {
          const distance = SimilarityCalculator.euclideanDistance(vectors[i], centroids[j]);
          if (distance < minDistance) {
            minDistance = distance;
            closestCentroid = j;
          }
        }
        
        newAssignments[i] = closestCentroid;
      }

      // Check for convergence
      const hasChanged = newAssignments.some((assignment, i) => assignment !== assignments[i]);
      assignments = newAssignments;
      
      if (!hasChanged) break;

      // Update centroids
      const newCentroids = new Array(this.k);
      for (let j = 0; j < this.k; j++) {
        const clusterPoints = vectors.filter((_, i) => assignments[i] === j);
        if (clusterPoints.length > 0) {
          newCentroids[j] = ClusteringUtils.calculateCentroid(clusterPoints);
        } else {
          // Keep old centroid if no points assigned
          newCentroids[j] = [...centroids[j]];
        }
      }

      // Check centroid convergence
      const centroidShift = centroids.reduce((maxShift, oldCentroid, j) => {
        const shift = SimilarityCalculator.euclideanDistance(oldCentroid, newCentroids[j]);
        return Math.max(maxShift, shift);
      }, 0);

      centroids = newCentroids;

      if (centroidShift < this.tolerance) break;
    }

    return { assignments, centroids, iterations };
  }

  /**
   * Initialize centroids using K-means++ algorithm
   */
  private initializeCentroids(vectors: number[][], k: number): number[][] {
    const centroids: number[][] = [];
    const n = vectors.length;

    // Choose first centroid randomly
    const firstIndex = Math.floor(Math.random() * n);
    centroids.push([...vectors[firstIndex]]);

    // Choose remaining centroids
    for (let i = 1; i < k; i++) {
      const distances = vectors.map(vector => {
        // Find distance to closest existing centroid
        let minDistance = Infinity;
        centroids.forEach(centroid => {
          const distance = SimilarityCalculator.euclideanDistance(vector, centroid);
          minDistance = Math.min(minDistance, distance);
        });
        return minDistance * minDistance; // Square the distance for probability
      });

      // Choose next centroid with probability proportional to squared distance
      const totalDistance = distances.reduce((sum, d) => sum + d, 0);
      let randomValue = Math.random() * totalDistance;
      
      let chosenIndex = 0;
      for (let j = 0; j < n; j++) {
        randomValue -= distances[j];
        if (randomValue <= 0) {
          chosenIndex = j;
          break;
        }
      }

      centroids.push([...vectors[chosenIndex]]);
    }

    return centroids;
  }
}

/**
 * Hierarchical clustering implementation
 */
export class HierarchicalClusterer {
  private linkage: 'single' | 'complete' | 'average';

  constructor(linkage: 'single' | 'complete' | 'average' = 'average') {
    this.linkage = linkage;
  }

  /**
   * Perform hierarchical clustering
   */
  cluster(vectors: number[][], numClusters: number): { assignments: number[]; dendrogram: any[] } {
    const n = vectors.length;
    if (n === 0) return { assignments: [], dendrogram: [] };

    // Calculate distance matrix
    const distanceMatrix = this.calculateDistanceMatrix(vectors);
    
    // Initialize clusters (each point starts as its own cluster)
    const clusters = vectors.map((_, i) => [i]);
    const dendrogram = [];
    
    // Merge clusters until we have the desired number
    while (clusters.length > numClusters) {
      // Find closest pair of clusters
      let minDistance = Infinity;
      let mergeIndices = [0, 1];
      
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const distance = this.calculateClusterDistance(
            clusters[i], 
            clusters[j], 
            distanceMatrix
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            mergeIndices = [i, j];
          }
        }
      }

      // Merge the closest clusters
      const [i, j] = mergeIndices;
      const mergedCluster = [...clusters[i], ...clusters[j]];
      
      dendrogram.push({
        clusters: [clusters[i], clusters[j]],
        distance: minDistance,
        size: mergedCluster.length
      });

      // Remove merged clusters and add new cluster
      clusters.splice(j, 1); // Remove j first (higher index)
      clusters.splice(i, 1); // Then remove i
      clusters.push(mergedCluster);
    }

    // Create final assignments
    const assignments = new Array(n);
    clusters.forEach((cluster, clusterIndex) => {
      cluster.forEach(pointIndex => {
        assignments[pointIndex] = clusterIndex;
      });
    });

    return { assignments, dendrogram };
  }

  /**
   * Calculate distance matrix between all points
   */
  private calculateDistanceMatrix(vectors: number[][]): number[][] {
    const n = vectors.length;
    const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const distance = SimilarityCalculator.euclideanDistance(vectors[i], vectors[j]);
        matrix[i][j] = distance;
        matrix[j][i] = distance;
      }
    }
    
    return matrix;
  }

  /**
   * Calculate distance between two clusters based on linkage method
   */
  private calculateClusterDistance(
    clusterA: number[], 
    clusterB: number[], 
    distanceMatrix: number[][]
  ): number {
    const distances: number[] = [];
    
    clusterA.forEach(i => {
      clusterB.forEach(j => {
        distances.push(distanceMatrix[i][j]);
      });
    });

    switch (this.linkage) {
      case 'single':
        return Math.min(...distances);
      case 'complete':
        return Math.max(...distances);
      case 'average':
        return distances.reduce((sum, d) => sum + d, 0) / distances.length;
      default:
        return distances.reduce((sum, d) => sum + d, 0) / distances.length;
    }
  }
}

/**
 * Community detection for network-based clustering
 */
export class CommunityDetector {
  /**
   * Perform community detection using modularity optimization
   */
  detectCommunities(networkData: NetworkData): { assignments: Record<string, number>; modularity: number } {
    const nodeIds = networkData.nodes.map(node => node.id);
    const nodeIndexMap = new Map(nodeIds.map((id, index) => [id, index]));
    
    // Build adjacency matrix
    const n = nodeIds.length;
    const adjacencyMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
    
    networkData.edges.forEach(edge => {
      const sourceIndex = nodeIndexMap.get(edge.source);
      const targetIndex = nodeIndexMap.get(edge.target);
      
      if (sourceIndex !== undefined && targetIndex !== undefined) {
        adjacencyMatrix[sourceIndex][targetIndex] = edge.weight || 1;
        adjacencyMatrix[targetIndex][sourceIndex] = edge.weight || 1;
      }
    });

    // Initialize each node as its own community
    const communities = nodeIds.map((_, i) => i);
    let bestModularity = this.calculateModularity(adjacencyMatrix, communities);
    let improved = true;
    
    // Greedily improve modularity
    while (improved) {
      improved = false;
      
      for (let i = 0; i < n; i++) {
        const currentCommunity = communities[i];
        let bestCommunity = currentCommunity;
        let bestScore = bestModularity;
        
        // Try moving node to each neighbor's community
        for (let j = 0; j < n; j++) {
          if (i === j || adjacencyMatrix[i][j] === 0) continue;
          
          const neighborCommunity = communities[j];
          if (neighborCommunity === currentCommunity) continue;
          
          // Temporarily move node
          communities[i] = neighborCommunity;
          const newModularity = this.calculateModularity(adjacencyMatrix, communities);
          
          if (newModularity > bestScore) {
            bestScore = newModularity;
            bestCommunity = neighborCommunity;
            improved = true;
          }
          
          // Restore original community
          communities[i] = currentCommunity;
        }
        
        // Apply best move
        if (bestCommunity !== currentCommunity) {
          communities[i] = bestCommunity;
          bestModularity = bestScore;
        }
      }
    }

    // Create assignments object
    const assignments: Record<string, number> = {};
    nodeIds.forEach((nodeId, index) => {
      assignments[nodeId] = communities[index];
    });

    return { assignments, modularity: bestModularity };
  }

  /**
   * Calculate modularity score
   */
  private calculateModularity(adjacencyMatrix: number[][], communities: number[]): number {
    const n = adjacencyMatrix.length;
    let totalEdges = 0;
    
    // Calculate total number of edges
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        totalEdges += adjacencyMatrix[i][j];
      }
    }
    
    if (totalEdges === 0) return 0;

    let modularity = 0;
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (communities[i] === communities[j]) {
          // Calculate degree of nodes
          const degreeI = adjacencyMatrix[i].reduce((sum, weight) => sum + weight, 0);
          const degreeJ = adjacencyMatrix[j].reduce((sum, weight) => sum + weight, 0);
          
          const expected = (degreeI * degreeJ) / (2 * totalEdges);
          modularity += adjacencyMatrix[i][j] - expected;
        }
      }
    }
    
    return modularity / (2 * totalEdges);
  }
}

/**
 * Feature scaling utilities
 */
class FeatureScaler {
  /**
   * Calculate z-score normalization parameters
   */
  static calculateZScoreParams(values: number[]): { mean: number; std: number } {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    return { mean, std: std === 0 ? 1 : std }; // Avoid division by zero
  }

  /**
   * Calculate min-max normalization parameters
   */
  static calculateMinMaxParams(values: number[]): { min: number; max: number } {
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { min, max: max === min ? min + 1 : max }; // Avoid division by zero
  }

  /**
   * Apply z-score normalization
   */
  static zScoreNormalize(value: number, mean: number, std: number): number {
    return (value - mean) / std;
  }

  /**
   * Apply min-max normalization
   */
  static minMaxNormalize(value: number, min: number, max: number): number {
    return (value - min) / (max - min);
  }

  /**
   * Scale feature vectors using specified method
   */
  static scaleFeatures(
    vectors: number[][],
    method: 'zscore' | 'minmax' = 'zscore'
  ): { scaledVectors: number[][]; params: any } {
    if (vectors.length === 0 || vectors[0].length === 0) {
      return { scaledVectors: vectors, params: {} };
    }

    const dimensions = vectors[0].length;
    const params: any = {};
    const scaledVectors: number[][] = [];

    // Calculate scaling parameters for each dimension
    for (let dim = 0; dim < dimensions; dim++) {
      const values = vectors.map(vector => vector[dim]);
      
      if (method === 'zscore') {
        params[dim] = this.calculateZScoreParams(values);
      } else {
        params[dim] = this.calculateMinMaxParams(values);
      }
    }

    // Apply scaling
    for (let i = 0; i < vectors.length; i++) {
      const scaledVector: number[] = [];
      for (let dim = 0; dim < dimensions; dim++) {
        const value = vectors[i][dim];
        
        if (method === 'zscore') {
          const { mean, std } = params[dim];
          scaledVector[dim] = this.zScoreNormalize(value, mean, std);
        } else {
          const { min, max } = params[dim];
          scaledVector[dim] = this.minMaxNormalize(value, min, max);
        }
      }
      scaledVectors[i] = scaledVector;
    }

    return { scaledVectors, params };
  }
}

/**
 * Main clustering engine that orchestrates different algorithms
 */
export class ClusteringEngine {
  private featureExtractor: FeatureExtractor;

  constructor() {
    this.featureExtractor = new FeatureExtractor();
  }

  /**
   * Perform clustering using the specified configuration
   */
  async performClustering(
    papers: Paper[],
    networkData: NetworkData,
    config: ClusteringConfig
  ): Promise<ClusteringResult> {
    const startTime = Date.now();
    
    // Prepare features
    this.featureExtractor.fit(papers);
    const features = papers.map(paper => 
      this.featureExtractor.extractFeatures(paper)
    );

    // Combine features based on configuration
    const vectors = this.combineFeatures(features, config);
    
    let assignments: number[] | Map<string, number>;
    let quality: any = {};
    let clusters: ClusterInfo[] = [];

    // Apply clustering algorithm
    switch (config.algorithm) {
      case 'kmeans':
        const kMeans = new KMeansClusterer(config.numClusters || 5);
        const kmeansResult = kMeans.cluster(vectors);
        assignments = kmeansResult.assignments;
        quality.silhouetteScore = ClusteringUtils.calculateSilhouetteScore(vectors, assignments);
        quality.inertia = ClusteringUtils.calculateWCSS(vectors, assignments, kmeansResult.centroids);
        break;

      case 'hierarchical':
        const hierarchical = new HierarchicalClusterer();
        const hierarchicalResult = hierarchical.cluster(vectors, config.numClusters || 5);
        assignments = hierarchicalResult.assignments;
        quality.silhouetteScore = ClusteringUtils.calculateSilhouetteScore(vectors, assignments);
        break;

      case 'community':
        const communityDetector = new CommunityDetector();
        const communityResult = communityDetector.detectCommunities(networkData);
        assignments = communityResult.assignments;
        quality.modularityScore = communityResult.modularity;
        
        // Convert Map to array for consistency
        const nodeAssignments = Array.from(assignments.values());
        quality.silhouetteScore = ClusteringUtils.calculateSilhouetteScore(vectors, nodeAssignments);
        break;

      case 'hybrid':
        // Combine text clustering with community detection
        const textClusters = new KMeansClusterer(config.numClusters || 5).cluster(vectors);
        const communityClusters = new CommunityDetector().detectCommunities(networkData);
        
        // Merge results (simplified approach)
        assignments = textClusters.assignments;
        quality.silhouetteScore = ClusteringUtils.calculateSilhouetteScore(vectors, assignments);
        quality.modularityScore = communityClusters.modularity;
        break;

      default:
        throw new Error(`Unknown clustering algorithm: ${config.algorithm}`);
    }

    // Create cluster information
    clusters = this.createClusterInfo(papers, assignments, config);

    const processingTime = Date.now() - startTime;

    // Create serializable assignments object
    const assignmentsObject: Record<string, string> = {};
    
    if (assignments instanceof Map) {
      assignments.forEach((clusterId, paperId) => {
        assignmentsObject[paperId] = clusterId.toString();
      });
    } else {
      papers.forEach((paper, index) => {
        assignmentsObject[paper.id] = (assignments as number[])[index].toString();
      });
    }

    return {
      id: ClusteringUtils.generateClusterId(),
      algorithm: config.algorithm,
      config,
      clusters,
      assignments: assignmentsObject,
      quality,
      createdAt: new Date(),
      processingTime
    };
  }

  /**
   * Combine and normalize features based on configuration
   */
  private combineFeatures(features: FeatureVector[], config: ClusteringConfig): number[][] {
    // Separate feature types for independent normalization
    const textVectors: number[][] = [];
    const networkVectors: number[][] = [];
    const temporalVectors: number[][] = [];
    const categoricalVectors: number[][] = [];

    // Extract each feature type separately
    features.forEach(feature => {
      if (config.features.useText) {
        textVectors.push(feature.textFeatures);
      }

      if (config.features.useNetwork) {
        const networkWeights = config.networkWeights;
        networkVectors.push([
          feature.networkFeatures.degree * networkWeights.degree,
          feature.networkFeatures.betweenness * networkWeights.betweenness,
          feature.networkFeatures.closeness * networkWeights.closeness,
          feature.networkFeatures.clustering * networkWeights.clustering
        ]);
      }

      if (config.features.useTemporal) {
        temporalVectors.push([
          feature.temporalFeatures.publicationYear,
          feature.temporalFeatures.citationAge
        ]);
      }

      if (config.features.useCategorical) {
        categoricalVectors.push([
          feature.categoricalFeatures.authors.length,
          feature.categoricalFeatures.meshTerms.length
        ]);
      }
    });

    // Normalize each feature type independently
    const scalingMethod = config.textProcessing?.scalingMethod || 'zscore';
    const normalizedFeatures: {
      text?: number[][];
      network?: number[][];
      temporal?: number[][];
      categorical?: number[][];
    } = {};

    if (textVectors.length > 0) {
      normalizedFeatures.text = FeatureScaler.scaleFeatures(textVectors, scalingMethod).scaledVectors;
    }

    if (networkVectors.length > 0) {
      normalizedFeatures.network = FeatureScaler.scaleFeatures(networkVectors, scalingMethod).scaledVectors;
    }

    if (temporalVectors.length > 0) {
      normalizedFeatures.temporal = FeatureScaler.scaleFeatures(temporalVectors, scalingMethod).scaledVectors;
    }

    if (categoricalVectors.length > 0) {
      normalizedFeatures.categorical = FeatureScaler.scaleFeatures(categoricalVectors, scalingMethod).scaledVectors;
    }

    // Combine normalized features with proper weights
    const featureWeights = config.featureWeights || {
      text: 1.0,
      network: 0.8,
      temporal: 0.3,
      categorical: 0.2
    };

    return features.map((_, index) => {
      const combinedVector: number[] = [];

      if (normalizedFeatures.text) {
        const weightedFeatures = normalizedFeatures.text[index].map(val => val * featureWeights.text);
        combinedVector.push(...weightedFeatures);
      }

      if (normalizedFeatures.network) {
        const weightedFeatures = normalizedFeatures.network[index].map(val => val * featureWeights.network);
        combinedVector.push(...weightedFeatures);
      }

      if (normalizedFeatures.temporal) {
        const weightedFeatures = normalizedFeatures.temporal[index].map(val => val * featureWeights.temporal);
        combinedVector.push(...weightedFeatures);
      }

      if (normalizedFeatures.categorical) {
        const weightedFeatures = normalizedFeatures.categorical[index].map(val => val * featureWeights.categorical);
        combinedVector.push(...weightedFeatures);
      }

      return combinedVector;
    });
  }

  /**
   * Create cluster information from assignments
   */
  private createClusterInfo(
    papers: Paper[],
    assignments: number[] | Map<string, number>,
    config: ClusteringConfig
  ): ClusterInfo[] {
    const clusterMap = new Map<number, Paper[]>();

    // Group papers by cluster
    if (assignments instanceof Map) {
      papers.forEach(paper => {
        const clusterId = assignments.get(paper.id);
        if (clusterId !== undefined) {
          if (!clusterMap.has(clusterId)) {
            clusterMap.set(clusterId, []);
          }
          clusterMap.get(clusterId)!.push(paper);
        }
      });
    } else {
      papers.forEach((paper, index) => {
        const clusterId = assignments[index];
        if (!clusterMap.has(clusterId)) {
          clusterMap.set(clusterId, []);
        }
        clusterMap.get(clusterId)!.push(paper);
      });
    }

    // Create cluster info
    const clusters: ClusterInfo[] = [];
    let clusterIndex = 0;

    clusterMap.forEach((clusterPapers, clusterId) => {
      const themes = this.featureExtractor.extractThemes(clusterPapers, 5);
      const clusterName = this.generateClusterName(themes);
      
      clusters.push({
        id: `cluster_${clusterId}`,
        name: clusterName,
        description: `Cluster containing ${clusterPapers.length} papers related to ${themes.slice(0, 3).map(t => t.word).join(', ')}`,
        color: ClusteringUtils.getClusterColor(clusterIndex),
        paperIds: clusterPapers.map(p => p.id),
        size: clusterPapers.length,
        keywords: themes.map(t => t.word),
        representativePaper: this.findRepresentativePaper(clusterPapers),
        coherenceScore: this.calculateClusterCoherence(clusterPapers)
      });

      clusterIndex++;
    });

    return clusters;
  }

  /**
   * Generate a name for a cluster based on themes
   */
  private generateClusterName(themes: { word: string; score: number }[]): string {
    if (themes.length === 0) return "Uncategorized";
    
    const topThemes = themes.slice(0, 2).map(t => t.word);
    return topThemes.map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" & ") + " Research";
  }

  /**
   * Find the most representative paper in a cluster
   */
  private findRepresentativePaper(papers: Paper[]): Paper {
    // Simple heuristic: paper with highest citation count
    return papers.reduce((best, current) => {
      const bestCitations = best.citationCount || 0;
      const currentCitations = current.citationCount || 0;
      return currentCitations > bestCitations ? current : best;
    });
  }

  /**
   * Calculate cluster coherence score
   */
  private calculateClusterCoherence(papers: Paper[]): number {
    if (papers.length <= 1) return 1.0;

    // Calculate average pairwise similarity
    let totalSimilarity = 0;
    let pairCount = 0;

    for (let i = 0; i < papers.length; i++) {
      for (let j = i + 1; j < papers.length; j++) {
        // Simple text similarity based on common words
        const wordsA = new Set(papers[i].title.toLowerCase().split(/\W+/));
        const wordsB = new Set(papers[j].title.toLowerCase().split(/\W+/));
        const intersection = new Set(Array.from(wordsA).filter(x => wordsB.has(x)));
        const union = new Set(Array.from(wordsA).concat(Array.from(wordsB)));
        
        const similarity = union.size > 0 ? intersection.size / union.size : 0;
        totalSimilarity += similarity;
        pairCount++;
      }
    }

    return pairCount > 0 ? totalSimilarity / pairCount : 0;
  }
}

// Default configuration
export const defaultClusteringConfig: ClusteringConfig = {
  algorithm: 'kmeans',
  numClusters: 5,
  features: {
    useText: true,
    useNetwork: true,
    useTemporal: true,
    useCategorical: true
  },
  textProcessing: {
    method: 'tfidf',
    minWordLength: 3,
    maxFeatures: 1000,
    removeStopwords: true,
    scalingMethod: 'zscore'
  },
  networkWeights: {
    degree: 1.0,
    betweenness: 1.0,
    closeness: 1.0,
    clustering: 1.0
  },
  featureWeights: {
    text: 1.0,
    network: 0.8,
    temporal: 0.3,
    categorical: 0.2
  },
  performance: {
    useWebWorker: false, // Will be implemented later
    maxSilhouetteSamples: 800,
    timeout: 300000 // 5 minutes
  }
};

// Export default instance
export const defaultClusteringEngine = new ClusteringEngine();