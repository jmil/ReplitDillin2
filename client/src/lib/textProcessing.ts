import { Paper, TextDocument, FeatureVector } from "./types";

// Common English stop words
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'the', 'this', 'but', 'they',
  'have', 'had', 'what', 'said', 'each', 'which', 'their', 'time',
  'if', 'up', 'out', 'many', 'then', 'them', 'these', 'so', 'some',
  'her', 'would', 'make', 'like', 'into', 'him', 'two', 'more',
  'go', 'no', 'way', 'could', 'my', 'than', 'first', 'been', 'call',
  'who', 'oil', 'sit', 'now', 'find', 'down', 'day', 'did', 'get',
  'come', 'made', 'may', 'part'
]);

// Medical/research specific stop words
const RESEARCH_STOP_WORDS = new Set([
  'study', 'analysis', 'result', 'conclusion', 'method', 'background',
  'objective', 'purpose', 'finding', 'research', 'data', 'patient',
  'patients', 'group', 'groups', 'clinical', 'trial', 'test', 'treatment',
  'therapy', 'drug', 'showed', 'demonstrate', 'observed', 'measured',
  'significant', 'significantly', 'compared', 'control', 'controls',
  'versus', 'between', 'among', 'within', 'results', 'conclusions',
  'methods', 'findings', 'studies', 'trials', 'treatments', 'therapies'
]);

const ALL_STOP_WORDS = new Set(Array.from(STOP_WORDS).concat(Array.from(RESEARCH_STOP_WORDS)));

/**
 * Text preprocessing utilities
 */
export class TextProcessor {
  private minWordLength: number;
  private removeStopwords: boolean;
  private maxFeatures: number;

  constructor(
    minWordLength: number = 3,
    removeStopwords: boolean = true,
    maxFeatures: number = 5000
  ) {
    this.minWordLength = minWordLength;
    this.removeStopwords = removeStopwords;
    this.maxFeatures = maxFeatures;
  }

