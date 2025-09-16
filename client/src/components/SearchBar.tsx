import React, { useState, useCallback, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Search, X, Filter, RotateCcw } from "lucide-react";
import { usePapers } from "../lib/stores/usePapers";
import { hasActiveFilters, createFilterSummary, defaultFilters } from "../lib/filters";

interface SearchBarProps {
  onToggleFilters?: () => void;
  showFilterPanel?: boolean;
}

export function SearchBar({ onToggleFilters, showFilterPanel }: SearchBarProps) {
  const { 
    filters, 
    filterStats, 
    updateFilters, 
    resetFilters, 
    allPapers,
    isLoading 
  } = usePapers();
  
  const [localSearchQuery, setLocalSearchQuery] = useState(filters.searchQuery);

  // Debounce search to avoid excessive filtering
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (localSearchQuery !== filters.searchQuery) {
        updateFilters({ searchQuery: localSearchQuery });
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [localSearchQuery, filters.searchQuery, updateFilters]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchQuery(e.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setLocalSearchQuery("");
    updateFilters({ searchQuery: "" });
  }, [updateFilters]);

  const handleResetFilters = useCallback(() => {
    setLocalSearchQuery("");
    resetFilters();
  }, [resetFilters]);

  const isFiltered = hasActiveFilters(filters, {
    ...defaultFilters,
    yearRange: filterStats.yearRange,
    maxCitations: filterStats.citationRange[1]
  });

  if (!allPapers.length) {
    return null;
  }

  return (
    <Card className="p-4 bg-white shadow-sm border border-gray-200">
      <div className="space-y-3">
        {/* Search Input */}
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search within loaded papers by title, authors, journal, keywords..."
              value={localSearchQuery}
              onChange={handleSearchChange}
              className="pl-10 pr-10"
              disabled={isLoading}
            />
            {localSearchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600"
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {/* Filter Toggle Button */}
          <Button
            variant={showFilterPanel ? "default" : "outline"}
            size="sm"
            onClick={onToggleFilters}
            className="flex items-center gap-2 min-w-fit"
            disabled={isLoading}
          >
            <Filter className="h-4 w-4" />
            Filters
            {isFiltered && (
              <Badge variant="secondary" className="ml-1 text-xs">
                Active
              </Badge>
            )}
          </Button>

          {/* Reset Filters Button */}
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              disabled={isLoading}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          )}
        </div>

        {/* Filter Status */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              Showing <span className="font-medium text-gray-900">{filterStats.filteredPapers}</span> of{' '}
              <span className="font-medium text-gray-900">{filterStats.totalPapers}</span> papers
            </span>
            
            {filterStats.filteredPapers !== filterStats.totalPapers && (
              <Badge variant="outline" className="text-xs">
                Filtered
              </Badge>
            )}
          </div>

          {/* Active filters summary */}
          {isFiltered && (
            <div className="text-xs text-gray-500 max-w-md truncate">
              {createFilterSummary(filters, filterStats)}
            </div>
          )}
        </div>

        {/* Quick filter badges for active filters */}
        {isFiltered && (
          <div className="flex flex-wrap gap-2">
            {filters.searchQuery && (
              <Badge
                variant="secondary"
                className="flex items-center gap-1 text-xs cursor-pointer hover:bg-gray-200"
                onClick={handleClearSearch}
              >
                Search: "{filters.searchQuery}"
                <X className="h-3 w-3" />
              </Badge>
            )}
            
            {(filters.yearRange[0] !== filterStats.yearRange[0] || 
              filters.yearRange[1] !== filterStats.yearRange[1]) && (
              <Badge
                variant="secondary"
                className="flex items-center gap-1 text-xs cursor-pointer hover:bg-gray-200"
                onClick={() => updateFilters({ yearRange: filterStats.yearRange })}
              >
                Years: {filters.yearRange[0]}-{filters.yearRange[1]}
                <X className="h-3 w-3" />
              </Badge>
            )}
            
            {filters.paperTypes.length < 4 && (
              <Badge
                variant="secondary"
                className="flex items-center gap-1 text-xs cursor-pointer hover:bg-gray-200"
                onClick={() => updateFilters({ paperTypes: ['main', 'reference', 'citation', 'similar'] })}
              >
                Types: {filters.paperTypes.join(', ')}
                <X className="h-3 w-3" />
              </Badge>
            )}
            
            {filters.journals.length > 0 && (
              <Badge
                variant="secondary"
                className="flex items-center gap-1 text-xs cursor-pointer hover:bg-gray-200"
                onClick={() => updateFilters({ journals: [] })}
              >
                Journals: {filters.journals.length}
                <X className="h-3 w-3" />
              </Badge>
            )}
            
            {filters.authors.length > 0 && (
              <Badge
                variant="secondary"
                className="flex items-center gap-1 text-xs cursor-pointer hover:bg-gray-200"
                onClick={() => updateFilters({ authors: [] })}
              >
                Authors: {filters.authors.length}
                <X className="h-3 w-3" />
              </Badge>
            )}
            
            {(filters.minCitations > 0 || filters.maxCitations < filterStats.citationRange[1]) && (
              <Badge
                variant="secondary"
                className="flex items-center gap-1 text-xs cursor-pointer hover:bg-gray-200"
                onClick={() => updateFilters({ 
                  minCitations: 0, 
                  maxCitations: filterStats.citationRange[1] 
                })}
              >
                Citations: {filters.minCitations}-{filters.maxCitations === Infinity ? '∞' : filters.maxCitations}
                <X className="h-3 w-3" />
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}