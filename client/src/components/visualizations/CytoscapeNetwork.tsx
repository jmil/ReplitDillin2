import React, { useEffect, useRef } from "react";
import { NetworkData } from "../../lib/types";
import { usePapers } from "../../lib/stores/usePapers";
import { formatPubMedCitation } from "../../lib/utils";

interface CytoscapeNetworkProps {
  data: NetworkData;
  fullscreen?: boolean;
}

declare global {
  interface Window {
    cytoscape: any;
  }
}

export function CytoscapeNetwork({ data, fullscreen }: CytoscapeNetworkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const { setSelectedPaper, selectedPaper } = usePapers();

  useEffect(() => {
    if (!containerRef.current || !window.cytoscape || !data.nodes.length) return;

    // Clean up existing instance
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const elements = [
      ...data.nodes.map(node => ({
        data: { 
          id: node.id, 
          label: node.label,
          paper: node.paper,
          type: node.type
        }
      })),
      ...data.edges.map(edge => ({
        data: { 
          id: edge.id, 
          source: edge.source, 
          target: edge.target,
          type: edge.type 
        }
      }))
    ];

    cyRef.current = window.cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(type)',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '12px',
            'font-weight': 'bold',
            'text-wrap': 'wrap',
            'text-max-width': '120px',
            'width': 40,
            'height': 40,
            'border-width': 2,
            'border-color': '#fff',
            'color': '#333'
          }
        },
        {
          selector: 'node[type="main"]',
          style: {
            'background-color': '#3B82F6',
            'width': 60,
            'height': 60,
            'font-size': '14px',
            'font-weight': 'bold',
            'color': '#fff'
          }
        },
        {
          selector: 'node[type="reference"]',
          style: {
            'background-color': '#10B981'
          }
        },
        {
          selector: 'node[type="citation"]',
          style: {
            'background-color': '#F59E0B'
          }
        },
        {
          selector: 'node[type="similar"]',
          style: {
            'background-color': '#8B5CF6'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 'data(weight)',
            'line-color': 'data(type)',
            'target-arrow-color': 'data(type)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.2
          }
        },
        {
          selector: 'edge[type="references"]',
          style: {
            'line-color': '#10B981',
            'target-arrow-color': '#10B981',
            'width': 2
          }
        },
        {
          selector: 'edge[type="citations"]',
          style: {
            'line-color': '#F59E0B',
            'target-arrow-color': '#F59E0B',
            'width': 2
          }
        },
        {
          selector: 'edge[type="similar"]',
          style: {
            'line-color': '#8B5CF6',
            'target-arrow-color': '#8B5CF6',
            'width': 1,
            'line-style': 'dashed'
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#EF4444',
            'overlay-opacity': 0.2,
            'overlay-color': '#EF4444'
          }
        }
      ],
      layout: {
        name: 'cose',
        idealEdgeLength: 100,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 30,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: 400000,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0
      },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      wheelSensitivity: 0.1
    });

    // Create tooltip element with proper reference management
    if (tooltipRef.current) {
      document.body.removeChild(tooltipRef.current);
    }
    
    tooltipRef.current = document.createElement('div');
    tooltipRef.current.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px;
      border-radius: 8px;
      font-size: 12px;
      max-width: 300px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      pointer-events: none;
      opacity: 0;
      z-index: 1000;
      transition: opacity 0.2s;
      line-height: 1.4;
    `;
    document.body.appendChild(tooltipRef.current);

    // Handle node interactions
    cyRef.current.on('tap', 'node', (event: any) => {
      const node = event.target;
      const paper = node.data('paper');
      setSelectedPaper(paper);
    });

    cyRef.current.on('mouseover', 'node', (event: any) => {
      const node = event.target;
      const paper = node.data('paper');
      const nodeType = node.data('type');
      
      if (!tooltipRef.current) return;
      
      // Clear existing content and build tooltip safely
      tooltipRef.current.innerHTML = '';
      
      const container = document.createElement('div');
      
      // Paper type
      const typeDiv = document.createElement('div');
      typeDiv.style.cssText = 'font-weight: bold; color: #60A5FA; margin-bottom: 8px;';
      typeDiv.textContent = nodeType === 'main' ? 'Main Paper' : nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
      container.appendChild(typeDiv);
      
      // Paper title
      const titleDiv = document.createElement('div');
      titleDiv.style.cssText = 'font-weight: bold; margin-bottom: 4px;';
      titleDiv.textContent = paper.title;
      container.appendChild(titleDiv);
      
      // Authors
      const authorsDiv = document.createElement('div');
      authorsDiv.style.cssText = 'color: #D1D5DB; margin-bottom: 8px;';
      authorsDiv.textContent = paper.authors.slice(0, 3).join(', ') + (paper.authors.length > 3 ? ' et al.' : '');
      container.appendChild(authorsDiv);
      
      // Citation section
      const citationContainer = document.createElement('div');
      citationContainer.style.cssText = 'border-top: 1px solid #374151; padding-top: 8px;';
      
      const citationLabel = document.createElement('div');
      citationLabel.style.cssText = 'font-weight: bold; color: #FBBF24; margin-bottom: 4px;';
      citationLabel.textContent = 'PubMed Citation:';
      citationContainer.appendChild(citationLabel);
      
      const citationContent = document.createElement('div');
      citationContent.textContent = formatPubMedCitation(paper);
      citationContainer.appendChild(citationContent);
      
      container.appendChild(citationContainer);
      tooltipRef.current.appendChild(container);
      
      // Position tooltip
      const renderedPosition = node.renderedPosition();
      const containerRect = containerRef.current!.getBoundingClientRect();
      
      tooltipRef.current.style.left = (containerRect.left + renderedPosition.x + 20) + 'px';
      tooltipRef.current.style.top = (containerRect.top + renderedPosition.y - 10) + 'px';
      tooltipRef.current.style.opacity = '1';
    });

    cyRef.current.on('mouseout', 'node', () => {
      if (tooltipRef.current) {
        tooltipRef.current.style.opacity = '0';
      }
    });

    // Handle background tap
    cyRef.current.on('tap', (event: any) => {
      if (event.target === cyRef.current) {
        cyRef.current.$('node:selected').unselect();
      }
    });

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
      // Clean up tooltip using proper reference
      if (tooltipRef.current && tooltipRef.current.parentNode) {
        tooltipRef.current.parentNode.removeChild(tooltipRef.current);
        tooltipRef.current = null;
      }
    };
  }, [data, setSelectedPaper]);

  // Update selection when selectedPaper changes
  useEffect(() => {
    if (!cyRef.current) return;

    cyRef.current.$('node:selected').unselect();
    if (selectedPaper) {
      cyRef.current.$(`node[id="${selectedPaper.id}"]`).select();
    }
  }, [selectedPaper]);

  return (
    <div className="h-full relative bg-gray-50">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-md border">
        <h4 className="font-semibold text-sm mb-3">Legend</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span>Main Paper</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>References</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span>Citations</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>Similar Papers</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-md border">
        <div className="flex gap-2">
          <button
            onClick={() => cyRef.current?.fit()}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            Fit
          </button>
          <button
            onClick={() => cyRef.current?.center()}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            Center
          </button>
        </div>
      </div>
    </div>
  );
}
