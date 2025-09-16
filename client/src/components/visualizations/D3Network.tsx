import React, { useEffect, useRef } from "react";
import { NetworkData } from "../../lib/types";
import { usePapers } from "../../lib/stores/usePapers";
import { formatPubMedCitation } from "../../lib/utils";

interface D3NetworkProps {
  data: NetworkData;
  fullscreen?: boolean;
}

declare global {
  interface Window {
    d3: any;
  }
}

export const D3Network = React.forwardRef<SVGSVGElement, D3NetworkProps>(
  ({ data, fullscreen }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const { setSelectedPaper, selectedPaper, clustering } = usePapers();

  // Merge refs to expose SVG element
  const mergedRef = React.useCallback((node: SVGSVGElement) => {
    svgRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }, [ref]);

  // Empty state when no data
  if (!data.nodes.length) {
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

  useEffect(() => {
    if (!svgRef.current || !window.d3 || !data.nodes.length) return;

    const d3 = window.d3;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event: any) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom);

    const container = svg.append("g");

    // Color mapping for node types (fallback when clustering is not active)
    const defaultColorMap = {
      main: "#3B82F6",
      reference: "#10B981", 
      citation: "#F59E0B",
      similar: "#8B5CF6"
    };

    // Function to get node color based on clustering state
    const getNodeColor = (node: any) => {
      if (clustering.isActive && node.clusterId && node.clusterColor) {
        return node.clusterColor;
      }
      return defaultColorMap[node.type as keyof typeof defaultColorMap] || "#6B7280";
    };

    // Create simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force("link", d3.forceLink(data.edges).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(25));

    // Create arrow markers for directed edges
    const defs = svg.append("defs");
    
    Object.entries(defaultColorMap).forEach(([type, color]) => {
      defs.append("marker")
        .attr("id", `arrow-${type}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 15)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", color);
    });

    // Create additional markers for cluster colors if clustering is active
    if (clustering.isActive && clustering.currentResult) {
      clustering.currentResult.clusters.forEach(cluster => {
        defs.append("marker")
          .attr("id", `arrow-cluster-${cluster.id}`)
          .attr("viewBox", "0 -5 10 10")
          .attr("refX", 15)
          .attr("refY", 0)
          .attr("markerWidth", 6)
          .attr("markerHeight", 6)
          .attr("orient", "auto")
          .append("path")
          .attr("d", "M0,-5L10,0L0,5")
          .attr("fill", cluster.color);
      });
    }

    // Create edges
    const link = container.append("g")
      .selectAll("line")
      .data(data.edges)
      .enter()
      .append("line")
      .attr("stroke", (d: any) => {
        // Use cluster color for source node if clustering is active
        const sourceNode = data.nodes.find(n => n.id === d.source.id || n.id === d.source);
        if (clustering.isActive && sourceNode?.clusterColor) {
          return sourceNode.clusterColor;
        }
        
        // Fallback to original type-based colors
        switch(d.type) {
          case 'references': return defaultColorMap.reference;
          case 'citations': return defaultColorMap.citation;
          case 'similar': return defaultColorMap.similar;
          default: return "#999";
        }
      })
      .attr("stroke-width", (d: any) => d.type === 'similar' ? 1 : 2)
      .attr("stroke-dasharray", (d: any) => d.type === 'similar' ? "5,5" : null)
      .attr("marker-end", (d: any) => {
        // Use cluster-based arrow marker if clustering is active
        const sourceNode = data.nodes.find(n => n.id === d.source.id || n.id === d.source);
        if (clustering.isActive && sourceNode?.clusterId) {
          return `url(#arrow-cluster-${sourceNode.clusterId})`;
        }
        return `url(#arrow-${d.type})`;
      });

    // Create nodes
    const node = container.append("g")
      .selectAll("g")
      .data(data.nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(d3.drag()
        .on("start", (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event: any, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    // Add circles to nodes
    node.append("circle")
      .attr("r", (d: any) => d.type === 'main' ? 20 : 12)
      .attr("fill", getNodeColor)
      .attr("stroke", (d: any) => {
        if (clustering.isActive && d.clusterId && d.clusterColor) {
          return d.clusterColor;
        }
        return "#fff";
      })
      .attr("stroke-width", (d: any) => {
        if (clustering.isActive && d.clusterId) {
          return d.type === 'main' ? 4 : 3;
        }
        return 2;
      });

    // Add labels
    node.append("text")
      .attr("dy", (d: any) => d.type === 'main' ? 30 : 20)
      .attr("text-anchor", "middle")
      .style("font-size", (d: any) => d.type === 'main' ? "12px" : "10px")
      .style("font-weight", (d: any) => d.type === 'main' ? "bold" : "normal")
      .style("fill", "#333")
      .text((d: any) => {
        const maxLength = d.type === 'main' ? 30 : 20;
        return d.label.length > maxLength ? 
          d.label.substring(0, maxLength) + "..." : 
          d.label;
      });

    // Create tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "d3-tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.9)")
      .style("color", "white")
      .style("padding", "12px")
      .style("border-radius", "8px")
      .style("font-size", "12px")
      .style("max-width", "300px")
      .style("box-shadow", "0 4px 6px rgba(0, 0, 0, 0.1)")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", "1000");

    // Handle node interactions
    node.on("click", (event: any, d: any) => {
      event.stopPropagation();
      setSelectedPaper(d.paper);
    })
    .on("mouseover", (event: any, d: any) => {
      tooltip.transition().duration(200).style("opacity", 1);
      
      // Clear existing content and build tooltip safely
      tooltip.selectAll("*").remove();
      
      const container = tooltip.append("div");
      
      // Paper type
      container.append("div")
        .style("font-weight", "bold")
        .style("color", "#60A5FA")
        .style("margin-bottom", "8px")
        .text(d.type === 'main' ? 'Main Paper' : d.type.charAt(0).toUpperCase() + d.type.slice(1));
      
      // Cluster information (if available)
      if (clustering.isActive && d.clusterId && clustering.currentResult) {
        const cluster = clustering.currentResult.clusters.find((c: any) => c.id === d.clusterId);
        if (cluster) {
          const clusterDiv = container.append("div")
            .style("font-size", "11px")
            .style("color", "#D1D5DB")
            .style("margin-bottom", "6px")
            .style("padding", "4px 8px")
            .style("background", "rgba(255,255,255,0.1)")
            .style("border-radius", "4px");
          
          const clusterHeader = clusterDiv.append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("gap", "4px");
          
          clusterHeader.append("div")
            .style("width", "8px")
            .style("height", "8px")
            .style("border-radius", "50%")
            .style("background", cluster.color);
          
          clusterHeader.append("span")
            .style("font-weight", "500")
            .style("color", "#F3F4F6")
            .text(cluster.name);
          
          clusterDiv.append("div")
            .style("font-size", "10px")
            .style("margin-top", "2px")
            .style("opacity", "0.8")
            .text(`${cluster.size} papers in cluster`);
        }
      }
      
      // Paper title
      container.append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "4px")
        .text(d.paper.title);
      
      // Authors
      container.append("div")
        .style("color", "#D1D5DB")
        .style("margin-bottom", "8px")
        .text(d.paper.authors.slice(0, 3).join(", ") + (d.paper.authors.length > 3 ? " et al." : ""));
      
      // Citation section
      const citationDiv = container.append("div")
        .style("border-top", "1px solid #374151")
        .style("padding-top", "8px");
      
      citationDiv.append("div")
        .style("font-weight", "bold")
        .style("color", "#FBBF24")
        .style("margin-bottom", "4px")
        .text("PubMed Citation:");
      
      citationDiv.append("div")
        .style("line-height", "1.4")
        .text(formatPubMedCitation(d.paper));
      
      tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");
    })
    .on("mousemove", (event: any) => {
      tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");
    })
    .on("mouseout", () => {
      tooltip.transition().duration(200).style("opacity", 0);
    });

    // Handle background clicks
    svg.on("click", () => {
      setSelectedPaper(null);
    });

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Highlight selected node
    const updateSelection = () => {
      node.selectAll("circle")
        .attr("stroke", (d: any) => 
          selectedPaper && d.id === selectedPaper.id ? "#EF4444" : "#fff")
        .attr("stroke-width", (d: any) => 
          selectedPaper && d.id === selectedPaper.id ? 4 : 2);
    };

    updateSelection();

    return () => {
      simulation.stop();
      // Clean up tooltip
      d3.select(".d3-tooltip").remove();
    };
  }, [data, selectedPaper, setSelectedPaper]);

  return (
    <div className="h-full relative bg-gray-50">
      <svg
        ref={mergedRef}
        className="w-full h-full"
        style={{ background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)" }}
      />
      
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
        <div className="text-xs text-gray-600 mb-2">Controls:</div>
        <div className="text-xs text-gray-500 space-y-1">
          <div>• Drag nodes to reposition</div>
          <div>• Scroll to zoom</div>
          <div>• Click nodes to select</div>
        </div>
      </div>
    </div>
  );
});

D3Network.displayName = 'D3Network';