  /**
   * Clean and normalize text
   */
  preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Remove punctuation
      .replace(/\s+/g, ' ')      // Normalize whitespace
      .trim();
  }

  /**
   * Tokenize text into words
   */
  tokenize(text: string): string[] {
    const preprocessed = this.preprocessText(text);
    const tokens = preprocessed.split(/\s+/).filter(token => {
      if (token.length < this.minWordLength) return false;
      if (this.removeStopwords && ALL_STOP_WORDS.has(token)) return false;
      return true;
    });
    return tokens;
  }

  /**
   * Extract keywords from text using frequency analysis
   */
  extractKeywords(text: string, topK: number = 10): { word: string; score: number }[] {
    const tokens = this.tokenize(text);
    const frequency = new Map<string, number>();

    // Count word frequencies
    tokens.forEach(token => {
      frequency.set(token, (frequency.get(token) || 0) + 1);
    });

    // Calculate keyword scores (simple frequency-based)
    const keywords = Array.from(frequency.entries())
      .map(([word, freq]) => ({
        word,
        score: freq / tokens.length // Normalize by document length
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return keywords;
  }

  /**
   * Create a text document from paper data
   */
  createTextDocument(paper: Paper): TextDocument {
    const titleText = paper.title || '';
    const abstractText = paper.abstract || '';
    const meshText = (paper.meshTerms || []).join(' ');
    const authorText = (paper.authors || []).join(' ');

    const combinedText = [titleText, abstractText, meshText, authorText]
      .filter(text => text.length > 0)
      .join(' ');

    return {
      id: paper.id,
      title: titleText,
      abstract: abstractText,
      keywords: this.extractKeywords(combinedText, 15).map(k => k.word),
      meshTerms: paper.meshTerms || [],
      combinedText
    };
  }
}

/**
 * TF-IDF (Term Frequency-Inverse Document Frequency) implementation
 */
export class TFIDFVectorizer {
  private vocabulary: Map<string, number> = new Map();
  private idfScores: Map<string, number> = new Map();
  private textProcessor: TextProcessor;
  private maxFeatures: number;

  constructor(textProcessor: TextProcessor, maxFeatures: number = 5000) {
    this.textProcessor = textProcessor;
    this.maxFeatures = maxFeatures;
  }

  /**
   * Fit the vectorizer on a collection of documents
   */
  fit(documents: TextDocument[]): void {
    const termDocumentCounts = new Map<string, number>();
    const totalDocuments = documents.length;

    // Build vocabulary and count document frequencies
    documents.forEach(doc => {
      const tokens = this.textProcessor.tokenize(doc.combinedText);
      const uniqueTokens = new Set(tokens);

      uniqueTokens.forEach(token => {
        termDocumentCounts.set(token, (termDocumentCounts.get(token) || 0) + 1);
      });
    });

    // Sort terms by document frequency and take top features
    const sortedTerms = Array.from(termDocumentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.maxFeatures);

    // Build vocabulary with indices
    sortedTerms.forEach(([term, docFreq], index) => {
      this.vocabulary.set(term, index);
      // Calculate IDF: log(total_docs / docs_containing_term)
      this.idfScores.set(term, Math.log(totalDocuments / docFreq));
    });
  }

  /**
   * Transform a document into a TF-IDF vector
   */
  transform(document: TextDocument): number[] {
    const tokens = this.textProcessor.tokenize(document.combinedText);
    const termFrequencies = new Map<string, number>();

    // Count term frequencies
    tokens.forEach(token => {
      if (this.vocabulary.has(token)) {
        termFrequencies.set(token, (termFrequencies.get(token) || 0) + 1);
      }
    });

    // Create TF-IDF vector
    const vector = new Array(this.vocabulary.size).fill(0);
    const totalTerms = tokens.length;

    termFrequencies.forEach((freq, term) => {
      const vocabIndex = this.vocabulary.get(term);
      if (vocabIndex !== undefined) {
        const tf = freq / totalTerms; // Term frequency
        const idf = this.idfScores.get(term) || 0; // Inverse document frequency
        vector[vocabIndex] = tf * idf;
      }
    });

    return vector;
  }

  /**
   * Get the vocabulary as an array of terms
   */
  getVocabulary(): string[] {
    const vocab = new Array(this.vocabulary.size);
    this.vocabulary.forEach((index, term) => {
      vocab[index] = term;
    });
    return vocab;
  }

  /**
   * Get the size of the vocabulary
   */
  getVocabularySize(): number {
    return this.vocabulary.size;
  }
}

/**
 * Similarity calculations
 */
export class SimilarityCalculator {
  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0; // Handle zero vectors
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Calculate Euclidean distance between two vectors
   */
  static euclideanDistance(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let sumSquaredDiffs = 0;
    for (let i = 0; i < vecA.length; i++) {
      const diff = vecA[i] - vecB[i];
      sumSquaredDiffs += diff * diff;
    }

    return Math.sqrt(sumSquaredDiffs);
  }

  /**
   * Calculate Jaccard similarity for keyword sets
   */
  static jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    const intersection = new Set(Array.from(setA).filter(x => setB.has(x)));
    const union = new Set(Array.from(setA).concat(Array.from(setB)));

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  /**
   * Calculate text similarity using multiple metrics
   */
  static textSimilarity(
    docA: TextDocument,
    docB: TextDocument,
    tfidfVecA?: number[],
    tfidfVecB?: number[]
  ): number {
    let totalSimilarity = 0;
    let weights = 0;

    // TF-IDF cosine similarity (if vectors provided)
    if (tfidfVecA && tfidfVecB) {
      const tfidfSim = this.cosineSimilarity(tfidfVecA, tfidfVecB);
      totalSimilarity += tfidfSim * 0.6;
      weights += 0.6;
    }

    // Keyword Jaccard similarity
    const keywordsA = new Set(docA.keywords);
    const keywordsB = new Set(docB.keywords);
    const keywordSim = this.jaccardSimilarity(keywordsA, keywordsB);
    totalSimilarity += keywordSim * 0.3;
    weights += 0.3;

    // MeSH terms similarity
    const meshA = new Set(docA.meshTerms);
    const meshB = new Set(docB.meshTerms);
    const meshSim = this.jaccardSimilarity(meshA, meshB);
    totalSimilarity += meshSim * 0.1;
    weights += 0.1;

    return weights > 0 ? totalSimilarity / weights : 0;
  }
}

/**
 * Feature extraction for papers
 */
export class FeatureExtractor {
  private textProcessor: TextProcessor;
  private tfidfVectorizer: TFIDFVectorizer;
  private documentCache: Map<string, TextDocument> = new Map();

  constructor(
    minWordLength: number = 3,
    removeStopwords: boolean = true,
    maxFeatures: number = 5000
  ) {
    this.textProcessor = new TextProcessor(minWordLength, removeStopwords, maxFeatures);
    this.tfidfVectorizer = new TFIDFVectorizer(this.textProcessor, maxFeatures);
  }

  /**
   * Prepare documents for feature extraction
   */
  prepareDocuments(papers: Paper[]): TextDocument[] {
    const documents = papers.map(paper => {
      if (!this.documentCache.has(paper.id)) {
        const doc = this.textProcessor.createTextDocument(paper);
        this.documentCache.set(paper.id, doc);
      }
      return this.documentCache.get(paper.id)!;
    });

    return documents;
  }

  /**
   * Fit the feature extractor on papers
   */
  fit(papers: Paper[]): void {
    const documents = this.prepareDocuments(papers);
    this.tfidfVectorizer.fit(documents);
  }

  /**
   * Extract comprehensive features for a paper
   */
  extractFeatures(paper: Paper, networkData?: any): FeatureVector {
    const document = this.textProcessor.createTextDocument(paper);
    const textFeatures = this.tfidfVectorizer.transform(document);

    // Network features (defaults if no network data provided)
    const networkFeatures = {
      degree: networkData?.degree || 0,
      betweenness: networkData?.betweenness || 0,
      closeness: networkData?.closeness || 0,
      clustering: networkData?.clustering || 0
    };

    // Temporal features
    const publicationDate = new Date(paper.publishDate);
    const currentYear = new Date().getFullYear();
    const temporalFeatures = {
      publicationYear: publicationDate.getFullYear(),
      citationAge: currentYear - publicationDate.getFullYear()
    };

    // Categorical features
    const categoricalFeatures = {
      journal: paper.journal,
      authors: paper.authors || [],
      meshTerms: paper.meshTerms || []
    };

    return {
      paperId: paper.id,
      textFeatures,
      networkFeatures,
      temporalFeatures,
      categoricalFeatures
    };
  }

  /**
   * Get similarity matrix for papers
   */
  getSimilarityMatrix(papers: Paper[]): number[][] {
    const documents = this.prepareDocuments(papers);
    const vectors = documents.map(doc => this.tfidfVectorizer.transform(doc));
    
    const matrix: number[][] = [];
    for (let i = 0; i < papers.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < papers.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          matrix[i][j] = SimilarityCalculator.textSimilarity(
            documents[i],
            documents[j],
            vectors[i],
            vectors[j]
          );
        }
      }
    }

    return matrix;
  }

  /**
   * Extract common themes from a group of papers
   */
  extractThemes(papers: Paper[], topK: number = 10): { word: string; score: number }[] {
    const allText = papers
      .map(paper => `${paper.title} ${paper.abstract} ${(paper.meshTerms || []).join(' ')}`)
      .join(' ');

    return this.textProcessor.extractKeywords(allText, topK);
  }

  /**
   * Get the vocabulary from the TF-IDF vectorizer
   */
  getVocabulary(): string[] {
    return this.tfidfVectorizer.getVocabulary();
  }
}

// Export default instances for convenience
export const defaultTextProcessor = new TextProcessor();
export const defaultFeatureExtractor = new FeatureExtractor();