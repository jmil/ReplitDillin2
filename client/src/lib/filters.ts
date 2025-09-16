import { Paper, NetworkData, NetworkNode, NetworkEdge, SearchFilters, FilterStats, ClusterInfo } from "./types";

// Default filters
export const defaultFilters: SearchFilters = {
  searchQuery: '',
  yearRange: [1900, new Date().getFullYear()],
  paperTypes: ['main', 'reference', 'citation', 'similar'],
  journals: [],
  authors: [],
  minCitations: 0,
  maxCitations: Infinity,
  selectedClusters: []
};

// Create filter statistics from papers
export function createFilterStats(papers: Paper[], clusters: ClusterInfo[] = []): FilterStats {
  if (papers.length === 0) {
    return {
      totalPapers: 0,
      filteredPapers: 0,
      yearRange: [new Date().getFullYear(), new Date().getFullYear()],
      availableJournals: [],
      availableAuthors: [],
      citationRange: [0, 0],
      availableClusters: []
    };
  }

  const years = papers.map(p => new Date(p.publishDate).getFullYear()).filter(y => !isNaN(y));
  const journals = Array.from(new Set(papers.map(p => p.journal).filter(Boolean))).sort();
  const authors = Array.from(new Set(papers.flatMap(p => p.authors || []))).sort();
  const citations = papers.map(p => p.citationCount || 0);

  return {
    totalPapers: papers.length,
    filteredPapers: papers.length,
    yearRange: years.length > 0 ? [Math.min(...years), Math.max(...years)] : [new Date().getFullYear(), new Date().getFullYear()],
    availableJournals: journals,
    availableAuthors: authors,
    citationRange: citations.length > 0 ? [Math.min(...citations), Math.max(...citations)] : [0, 0],
    availableClusters: clusters
  };
}

// Search function for papers
export function searchPapers(papers: Paper[], query: string): Paper[] {
  if (!query.trim()) return papers;

  const searchTerms = query.toLowerCase().split(/\s+/);
  
  return papers.filter(paper => {
    const searchableText = [
      paper.title,
      paper.abstract,
      paper.journal,
      ...(paper.authors || []),
      ...(paper.meshTerms || [])
    ].join(' ').toLowerCase();

    // Check if all search terms are present
    return searchTerms.every(term => searchableText.includes(term));
  });
}

// Filter papers based on criteria
export function filterPapers(papers: Paper[], filters: SearchFilters): Paper[] {
  return papers.filter(paper => {
    // Search query filter
    if (filters.searchQuery.trim()) {
      const searchableText = [
        paper.title,
        paper.abstract,
        paper.journal,
        ...(paper.authors || []),
        ...(paper.meshTerms || [])
      ].join(' ').toLowerCase();

      const searchTerms = filters.searchQuery.toLowerCase().split(/\s+/);
      const matchesSearch = searchTerms.every(term => searchableText.includes(term));
      if (!matchesSearch) return false;
    }

    // Year range filter
    const paperYear = new Date(paper.publishDate).getFullYear();
    if (paperYear < filters.yearRange[0] || paperYear > filters.yearRange[1]) {
      return false;
    }

    // Journal filter
    if (filters.journals.length > 0 && !filters.journals.includes(paper.journal)) {
      return false;
    }

    // Author filter
    if (filters.authors.length > 0) {
      const hasMatchingAuthor = filters.authors.some(filterAuthor => 
        (paper.authors || []).some(paperAuthor => 
          paperAuthor.toLowerCase().includes(filterAuthor.toLowerCase())
        )
      );
      if (!hasMatchingAuthor) return false;
    }

    // Citation count filter
    const citationCount = paper.citationCount || 0;
    if (citationCount < filters.minCitations || citationCount > filters.maxCitations) {
      return false;
    }

    return true;
  });
}

