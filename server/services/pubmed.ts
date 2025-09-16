interface PubMedSearchResult {
  esearchresult: {
    idlist: string[];
    count: string;
    retmax: string;
  };
}

interface PubMedSummary {
  result: {
    [pmid: string]: {
      uid: string;
      title: string;
      authors: Array<{ name: string }>;
      source: string;
      pubdate: string;
      epubdate?: string;
      pubtype: string[];
      articleids: Array<{ idtype: string; value: string }>;
      history: Array<{ pubstatus: string; date: string }>;
      references?: string[];
      pmcrefcount?: number;
      hasabstract?: number;
    };
  };
}

interface PubMedAbstract {
  PubmedArticle: Array<{
    MedlineCitation: {
      PMID: { _: string };
      Article: {
        ArticleTitle: { _: string };
        Abstract?: {
          AbstractText: Array<{ _: string } | string>;
        };
        AuthorList?: {
          Author: Array<{
            LastName?: { _: string };
            ForeName?: { _: string };
            Initials?: { _: string };
          }>;
        };
        Journal: {
          Title: { _: string };
          JournalIssue: {
            PubDate: {
              Year?: { _: string };
              Month?: { _: string };
              Day?: { _: string };
            };
          };
        };
      };
      MeshHeadingList?: {
        MeshHeading: Array<{
          DescriptorName: { _: string };
        }>;
      };
    };
  }>;
}

export class PubMedService {
  private baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  private lastRequestTime = 0;
  private readonly minRequestInterval = 334; // ~3 requests per second as recommended by NCBI
  
