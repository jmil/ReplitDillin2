import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Search, X } from "lucide-react";
import { usePapers } from "../lib/stores/usePapers";

export function SearchInterface() {
  const [query, setQuery] = useState("");
  const { searchPaper, clearData, isLoading } = usePapers();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    await searchPaper(query.trim());
  };

  const handleClear = () => {
    setQuery("");
    clearData();
  };

  const isValidQuery = (q: string) => {
    // Check for DOI pattern
    const doiPattern = /^10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+$/;
    // Check for PubMed ID (numbers only)
    const pmidPattern = /^\d+$/;
    
    return doiPattern.test(q) || pmidPattern.test(q);
  };

  return (
    <Card className="p-6 bg-white shadow-sm">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Enter DOI (10.1038/nature12373) or PubMed ID (33432212)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-10"
              disabled={isLoading}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <Button 
            type="submit" 
            disabled={isLoading || !query.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? "Searching..." : "Search"}
          </Button>
          
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleClear}
            disabled={isLoading}
          >
            Clear
          </Button>
        </div>
        
        {query && !isValidQuery(query) && (
          <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-200">
            <p className="font-medium">Invalid format</p>
            <p>Please enter a valid DOI (e.g., 10.1038/nature12373) or PubMed ID (e.g., 33432212)</p>
          </div>
        )}
        
        <div className="text-xs text-gray-500">
          <p>
            <strong>DOI:</strong> Digital Object Identifier (e.g., 10.1038/nature12373)
          </p>
          <p>
            <strong>PubMed ID:</strong> Numerical identifier from PubMed database (e.g., 33432212)
          </p>
        </div>
      </form>
    </Card>
  );
}
