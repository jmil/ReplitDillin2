import React, { useEffect, useRef } from "react";
import { NetworkData } from "../../lib/types";
import { usePapers } from "../../lib/stores/usePapers";
import { formatPubMedCitation } from "../../lib/utils";

interface TimelineViewProps {
  data: NetworkData;
  fullscreen?: boolean;
}

export const TimelineView = React.forwardRef<HTMLDivElement, TimelineViewProps>(
  ({ data, fullscreen }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setSelectedPaper, selectedPaper, clustering } = usePapers();

  // Merge refs to expose container element
  const mergedRef = React.useCallback((node: HTMLDivElement) => {
    containerRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }, [ref]);

  // Sort papers by publication date
  const sortedPapers = React.useMemo(() => {
    return [...data.nodes].sort((a, b) => {
      const dateA = new Date(a.paper.publishDate).getTime();
      const dateB = new Date(b.paper.publishDate).getTime();
      return dateA - dateB;
    });
  }, [data.nodes]);

  // Group papers by year
  const papersByYear = React.useMemo(() => {
    const grouped = new Map<number, typeof sortedPapers>();
    
    sortedPapers.forEach(paper => {
      const year = new Date(paper.paper.publishDate).getFullYear();
      if (!grouped.has(year)) {
        grouped.set(year, []);
      }
      grouped.get(year)!.push(paper);
    });
    
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [sortedPapers]);

  const getNodeColor = (node: any) => {
    // Use cluster color if clustering is active and node has cluster
    if (clustering.isActive && node.clusterId && node.clusterColor) {
      return `border-[3px]`;
    }
    
    // Fallback to original type-based colors
    switch (node.type) {
      case 'main': return 'bg-blue-500 border-blue-600';
      case 'reference': return 'bg-green-500 border-green-600';
      case 'citation': return 'bg-yellow-500 border-yellow-600';
      case 'similar': return 'bg-purple-500 border-purple-600';
      default: return 'bg-gray-500 border-gray-600';
    }
  };

  const getNodeBackgroundStyle = (node: any) => {
    if (clustering.isActive && node.clusterId && node.clusterColor) {
      return { backgroundColor: node.clusterColor };
    }
    return {};
  };

  const getNodeSize = (type: string) => {
    return type === 'main' ? 'w-4 h-4' : 'w-3 h-3';
  };

  if (papersByYear.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500 max-w-md">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold mb-2">No Papers Found</h3>
          <p className="text-sm">
            Try adjusting your filters or search criteria to see more results.
          </p>
        </div>
      </div>
    );
  }

  const yearRange = papersByYear[papersByYear.length - 1][0] - papersByYear[0][0];

  return (
    <div ref={mergedRef} className="h-full bg-gray-50 overflow-auto">
      <div className="p-6">
        {/* Timeline Header */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Research Timeline
          </h3>
          <p className="text-gray-600">
            {papersByYear.length} years • {sortedPapers.length} papers • 
            {papersByYear[0][0]} - {papersByYear[papersByYear.length - 1][0]}
          </p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Central timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>

          {papersByYear.map(([year, papers], yearIndex) => (
            <div key={year} className="relative mb-12">
              {/* Year marker */}
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-white border-4 border-gray-300 rounded-full flex items-center justify-center text-sm font-bold text-gray-700 shadow-lg z-10">
                  {year}
                </div>
                <div className="ml-6">
                  <div className="text-lg font-semibold text-gray-900">
                    {year}
                  </div>
                  <div className="text-sm text-gray-600">
                    {papers.length} paper{papers.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Papers for this year */}
              <div className="ml-20 space-y-4">
                {papers.map((node, paperIndex) => (
                  <div
                    key={node.id}
                    className={`group cursor-pointer transition-all duration-200 ${
                      selectedPaper?.id === node.id 
                        ? 'transform scale-105' 
                        : 'hover:transform hover:scale-102'
                    }`}
                    onClick={() => setSelectedPaper(node.paper)}
                  >
                    {/* Connection line to timeline */}
                    <div className="absolute left-8 w-12 h-0.5 bg-gray-200 group-hover:bg-gray-400 transition-colors"
                         style={{ 
                           top: `${yearIndex * 192 + 64 + paperIndex * 80 + 40}px`,
                         }}>
                    </div>

                    <div className={`bg-white rounded-lg border-2 p-4 shadow-sm group-hover:shadow-md transition-all ${
                      selectedPaper?.id === node.id 
                        ? 'border-red-300 shadow-lg' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      {/* Paper type indicator */}
                      <div className="flex items-center gap-3 mb-3">
                        <div 
                          className={`rounded-full border-2 ${getNodeColor(node)} ${getNodeSize(node.type)}`}
                          style={getNodeBackgroundStyle(node)}
                        ></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              {node.type === 'main' ? 'Main Paper' : 
                               node.type === 'reference' ? 'Reference' :
                               node.type === 'citation' ? 'Citation' : 'Similar'}
                            </span>
                            {/* Cluster badge */}
                            {clustering.isActive && node.clusterId && clustering.currentResult && (
                              (() => {
                                const cluster = clustering.currentResult.clusters.find((c: any) => c.id === node.clusterId);
                                return cluster ? (
                                  <span 
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                                    style={{ backgroundColor: cluster.color }}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-white/80"></span>
                                    {cluster.name}
                                  </span>
                                ) : null;
                              })()
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(node.paper.publishDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Paper details */}
                      <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                        {node.paper.title}
                      </h4>
                      <p className="text-sm text-gray-600 mb-2">
                        {node.paper.authors.slice(0, 3).join(", ")}
                        {node.paper.authors.length > 3 && " et al."}
                      </p>
                      <p className="text-xs text-gray-500">
                        {node.paper.journal}
                      </p>

                      {/* PubMed Citation */}
                      <div className="mt-3 p-2 bg-gray-50 rounded border-l-2 border-blue-200">
                        <p className="text-xs text-gray-700 leading-relaxed">
                          <span className="font-medium text-blue-800">PubMed Citation: </span>
                          {formatPubMedCitation(node.paper)}
                        </p>
                      </div>

                      {/* Citation count if available */}
                      {node.paper.citationCount !== undefined && (
                        <div className="mt-2 text-xs text-gray-500">
                          {node.paper.citationCount} citations
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="fixed top-4 right-4 bg-white p-4 rounded-lg shadow-md border z-20">
        <h4 className="font-semibold text-sm mb-3">Paper Types</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-600"></div>
            <span>Main Paper</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-green-600"></div>
            <span>References</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500 border-2 border-yellow-600"></div>
            <span>Citations</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500 border-2 border-purple-600"></div>
            <span>Similar Papers</span>
          </div>
        </div>
      </div>
    </div>
  );
});

TimelineView.displayName = 'TimelineView';
