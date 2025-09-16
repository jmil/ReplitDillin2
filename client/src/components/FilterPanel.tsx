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
import { ChevronDown, ChevronRight, X, Search, Settings, Play, Square } from "lucide-react";
import { usePapers } from "../lib/stores/usePapers";
import { SearchFilters, ClusteringAlgorithm, ClusteringConfig } from "../lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";

interface FilterPanelProps {
  isOpen: boolean;
}

export function FilterPanel({ isOpen }: FilterPanelProps) {
  const { 
    filters, 
    filterStats, 
    updateFilters, 
    allPapers, 
    isLoading,
    clustering,
    performClustering,
    setClusteringResult,
    toggleClustering,
    updateClusteringConfig
  } = usePapers();
  
  // Local state for collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    years: true,
    types: true,
    journals: false,
    authors: false,
    citations: false,
    clustering: false
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

  // Clustering handlers
  const handleClusterToggle = useCallback((clusterId: string, checked: boolean) => {
    const currentClusters = filters.selectedClusters;
    const newClusters = checked
      ? [...currentClusters, clusterId]
      : currentClusters.filter(c => c !== clusterId);
    
    updateFilters({ selectedClusters: newClusters });
  }, [filters.selectedClusters, updateFilters]);

  const removeCluster = useCallback((clusterId: string) => {
    handleClusterToggle(clusterId, false);
  }, [handleClusterToggle]);

  const handleRunClustering = useCallback(async () => {
    if (clustering.isProcessing || allPapers.length === 0) return;
    await performClustering(clustering.config);
  }, [clustering.isProcessing, clustering.config, allPapers.length, performClustering]);

  const handleClusteringConfigChange = useCallback((updates: Partial<ClusteringConfig>) => {
    updateClusteringConfig(updates);
  }, [updateClusteringConfig]);

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

          {/* Clustering Section */}
          <Collapsible 
            open={expandedSections.clustering} 
            onOpenChange={() => toggleSection('clustering')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-gray-50 p-2 -m-2 rounded">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <Label className="text-sm font-medium">Clustering</Label>
                <Badge variant={clustering.isActive ? "default" : "outline"} className="text-xs">
                  {clustering.isActive ? 
                    `${clustering.currentResult?.clusters.length || 0} clusters` : 
                    'Inactive'
                  }
                </Badge>
              </div>
              {expandedSections.clustering ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-3">
              <div className="space-y-4">
                {/* Clustering Toggle */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Enable Clustering</Label>
                  <Switch
                    checked={clustering.isActive}
                    onCheckedChange={toggleClustering}
                    disabled={clustering.isProcessing || !clustering.currentResult}
                  />
                </div>

                {/* Clustering Configuration */}
                <div className="space-y-3 border-t pt-3">
                  <Label className="text-sm font-medium">Configuration</Label>
                  
                  {/* Algorithm Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-600">Algorithm</Label>
                    <Select
                      value={clustering.config.algorithm}
                      onValueChange={(value: ClusteringAlgorithm) => 
                        handleClusteringConfigChange({ algorithm: value })
                      }
                      disabled={clustering.isProcessing}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kmeans">K-Means</SelectItem>
                        <SelectItem value="hierarchical">Hierarchical</SelectItem>
                        <SelectItem value="community">Community Detection</SelectItem>
                        <SelectItem value="hybrid">Hybrid (Text + Network)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Number of Clusters (for algorithms that need it) */}
                  {(clustering.config.algorithm === 'kmeans' || clustering.config.algorithm === 'hierarchical') && (
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">
                        Number of Clusters: {clustering.config.numClusters || 5}
                      </Label>
                      <Slider
                        value={[clustering.config.numClusters || 5]}
                        onValueChange={(values) => 
                          handleClusteringConfigChange({ numClusters: values[0] })
                        }
                        min={2}
                        max={Math.min(15, Math.floor(allPapers.length / 3))}
                        step={1}
                        className="w-full"
                        disabled={clustering.isProcessing}
                      />
                    </div>
                  )}

                  {/* Feature Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-600">Features to Use</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="feature-text"
                          checked={clustering.config.features.useText}
                          onCheckedChange={(checked) => 
                            handleClusteringConfigChange({
                              features: { ...clustering.config.features, useText: checked as boolean }
                            })
                          }
                          disabled={clustering.isProcessing}
                        />
                        <Label htmlFor="feature-text" className="text-xs">Text</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="feature-network"
                          checked={clustering.config.features.useNetwork}
                          onCheckedChange={(checked) => 
                            handleClusteringConfigChange({
                              features: { ...clustering.config.features, useNetwork: checked as boolean }
                            })
                          }
                          disabled={clustering.isProcessing}
                        />
                        <Label htmlFor="feature-network" className="text-xs">Network</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="feature-temporal"
                          checked={clustering.config.features.useTemporal}
                          onCheckedChange={(checked) => 
                            handleClusteringConfigChange({
                              features: { ...clustering.config.features, useTemporal: checked as boolean }
                            })
                          }
                          disabled={clustering.isProcessing}
                        />
                        <Label htmlFor="feature-temporal" className="text-xs">Temporal</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="feature-categorical"
                          checked={clustering.config.features.useCategorical}
                          onCheckedChange={(checked) => 
                            handleClusteringConfigChange({
                              features: { ...clustering.config.features, useCategorical: checked as boolean }
                            })
                          }
                          disabled={clustering.isProcessing}
                        />
                        <Label htmlFor="feature-categorical" className="text-xs">Authors/MeSH</Label>
                      </div>
                    </div>
                  </div>

                  {/* Run Clustering Button */}
                  <Button
                    onClick={handleRunClustering}
                    disabled={clustering.isProcessing || allPapers.length === 0}
                    className="w-full h-8 text-xs"
                    size="sm"
                  >
                    {clustering.isProcessing ? (
                      <>
                        <Square className="h-3 w-3 mr-1 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 mr-1" />
                        Run Clustering
                      </>
                    )}
                  </Button>
                </div>

                {/* Cluster Results & Filtering */}
                {clustering.currentResult && clustering.currentResult.clusters.length > 0 && (
                  <div className="space-y-3 border-t pt-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Cluster Filters</Label>
                      <Badge variant="outline" className="text-xs">
                        {filters.selectedClusters.length}/{clustering.currentResult.clusters.length}
                      </Badge>
                    </div>

                    {/* Selected clusters */}
                    {filters.selectedClusters.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-600">Selected:</Label>
                        <div className="flex flex-wrap gap-1">
                          {filters.selectedClusters.map((clusterId) => {
                            const cluster = clustering.currentResult?.clusters.find(c => c.id === clusterId);
                            return cluster ? (
                              <Badge
                                key={clusterId}
                                variant="secondary"
                                className="text-xs cursor-pointer hover:bg-gray-200 flex items-center gap-1"
                                style={{ backgroundColor: cluster.color + '20', borderColor: cluster.color }}
                                onClick={() => removeCluster(clusterId)}
                              >
                                {cluster.name.length > 15 ? `${cluster.name.substring(0, 15)}...` : cluster.name}
                                <X className="h-3 w-3" />
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}

                    {/* Cluster list */}
                    <ScrollArea className="h-32">
                      <div className="space-y-2">
                        {clustering.currentResult.clusters.map((cluster) => (
                          <div key={cluster.id} className="flex items-center space-x-2 p-1 rounded hover:bg-gray-50">
                            <Checkbox
                              id={`cluster-${cluster.id}`}
                              checked={filters.selectedClusters.includes(cluster.id)}
                              onCheckedChange={(checked) => 
                                handleClusterToggle(cluster.id, checked as boolean)
                              }
                              disabled={isLoading}
                            />
                            <div className="flex items-center gap-2 flex-1">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: cluster.color }}
                              />
                              <div className="flex-1 min-w-0">
                                <Label 
                                  htmlFor={`cluster-${cluster.id}`}
                                  className="text-xs cursor-pointer block truncate"
                                  title={cluster.name}
                                >
                                  {cluster.name}
                                </Label>
                                <p className="text-xs text-gray-500">
                                  {cluster.size} papers
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    {/* Clustering Quality */}
                    {clustering.currentResult.quality && (
                      <div className="text-xs text-gray-600 space-y-1">
                        <div className="flex justify-between">
                          <span>Algorithm:</span>
                          <span className="capitalize">{clustering.currentResult.algorithm}</span>
                        </div>
                        {clustering.currentResult.quality.silhouetteScore !== undefined && (
                          <div className="flex justify-between">
                            <span>Quality Score:</span>
                            <span>{clustering.currentResult.quality.silhouetteScore.toFixed(3)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Processing Time:</span>
                          <span>{clustering.currentResult.processingTime}ms</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* No clustering results yet */}
                {!clustering.currentResult && !clustering.isProcessing && (
                  <div className="text-center text-gray-500 text-xs py-4">
                    Configure settings above and click "Run Clustering" to analyze paper relationships
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </Card>
  );
}