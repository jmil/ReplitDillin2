import React from "react";
import { Paper } from "../lib/types";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Calendar, Users, BookOpen, ExternalLink, Quote } from "lucide-react";
import { formatPubMedCitation, formatShortCitation } from "../lib/utils";

interface PaperCardProps {
  paper: Paper;
  isMain?: boolean;
  onClick?: () => void;
}

// Component to render citation with clickable PMID and DOI links
function CitationDisplay({ paper }: { paper: Paper }) {
  const citation = formatPubMedCitation(paper);
  
  // Parse the citation to identify PMID and DOI portions
  const parts = [];
  let lastIndex = 0;
  
  // Find PMID pattern
  const pmidMatch = citation.match(/PMID: (\d+)\./);
  if (pmidMatch) {
    const pmidStart = pmidMatch.index!;
    const pmidEnd = pmidStart + pmidMatch[0].length;
    
    // Add text before PMID
    if (pmidStart > lastIndex) {
      parts.push({ text: citation.substring(lastIndex, pmidStart), type: 'text' });
    }
    
    // Add clickable PMID
    parts.push({
      text: pmidMatch[0],
      type: 'pmid',
      value: pmidMatch[1],
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmidMatch[1]}/`
    });
    
    lastIndex = pmidEnd;
  }
  
  // Find DOI pattern (capture everything until the final period)
  const doiMatch = citation.match(/DOI:\s+(.+?)\./);
  if (doiMatch) {
    const doiStart = citation.indexOf(doiMatch[0], lastIndex);
    const doiEnd = doiStart + doiMatch[0].length;
    
    // Add text between PMID and DOI (if any)
    if (doiStart > lastIndex) {
      parts.push({ text: citation.substring(lastIndex, doiStart), type: 'text' });
    }
    
    // Add clickable DOI
    parts.push({
      text: doiMatch[0],
      type: 'doi',
      value: doiMatch[1],
      url: `https://doi.org/${doiMatch[1]}`
    });
    
    lastIndex = doiEnd;
  }
  
  // Add remaining text
  if (lastIndex < citation.length) {
    parts.push({ text: citation.substring(lastIndex), type: 'text' });
  }
  
  // If no PMID or DOI found, just return the whole citation as text
  if (parts.length === 0) {
    parts.push({ text: citation, type: 'text' });
  }
  
  const handleLinkClick = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.open(url, '_blank');
  };
  
  return (
    <div className="bg-gray-50 p-3 rounded-lg border-l-4 border-blue-200">
      <div className="flex items-start gap-2">
        <Quote className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-gray-800 leading-relaxed break-words">
          {parts.map((part, index) => {
            if (part.type === 'text') {
              return <span key={index}>{part.text}</span>;
            } else {
              return (
                <button
                  key={index}
                  onClick={(e) => handleLinkClick(e, part.url!)}
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  title={`Open ${part.type.toUpperCase()} in new tab`}
                >
                  {part.text}
                </button>
              );
            }
          })}
        </div>
      </div>
    </div>
  );
}

export function PaperCard({ paper, isMain = false, onClick }: PaperCardProps) {
  const handleExternalLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (paper.doi) {
      window.open(`https://doi.org/${paper.doi}`, '_blank');
    } else if (paper.pmid) {
      window.open(`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`, '_blank');
    }
  };

  return (
    <Card 
      className={`p-4 transition-all duration-200 ${
        isMain 
          ? 'border-blue-200 bg-blue-50 shadow-sm' 
          : 'border-gray-200 bg-white hover:shadow-md hover:border-gray-300'
      } ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* Title and External Link */}
        <div className="flex items-start justify-between gap-2">
          <h4 className={`font-semibold leading-tight ${
            isMain ? 'text-blue-900' : 'text-gray-900'
          }`}>
            {paper.title}
          </h4>
          {(paper.doi || paper.pmid) && (
            <button
              onClick={handleExternalLink}
              className="flex-shrink-0 p-1 rounded-md hover:bg-gray-100 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Authors */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">
            {paper.authors.slice(0, 3).join(", ")}
            {paper.authors.length > 3 && ` et al. (${paper.authors.length} authors)`}
          </span>
        </div>

        {/* Journal and Date */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <BookOpen className="h-4 w-4" />
            <span className="truncate">{paper.journal}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{new Date(paper.publishDate).getFullYear()}</span>
          </div>
        </div>

        {/* Citation with clickable PMID and DOI */}
        <CitationDisplay paper={paper} />

        {/* Abstract */}
        <div className="text-sm text-gray-700">
          <p className="line-clamp-3">
            {paper.abstract.length > 200 
              ? `${paper.abstract.substring(0, 200)}...` 
              : paper.abstract
            }
          </p>
        </div>

        {/* Metadata */}
        {paper.citationCount !== undefined && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
              {paper.citationCount} citations
            </Badge>
          </div>
        )}

        {/* MeSH Terms */}
        {paper.meshTerms && paper.meshTerms.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {paper.meshTerms.slice(0, 3).map((term, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="text-xs bg-gray-50 text-gray-600 border-gray-200"
              >
                {term}
              </Badge>
            ))}
            {paper.meshTerms.length > 3 && (
              <Badge 
                variant="outline" 
                className="text-xs bg-gray-50 text-gray-600 border-gray-200"
              >
                +{paper.meshTerms.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