  // Rate limiting helper
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
  }
  
  // Retry helper with exponential backoff
  private async retryRequest<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.rateLimit();
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) break;
        
        // Check if it's a rate limit error
        if (lastError.message.includes('Too Many Requests') || lastError.message.includes('429')) {
          const backoffDelay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Rate limited, retrying in ${backoffDelay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        } else {
          // If it's not a rate limit error, don't retry
          break;
        }
      }
    }
    
    throw lastError;
  }
  
  // Convert DOI to PubMed ID
  async doiToPmid(doi: string): Promise<string | null> {
    try {
      // Clean DOI
      const cleanDoi = doi.replace(/^doi:/, '').replace(/^https?:\/\/doi\.org\//, '');
      
      const result = await this.retryRequest(async () => {
        const url = `${this.baseUrl}/esearch.fcgi`;
        const params = new URLSearchParams({
          db: 'pubmed',
          term: `${cleanDoi}[DOI]`,
          retmode: 'json',
          retmax: '1'
        });

        const response = await fetch(`${url}?${params}`);
        if (!response.ok) {
          throw new Error(`DOI search failed: ${response.statusText}`);
        }

        return await response.json();
      });
      
      if (result.esearchresult.idlist.length === 0) {
        return null;
      }

      return result.esearchresult.idlist[0];
    } catch (error) {
      console.error('Error converting DOI to PMID:', error);
      return null;
    }
  }

  // Search PubMed for papers
  async searchPapers(query: string, maxResults: number = 20): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/esearch.fcgi`;
      const params = new URLSearchParams({
        db: 'pubmed',
        term: query,
        retmode: 'json',
        retmax: maxResults.toString(),
        sort: 'relevance'
      });

      const response = await fetch(`${url}?${params}`);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data: PubMedSearchResult = await response.json();
      return data.esearchresult.idlist;
    } catch (error) {
      console.error('Error searching PubMed:', error);
      return [];
    }
  }

  // Get paper summaries
  async getPaperSummaries(pmids: string[]): Promise<any[]> {
    if (pmids.length === 0) return [];

    try {
      const data = await this.retryRequest(async () => {
        const url = `${this.baseUrl}/esummary.fcgi`;
        const params = new URLSearchParams({
          db: 'pubmed',
          id: pmids.join(','),
          retmode: 'json'
        });

        const response = await fetch(`${url}?${params}`);
        if (!response.ok) {
          throw new Error(`Summary fetch failed: ${response.statusText}`);
        }

        return await response.json();
      });
      
      return pmids.map(pmid => {
        const summary = data.result[pmid];
        if (!summary) return null;

        return {
          pmid: summary.uid,
          title: summary.title,
          authors: summary.authors?.map((author: any) => author.name) || [],
          journal: summary.source,
          publishDate: summary.pubdate || summary.epubdate || '',
          doi: summary.articleids?.find((id: any) => id.idtype === 'doi')?.value || null,
          citationCount: summary.pmcrefcount || 0,
          hasAbstract: summary.hasabstract === 1
        };
      }).filter(Boolean);
    } catch (error) {
      console.error('Error fetching summaries:', error);
      return [];
    }
  }

  // Get detailed paper information including abstract
  async getPaperDetails(pmids: string[]): Promise<any[]> {
    if (pmids.length === 0) return [];

    try {
      const xmlText = await this.retryRequest(async () => {
        const url = `${this.baseUrl}/efetch.fcgi`;
        const params = new URLSearchParams({
          db: 'pubmed',
          id: pmids.join(','),
          retmode: 'xml'
        });

        const response = await fetch(`${url}?${params}`);
        if (!response.ok) {
          throw new Error(`Detail fetch failed: ${response.statusText}`);
        }

        return await response.text();
      });
      
      // Simple XML parsing for abstracts
      const papers = [];
      const pmidMatches = xmlText.match(/<PMID[^>]*>(\d+)<\/PMID>/g);
      const titleMatches = xmlText.match(/<ArticleTitle>([^<]+)<\/ArticleTitle>/g);
      const abstractMatches = xmlText.match(/<AbstractText[^>]*>([^<]+)<\/AbstractText>/g);
      
      if (pmidMatches && titleMatches) {
        for (let i = 0; i < pmidMatches.length && i < titleMatches.length; i++) {
          const pmid = pmidMatches[i].match(/(\d+)/)?.[1] || '';
          const title = titleMatches[i].replace(/<[^>]+>/g, '');
          const abstract = abstractMatches?.[i]?.replace(/<[^>]+>/g, '') || 'Abstract not available';
          
          // Extract authors
          const authorPattern = new RegExp(`<PMID[^>]*>${pmid}</PMID>[\\s\\S]*?<AuthorList[\\s\\S]*?</AuthorList>`, 'i');
          const authorSection = xmlText.match(authorPattern)?.[0] || '';
          const authorNames = authorSection.match(/<LastName>([^<]+)<\/LastName>[\\s\\S]*?<ForeName>([^<]+)<\/ForeName>/g) || [];
          const authors = authorNames.map(match => {
            const lastName = match.match(/<LastName>([^<]+)<\/LastName>/)?.[1] || '';
            const firstName = match.match(/<ForeName>([^<]+)<\/ForeName>/)?.[1] || '';
            return `${firstName} ${lastName}`.trim();
          });

          // Extract journal
          const journalPattern = new RegExp(`<PMID[^>]*>${pmid}</PMID>[\\s\\S]*?<Title>([^<]+)</Title>`, 'i');
          const journal = xmlText.match(journalPattern)?.[1] || 'Unknown Journal';

          // Extract MeSH terms
          const meshPattern = new RegExp(`<PMID[^>]*>${pmid}</PMID>[\\s\\S]*?<MeshHeadingList[\\s\\S]*?</MeshHeadingList>`, 'i');
          const meshSection = xmlText.match(meshPattern)?.[0] || '';
          const meshTerms = (meshSection.match(/<DescriptorName[^>]*>([^<]+)<\/DescriptorName>/g) || [])
            .map(match => match.replace(/<[^>]+>/g, ''));

          papers.push({
            pmid,
            title,
            authors,
            journal,
            abstract,
            meshTerms: meshTerms.slice(0, 10) // Limit MeSH terms
          });
        }
      }

      return papers;
    } catch (error) {
      console.error('Error fetching paper details:', error);
      return [];
    }
  }

  // Get related papers (references and citations)
  async getRelatedPapers(pmid: string): Promise<{ references: string[]; citations: string[]; similar: string[] }> {
    try {
      const linkUrl = `${this.baseUrl}/elink.fcgi`;
      
      // Use sequential requests with rate limiting instead of parallel to avoid overwhelming the API
      const references = await this.retryRequest(async () => {
        const refParams = new URLSearchParams({
          dbfrom: 'pubmed',
          db: 'pubmed',
          id: pmid,
          linkname: 'pubmed_pubmed_refs',
          retmode: 'json'
        });

        const response = await fetch(`${linkUrl}?${refParams}`);
        if (!response.ok) {
          throw new Error(`References fetch failed: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.linksets?.[0]?.linksetdbs?.[0]?.links) {
          return data.linksets[0].linksetdbs[0].links.slice(0, 8);
        }
        return [];
      }).catch(() => []);

      const citations = await this.retryRequest(async () => {
        const citParams = new URLSearchParams({
          dbfrom: 'pubmed',
          db: 'pubmed',
          id: pmid,
          linkname: 'pubmed_pubmed_citedin',
          retmode: 'json'
        });

        const response = await fetch(`${linkUrl}?${citParams}`);
        if (!response.ok) {
          throw new Error(`Citations fetch failed: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.linksets?.[0]?.linksetdbs?.[0]?.links) {
          return data.linksets[0].linksetdbs[0].links.slice(0, 8);
        }
        return [];
      }).catch(() => []);

      const similar = await this.retryRequest(async () => {
        const simParams = new URLSearchParams({
          dbfrom: 'pubmed',
          db: 'pubmed',
          id: pmid,
          linkname: 'pubmed_pubmed',
          retmode: 'json'
        });

        const response = await fetch(`${linkUrl}?${simParams}`);
        if (!response.ok) {
          throw new Error(`Similar papers fetch failed: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.linksets?.[0]?.linksetdbs?.[0]?.links) {
          return data.linksets[0].linksetdbs[0].links
            .filter((id: string) => id !== pmid) // Exclude the main paper
            .slice(0, 12);
        }
        return [];
      }).catch(() => []);

      return { references, citations, similar };
    } catch (error) {
      console.error('Error fetching related papers:', error);
      return { references: [], citations: [], similar: [] };
    }
  }
}