// Filter network data based on criteria
export function filterNetworkData(networkData: NetworkData, filters: SearchFilters): NetworkData {
  // First filter nodes based on paper criteria and paper types
  const filteredNodes = networkData.nodes.filter(node => {
    // Paper type filter
    if (!filters.paperTypes.includes(node.type)) {
      return false;
    }

    // Apply paper filters
    const matchesFilters = filterPapers([node.paper], filters).length > 0;
    return matchesFilters;
  });

  // Get IDs of remaining nodes
  const remainingNodeIds = new Set(filteredNodes.map(node => node.id));

  // Filter edges to only include those between remaining nodes
  const filteredEdges = networkData.edges.filter(edge => 
    remainingNodeIds.has(edge.source) && remainingNodeIds.has(edge.target)
  );

  return {
    nodes: filteredNodes,
    edges: filteredEdges
  };
}

// Get unique values for filter dropdowns
export function getUniqueJournals(papers: Paper[]): string[] {
  return Array.from(new Set(papers.map(p => p.journal).filter(Boolean))).sort();
}

export function getUniqueAuthors(papers: Paper[]): string[] {
  return Array.from(new Set(papers.flatMap(p => p.authors || []))).sort();
}

// Highlight search terms in text
export function highlightSearchTerms(text: string, searchQuery: string): string {
  if (!searchQuery.trim()) return text;

  const terms = searchQuery.toLowerCase().split(/\s+/);
  let highlightedText = text;

  terms.forEach(term => {
    if (term.length > 2) { // Only highlight terms longer than 2 characters
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
    }
  });

  return highlightedText;
}

// Get year range from papers
export function getYearRangeFromPapers(papers: Paper[]): [number, number] {
  if (papers.length === 0) {
    const currentYear = new Date().getFullYear();
    return [currentYear - 10, currentYear];
  }

  const years = papers
    .map(p => new Date(p.publishDate).getFullYear())
    .filter(year => !isNaN(year));

  if (years.length === 0) {
    const currentYear = new Date().getFullYear();
    return [currentYear - 10, currentYear];
  }

  return [Math.min(...years), Math.max(...years)];
}

// Get citation count range from papers
export function getCitationRangeFromPapers(papers: Paper[]): [number, number] {
  const citations = papers
    .map(p => p.citationCount || 0)
    .filter(count => typeof count === 'number');

  if (citations.length === 0) {
    return [0, 100];
  }

  return [Math.min(...citations), Math.max(...citations)];
}

// Check if filters are active (different from defaults)
export function hasActiveFilters(filters: SearchFilters, defaultFilters: SearchFilters): boolean {
  return (
    filters.searchQuery !== defaultFilters.searchQuery ||
    filters.yearRange[0] !== defaultFilters.yearRange[0] ||
    filters.yearRange[1] !== defaultFilters.yearRange[1] ||
    filters.paperTypes.length !== defaultFilters.paperTypes.length ||
    filters.journals.length > 0 ||
    filters.authors.length > 0 ||
    filters.minCitations !== defaultFilters.minCitations ||
    filters.maxCitations !== defaultFilters.maxCitations
  );
}

// Create filter summary text
export function createFilterSummary(filters: SearchFilters, stats: FilterStats): string {
  const parts: string[] = [];

  if (filters.searchQuery) {
    parts.push(`Search: "${filters.searchQuery}"`);
  }

  if (filters.yearRange[0] !== 1900 || filters.yearRange[1] !== new Date().getFullYear()) {
    parts.push(`Years: ${filters.yearRange[0]}-${filters.yearRange[1]}`);
  }

  if (filters.paperTypes.length < 4) {
    parts.push(`Types: ${filters.paperTypes.join(', ')}`);
  }

  if (filters.journals.length > 0) {
    const journalText = filters.journals.length === 1 
      ? filters.journals[0]
      : `${filters.journals.length} journals`;
    parts.push(`Journals: ${journalText}`);
  }

  if (filters.authors.length > 0) {
    const authorText = filters.authors.length === 1 
      ? filters.authors[0]
      : `${filters.authors.length} authors`;
    parts.push(`Authors: ${authorText}`);
  }

  if (filters.minCitations > 0 || filters.maxCitations < Infinity) {
    const citationText = filters.maxCitations === Infinity 
      ? `≥${filters.minCitations}`
      : `${filters.minCitations}-${filters.maxCitations}`;
    parts.push(`Citations: ${citationText}`);
  }

  return parts.length > 0 ? parts.join(' • ') : 'No filters applied';
}