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
  
  let citation = `${authors} ${paper.title}. ${paper.journal}. ${dateString}.`;
  
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
    // For more than 6 authors, show first 3 and add "et al."
    return `${authors.slice(0, 3).join(", ")}, et al.`;
  }
}

// Get a shorter citation for UI display
export function formatShortCitation(paper: Paper): string {
  const authors = paper.authors.length > 0 ? paper.authors[0] + (paper.authors.length > 1 ? " et al." : "") : "Unknown authors";
  const year = new Date(paper.publishDate).getFullYear();
  return `${authors} ${paper.journal}. ${year}.`;
}

export { getLocalStorage, setLocalStorage };
