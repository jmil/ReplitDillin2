import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SearchInterface } from "./components/SearchInterface";
import { SearchBar } from "./components/SearchBar";
import { FilterPanel } from "./components/FilterPanel";
import { VisualizationModes } from "./components/VisualizationModes";
import { PaperCard } from "./components/PaperCard";
import { usePapers } from "./lib/stores/usePapers";
import { Card } from "./components/ui/card";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import "@fontsource/inter";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const { 
    mainPaper, 
    allPapers, 
    selectedPaper, 
    isLoading, 
    error, 
    currentMode,
    filterStats
  } = usePapers();

  const [showFilterPanel, setShowFilterPanel] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Dillin.ai
                <span className="text-blue-600 ml-2">Scientific Intelligence</span>
              </h1>
              <p className="text-gray-600 mt-1">
                Explore research connections and citation networks
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Interface */}
        <div className="mb-8">
          <SearchInterface />
        </div>

        {/* Search and Filter Bar */}
        {mainPaper && !isLoading && (
          <div className="mb-8">
            <SearchBar 
              onToggleFilters={() => setShowFilterPanel(!showFilterPanel)}
              showFilterPanel={showFilterPanel}
            />
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Searching PubMed and analyzing citations...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert className="mb-8 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        {mainPaper && !isLoading && (
          <div className="space-y-8">
            <div className="flex gap-8">
              {/* Filter Panel Sidebar */}
              {showFilterPanel && (
                <div className="flex-shrink-0">
                  <div className="sticky top-8">
                    <FilterPanel isOpen={showFilterPanel} />
                  </div>
                </div>
              )}

              {/* Main Content Area */}
              <div className="flex-1 min-w-0">
                {/* Paper Details and Visualization */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                  <div className="lg:col-span-1">
                    <div className="sticky top-8 space-y-6">
                      {/* Main Paper Card */}
                      <Card className="p-6 bg-white shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">
                          Main Paper
                        </h3>
                        <PaperCard paper={mainPaper} isMain={true} />
                      </Card>

                      {/* Selected Paper Details */}
                      {selectedPaper && selectedPaper.id !== mainPaper.id && (
                        <Card className="p-6 bg-white shadow-sm">
                          <h3 className="font-semibold text-gray-900 mb-4">
                            Selected Paper
                          </h3>
                          <PaperCard paper={selectedPaper} />
                        </Card>
                      )}

                      {/* Statistics */}
                      <Card className="p-6 bg-white shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">
                          Network Statistics
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total Papers:</span>
                            <span className="font-medium">{filterStats.totalPapers}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Filtered Papers:</span>
                            <span className="font-medium">{filterStats.filteredPapers}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">References:</span>
                            <span className="font-medium">
                              {mainPaper.references?.length || 0}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Citations:</span>
                            <span className="font-medium">
                              {mainPaper.citations?.length || 0}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Similar Papers:</span>
                            <span className="font-medium">
                              {mainPaper.similarPapers?.length || 0}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Available Journals:</span>
                            <span className="font-medium">{filterStats.availableJournals.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Available Authors:</span>
                            <span className="font-medium">{filterStats.availableAuthors.length}</span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>

                  {/* Visualization Area */}
                  <div className="lg:col-span-3">
                    <VisualizationModes />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!mainPaper && !isLoading && !error && (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Start Your Research Journey
              </h3>
              <p className="text-gray-600 mb-6">
                Enter a DOI or PubMed ID to explore citation networks and discover research relationships.
              </p>
              <div className="text-sm text-gray-500">
                <p className="mb-1">Example DOI: 10.1038/nature12373</p>
                <p>Example PubMed ID: 33432212</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
