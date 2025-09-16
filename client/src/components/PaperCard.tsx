import React from "react";
import { Paper } from "../lib/types";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Calendar, Users, BookOpen, ExternalLink } from "lucide-react";

interface PaperCardProps {
  paper: Paper;
  isMain?: boolean;
  onClick?: () => void;
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
        <div className="flex flex-wrap gap-2 text-xs">
          {paper.pmid && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              PMID: {paper.pmid}
            </Badge>
          )}
          {paper.doi && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              DOI: {paper.doi.length > 20 ? `${paper.doi.substring(0, 20)}...` : paper.doi}
            </Badge>
          )}
          {paper.citationCount !== undefined && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
              {paper.citationCount} citations
            </Badge>
          )}
        </div>

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
