import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Paper } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getLocalStorage = (key: string): any =>
  JSON.parse(window.localStorage.getItem(key) || "null");
const setLocalStorage = (key: string, value: any): void =>
  window.localStorage.setItem(key, JSON.stringify(value));

// Format citation in PubMed style
export function formatPubMedCitation(paper: Paper): string {
  const authors = formatAuthors(paper.authors);
  
  // Use publishDateRaw if available, otherwise fall back to extracting year from publishDate
  let dateString = '';
  if (paper.publishDateRaw && paper.publishGranularity) {
    dateString = paper.publishDateRaw;
  } else {
    // Fallback to year extraction for backwards compatibility
    dateString = new Date(paper.publishDate).getFullYear().toString();
  }
  
  // Format journal citation with volume/issue/pages
  let journalCitation = paper.journal;
  
  // Add date
  journalCitation += `. ${dateString}`;
  
  // Add volume, issue, and pages in standard PubMed format
  if (paper.volume || paper.issue || paper.pages) {
    if (paper.volume) {
      journalCitation += `;${paper.volume}`;
      
      if (paper.issue) {
        journalCitation += `(${paper.issue})`;
      }
      
      if (paper.pages) {
        journalCitation += `:${paper.pages}`;
      }
    } else if (paper.pages) {
      // Handle the rare case where only pages are available
      journalCitation += `:${paper.pages}`;
    }
  }
  
  journalCitation += '.';
  
  let citation = `${authors} ${paper.title}. ${journalCitation}`;
  
  if (paper.pmid) {
    citation += ` PMID: ${paper.pmid}.`;
  }
  
  if (paper.doi) {
    citation += ` DOI: ${paper.doi}.`;
  }
  
  return citation;
}

// Format authors according to PubMed standards
function formatAuthors(authors: string[]): string {
  if (!authors || authors.length === 0) return "Unknown authors.";
  
  if (authors.length === 1) {
    return `${authors[0]}.`;
  } else if (authors.length <= 6) {
    return `${authors.join(", ")}.`;
  } else {
    // For more than 6 authors, show first 6 and add "et al." (per PubMed standard)
    return `${authors.slice(0, 6).join(", ")}, et al.`;
  }
}

// Get a shorter citation for UI display
export function formatShortCitation(paper: Paper): string {
  const authors = paper.authors.length > 0 ? paper.authors[0] + (paper.authors.length > 1 ? " et al." : "") : "Unknown authors";
  const year = new Date(paper.publishDate).getFullYear();
  return `${authors} ${paper.journal}. ${year}.`;
}

export { getLocalStorage, setLocalStorage };
