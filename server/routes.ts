import type { Express } from "express";
import { createServer, type Server } from "http";
import { PubMedService } from "./services/pubmed";
import { Paper, NetworkData, NetworkNode, NetworkEdge } from "../client/src/lib/types";

const pubmedService = new PubMedService();

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Search endpoint for papers
  app.get("/api/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      
      if (!query) {
        return res.status(400).json({ error: "Query parameter is required" });
      }

      console.log(`Searching for: ${query}`);

      let pmid: string | null = null;

      // Check if query is a DOI
      if (query.includes('10.') && query.includes('/')) {
        console.log('Converting DOI to PMID...');
        pmid = await pubmedService.doiToPmid(query);
        if (!pmid) {
          return res.status(404).json({ error: "Paper not found for the given DOI" });
        }
      }
      // Check if query is a PubMed ID (numbers only)
      else if (/^\d+$/.test(query)) {
        pmid = query;
      }
      else {
        return res.status(400).json({ error: "Invalid query format. Please provide a DOI or PubMed ID." });
      }

      console.log(`Using PMID: ${pmid}`);

      // Get main paper details
      const mainPaperDetails = await pubmedService.getPaperDetails([pmid]);
      if (mainPaperDetails.length === 0) {
        return res.status(404).json({ error: "Paper not found" });
      }

      const mainPaperSummary = await pubmedService.getPaperSummaries([pmid]);
      const mainPaperData = { ...mainPaperDetails[0], ...mainPaperSummary[0] };

      // Get related papers
      console.log('Fetching related papers...');
      const { references, citations, similar } = await pubmedService.getRelatedPapers(pmid);
      
      console.log(`Found ${references.length} references, ${citations.length} citations, ${similar.length} similar papers`);

      // Get details for related papers
      const allRelatedIds = [...references, ...citations, ...similar].slice(0, 50); // Limit total
      const relatedSummaries = await pubmedService.getPaperSummaries(allRelatedIds);
      const relatedDetails = await pubmedService.getPaperDetails(allRelatedIds.slice(0, 20)); // Get abstracts for subset

      // Merge summaries with details
      const relatedPapers = relatedSummaries.map(summary => {
        const details = relatedDetails.find(d => d.pmid === summary.pmid);
        return {
          ...summary,
          abstract: details?.abstract || 'Abstract not available',
          meshTerms: details?.meshTerms || []
        };
      });

      // Create paper objects
      const mainPaper: Paper = {
        id: mainPaperData.pmid,
        pmid: mainPaperData.pmid,
        doi: mainPaperData.doi,
        title: mainPaperData.title,
        authors: mainPaperData.authors || [],
        journal: mainPaperData.journal,
        publishDate: parseDate(mainPaperData.publishDate).toISOString(),
        abstract: mainPaperData.abstract,
        citationCount: mainPaperData.citationCount,
        meshTerms: mainPaperData.meshTerms || []
      };

      const referencePapers: Paper[] = relatedPapers
        .filter(p => references.includes(p.pmid))
        .map(p => ({
          id: p.pmid,
          pmid: p.pmid,
          doi: p.doi,
          title: p.title,
          authors: p.authors || [],
          journal: p.journal,
          publishDate: parseDate(p.publishDate).toISOString(),
          abstract: p.abstract,
          citationCount: p.citationCount,
          meshTerms: p.meshTerms || []
        }));

      const citationPapers: Paper[] = relatedPapers
        .filter(p => citations.includes(p.pmid))
        .map(p => ({
          id: p.pmid,
          pmid: p.pmid,
          doi: p.doi,
          title: p.title,
          authors: p.authors || [],
          journal: p.journal,
          publishDate: parseDate(p.publishDate).toISOString(),
          abstract: p.abstract,
          citationCount: p.citationCount,
          meshTerms: p.meshTerms || []
        }));

      const similarPapers: Paper[] = relatedPapers
        .filter(p => similar.includes(p.pmid))
        .map(p => ({
          id: p.pmid,
          pmid: p.pmid,
          doi: p.doi,
          title: p.title,
          authors: p.authors || [],
          journal: p.journal,
          publishDate: parseDate(p.publishDate).toISOString(),
          abstract: p.abstract,
          citationCount: p.citationCount,
          meshTerms: p.meshTerms || []
        }));

      // Create network data
      const networkData = createNetworkData(mainPaper, referencePapers, citationPapers, similarPapers);

      const response = {
        mainPaper,
        relatedPapers: [...referencePapers, ...citationPapers, ...similarPapers],
        networkData,
        statistics: {
          references: referencePapers.length,
          citations: citationPapers.length,
          similar: similarPapers.length,
          total: referencePapers.length + citationPapers.length + similarPapers.length + 1
        }
      };

      res.json(response);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to parse various date formats from PubMed
function parseDate(dateString: string): Date {
  if (!dateString) return new Date();
  
  // Try to parse various PubMed date formats
  const cleanDate = dateString.replace(/\s+/g, ' ').trim();
  
  // Format: "2023 Jan 15" or "2023 Jan"
  const yearMonthDayMatch = cleanDate.match(/(\d{4})\s+(\w{3})\s*(\d{1,2})?/);
  if (yearMonthDayMatch) {
    const [, year, month, day] = yearMonthDayMatch;
    const monthMap: { [key: string]: number } = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    return new Date(parseInt(year), monthMap[month] || 0, parseInt(day) || 1);
  }
  
  // Format: "2023"
  const yearMatch = cleanDate.match(/(\d{4})/);
  if (yearMatch) {
    return new Date(parseInt(yearMatch[1]), 0, 1);
  }
  
  // Fallback to Date.parse
  const parsed = Date.parse(cleanDate);
  return isNaN(parsed) ? new Date() : new Date(parsed);
}

// Helper function to create network visualization data
function createNetworkData(
  mainPaper: Paper,
  references: Paper[],
  citations: Paper[],
  similar: Paper[]
): NetworkData {
  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];

  // Add main paper node
  nodes.push({
    id: mainPaper.id,
    label: truncateTitle(mainPaper.title),
    paper: mainPaper,
    type: 'main',
    size: 20,
    color: '#3B82F6'
  });

  // Add reference nodes and edges
  references.forEach(paper => {
    nodes.push({
      id: paper.id,
      label: truncateTitle(paper.title),
      paper: paper,
      type: 'reference',
      size: 12,
      color: '#10B981'
    });

    edges.push({
      id: `${mainPaper.id}-ref-${paper.id}`,
      source: mainPaper.id,
      target: paper.id,
      type: 'references',
      weight: 2
    });
  });

  // Add citation nodes and edges
  citations.forEach(paper => {
    nodes.push({
      id: paper.id,
      label: truncateTitle(paper.title),
      paper: paper,
      type: 'citation',
      size: 12,
      color: '#F59E0B'
    });

    edges.push({
      id: `${paper.id}-cites-${mainPaper.id}`,
      source: paper.id,
      target: mainPaper.id,
      type: 'citations',
      weight: 2
    });
  });

  // Add similar paper nodes and edges
  similar.forEach(paper => {
    nodes.push({
      id: paper.id,
      label: truncateTitle(paper.title),
      paper: paper,
      type: 'similar',
      size: 10,
      color: '#8B5CF6'
    });

    edges.push({
      id: `${mainPaper.id}-sim-${paper.id}`,
      source: mainPaper.id,
      target: paper.id,
      type: 'similar',
      weight: 1
    });
  });

  return { nodes, edges };
}

// Helper function to truncate titles for display
function truncateTitle(title: string, maxLength: number = 50): string {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
}
