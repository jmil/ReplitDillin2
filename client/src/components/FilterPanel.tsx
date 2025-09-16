import React, { useState, useCallback } from "react";
import { Card } from "./ui/card";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { ChevronDown, ChevronRight, X, Search } from "lucide-react";
import { usePapers } from "../lib/stores/usePapers";
import { SearchFilters } from "../lib/types";

interface FilterPanelProps {
  isOpen: boolean;
}

export function FilterPanel({ isOpen }: FilterPanelProps) {
  const { filters, filterStats, updateFilters, allPapers, isLoading } = usePapers();
  
  // Local state for collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    years: true,
    types: true,
    journals: false,
    authors: false,
    citations: false
  });

  // Local state for search inputs
  const [journalSearch, setJournalSearch] = useState("");
  const [authorSearch, setAuthorSearch] = useState("");

  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  const handleYearRangeChange = useCallback((values: number[]) => {
    updateFilters({ yearRange: [values[0], values[1]] });
  }, [updateFilters]);

  const handlePaperTypeChange = useCallback((type: string, checked: boolean) => {
    const currentTypes = filters.paperTypes;
    const newTypes = checked 
      ? [...currentTypes, type as any]
      : currentTypes.filter(t => t !== type);
    
    updateFilters({ paperTypes: newTypes });
  }, [filters.paperTypes, updateFilters]);

  const handleJournalToggle = useCallback((journal: string, checked: boolean) => {
    const currentJournals = filters.journals;
    const newJournals = checked
      ? [...currentJournals, journal]
      : currentJournals.filter(j => j !== journal);
    
    updateFilters({ journals: newJournals });
  }, [filters.journals, updateFilters]);

  const handleAuthorToggle = useCallback((author: string, checked: boolean) => {
    const currentAuthors = filters.authors;
    const newAuthors = checked
      ? [...currentAuthors, author]
      : currentAuthors.filter(a => a !== author);
    
    updateFilters({ authors: newAuthors });
  }, [filters.authors, updateFilters]);

  const handleCitationRangeChange = useCallback((values: number[]) => {
    updateFilters({ 
      minCitations: values[0], 
      maxCitations: values[1] === filterStats.citationRange[1] ? Infinity : values[1]
    });
  }, [updateFilters, filterStats.citationRange]);

  const removeJournal = useCallback((journal: string) => {
    handleJournalToggle(journal, false);
  }, [handleJournalToggle]);

  const removeAuthor = useCallback((author: string) => {
    handleAuthorToggle(author, false);
  }, [handleAuthorToggle]);

  // Filter journals and authors based on search
  const filteredJournals = filterStats.availableJournals.filter(journal =>
    journal.toLowerCase().includes(journalSearch.toLowerCase())
  );

  const filteredAuthors = filterStats.availableAuthors.filter(author =>
    author.toLowerCase().includes(authorSearch.toLowerCase())
  );

  if (!isOpen || !allPapers.length) {
    return null;
  }

  const paperTypeOptions = [
    { value: 'main', label: 'Main Paper', color: 'bg-blue-500' },
    { value: 'reference', label: 'References', color: 'bg-green-500' },
    { value: 'citation', label: 'Citations', color: 'bg-yellow-500' },
    { value: 'similar', label: 'Similar Papers', color: 'bg-purple-500' }
  ];

  return (
    <Card className="w-80 h-fit bg-white shadow-lg border border-gray-200">
      <div className="p-4 border-b bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900">Filter Papers</h3>
        <p className="text-sm text-gray-600 mt-1">
          Refine your view of {filterStats.totalPapers} papers
        </p>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="p-4 space-y-6">
          {/* Year Range Filter */}
          <Collapsible 
            open={expandedSections.years} 
            onOpenChange={() => toggleSection('years')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-gray-50 p-2 -m-2 rounded">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Publication Year</Label>
                <Badge variant="outline" className="text-xs">
                  {filters.yearRange[0]}-{filters.yearRange[1]}
                </Badge>
              </div>
              {expandedSections.years ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="space-y-3">
                <Slider
                  value={filters.yearRange}
                  onValueChange={handleYearRangeChange}
                  min={filterStats.yearRange[0]}
                  max={filterStats.yearRange[1]}
                  step={1}
                  className="w-full"
                  disabled={isLoading}
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{filterStats.yearRange[0]}</span>
                  <span>{filterStats.yearRange[1]}</span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Paper Type Filter */}
          <Collapsible 
            open={expandedSections.types} 
            onOpenChange={() => toggleSection('types')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-gray-50 p-2 -m-2 rounded">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Paper Types</Label>
                <Badge variant="outline" className="text-xs">
                  {filters.paperTypes.length}/4
                </Badge>
              </div>
              {expandedSections.types ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="space-y-3">
                {paperTypeOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-3">
                    <Checkbox
                      id={`type-${option.value}`}
                      checked={filters.paperTypes.includes(option.value as any)}
                      onCheckedChange={(checked) => 
                        handlePaperTypeChange(option.value, checked as boolean)
                      }
                      disabled={isLoading}
                    />
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${option.color}`} />
                      <Label 
                        htmlFor={`type-${option.value}`}
                        className="text-sm cursor-pointer"
                      >
                        {option.label}
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Journal Filter */}
          <Collapsible 
            open={expandedSections.journals} 
            onOpenChange={() => toggleSection('journals')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-gray-50 p-2 -m-2 rounded">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Journals</Label>
                <Badge variant="outline" className="text-xs">
                  {filters.journals.length}/{filterStats.availableJournals.length}
                </Badge>
              </div>
              {expandedSections.journals ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="space-y-3">
                {/* Selected journals */}
                {filters.journals.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-600">Selected:</Label>
                    <div className="flex flex-wrap gap-1">
                      {filters.journals.map((journal) => (
                        <Badge
                          key={journal}
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-gray-200 flex items-center gap-1"
                          onClick={() => removeJournal(journal)}
                        >
                          {journal.length > 20 ? `${journal.substring(0, 20)}...` : journal}
                          <X className="h-3 w-3" />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Journal search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                  <Input
                    placeholder="Search journals..."
                    value={journalSearch}
                    onChange={(e) => setJournalSearch(e.target.value)}
                    className="pl-7 text-xs h-8"
                    disabled={isLoading}
                  />
                </div>

                {/* Journal list */}
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {filteredJournals.slice(0, 20).map((journal) => (
                      <div key={journal} className="flex items-center space-x-2">
                        <Checkbox
                          id={`journal-${journal}`}
                          checked={filters.journals.includes(journal)}
                          onCheckedChange={(checked) => 
                            handleJournalToggle(journal, checked as boolean)
                          }
                          disabled={isLoading}
                        />
                        <Label 
                          htmlFor={`journal-${journal}`}
                          className="text-xs cursor-pointer flex-1 truncate"
                          title={journal}
                        >
                          {journal}
                        </Label>
                      </div>
                    ))}
                    {filteredJournals.length > 20 && (
                      <p className="text-xs text-gray-500 p-2">
                        Showing 20 of {filteredJournals.length} journals. Use search to narrow down.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Author Filter */}
          <Collapsible 
            open={expandedSections.authors} 
            onOpenChange={() => toggleSection('authors')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-gray-50 p-2 -m-2 rounded">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Authors</Label>
                <Badge variant="outline" className="text-xs">
                  {filters.authors.length}/{filterStats.availableAuthors.length}
                </Badge>
              </div>
              {expandedSections.authors ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="space-y-3">
                {/* Selected authors */}
                {filters.authors.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-600">Selected:</Label>
                    <div className="flex flex-wrap gap-1">
                      {filters.authors.map((author) => (
                        <Badge
                          key={author}
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-gray-200 flex items-center gap-1"
                          onClick={() => removeAuthor(author)}
                        >
                          {author.length > 15 ? `${author.substring(0, 15)}...` : author}
                          <X className="h-3 w-3" />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Author search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                  <Input
                    placeholder="Search authors..."
                    value={authorSearch}
                    onChange={(e) => setAuthorSearch(e.target.value)}
                    className="pl-7 text-xs h-8"
                    disabled={isLoading}
                  />
                </div>

                {/* Author list */}
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {filteredAuthors.slice(0, 20).map((author) => (
                      <div key={author} className="flex items-center space-x-2">
                        <Checkbox
                          id={`author-${author}`}
                          checked={filters.authors.includes(author)}
                          onCheckedChange={(checked) => 
                            handleAuthorToggle(author, checked as boolean)
                          }
                          disabled={isLoading}
                        />
                        <Label 
                          htmlFor={`author-${author}`}
                          className="text-xs cursor-pointer flex-1 truncate"
                          title={author}
                        >
                          {author}
                        </Label>
                      </div>
                    ))}
                    {filteredAuthors.length > 20 && (
                      <p className="text-xs text-gray-500 p-2">
                        Showing 20 of {filteredAuthors.length} authors. Use search to narrow down.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Citation Count Filter */}
          {filterStats.citationRange[1] > 0 && (
            <Collapsible 
              open={expandedSections.citations} 
              onOpenChange={() => toggleSection('citations')}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-gray-50 p-2 -m-2 rounded">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Citation Count</Label>
                  <Badge variant="outline" className="text-xs">
                    {filters.minCitations}-{filters.maxCitations === Infinity ? '∞' : filters.maxCitations}
                  </Badge>
                </div>
                {expandedSections.citations ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="space-y-3">
                  <Slider
                    value={[
                      filters.minCitations, 
                      filters.maxCitations === Infinity ? filterStats.citationRange[1] : filters.maxCitations
                    ]}
                    onValueChange={handleCitationRangeChange}
                    min={filterStats.citationRange[0]}
                    max={filterStats.citationRange[1]}
                    step={1}
                    className="w-full"
                    disabled={isLoading}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{filterStats.citationRange[0]}</span>
                    <span>{filterStats.citationRange[1]}</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}