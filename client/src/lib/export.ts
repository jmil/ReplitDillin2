import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { create as createXml } from 'xmlbuilder2';
import { format } from 'date-fns';
import { 
  Paper, 
  NetworkData, 
  NetworkNode, 
  NetworkEdge, 
  FilterStats,
  ClusteringResult,
  SearchFilters 
} from './types';

// Export format types
export type ExportFormat = 
  | 'json-complete'
  | 'json-filtered' 
  | 'csv-papers'
  | 'csv-citations'
  | 'graphml'
  | 'png-visualization'
  | 'pdf-report';

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  includeMetadata?: boolean;
  includeAbstracts?: boolean;
  includeReferences?: boolean;
  includeClusters?: boolean;
  imageResolution?: number;
  pdfFormat?: 'summary' | 'detailed';
}

export interface ExportProgress {
  stage: string;
  progress: number; // 0-100
  message: string;
  completed: boolean;
}

// Export progress callback type
export type ExportProgressCallback = (progress: ExportProgress) => void;

/**
 * Export complete network data as JSON
 */
export async function exportNetworkJSON(
  networkData: NetworkData,
  papers: Paper[],
  filters: SearchFilters,
  clusteResult: ClusteringResult | null,
  options: ExportOptions,
  onProgress?: ExportProgressCallback
): Promise<void> {
  try {
    onProgress?.({ stage: 'Preparing data', progress: 10, message: 'Organizing network data...', completed: false });

    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        exportType: options.format,
        totalPapers: papers.length,
        totalConnections: networkData.edges.length,
        filters: options.includeMetadata ? filters : undefined,
        clustering: options.includeClusters ? clusteResult : undefined,
        version: '1.0'
      },
      papers: papers.map(paper => ({
        ...paper,
        abstract: options.includeAbstracts ? paper.abstract : undefined,
        references: options.includeReferences ? paper.references : undefined,
        citations: options.includeReferences ? paper.citations : undefined,
        similarPapers: options.includeReferences ? paper.similarPapers : undefined
      })),
      network: {
        nodes: networkData.nodes.map(node => ({
          id: node.id,
          label: node.label,
          paperId: node.paper.id,
          type: node.type,
          position: { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
          size: node.size || 1,
          color: node.color,
          clusterId: options.includeClusters ? node.clusterId : undefined,
          clusterColor: options.includeClusters ? node.clusterColor : undefined
        })),
        edges: networkData.edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          weight: edge.weight || 1
        }))
      },
      statistics: calculateNetworkStatistics(networkData, papers)
    };

    onProgress?.({ stage: 'Generating file', progress: 80, message: 'Creating JSON file...', completed: false });

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const filename = options.filename || `network-export-${format(new Date(), 'yyyy-MM-dd-HH-mm-ss')}.json`;
    
    onProgress?.({ stage: 'Downloading', progress: 100, message: 'Download complete!', completed: true });
    
    saveAs(blob, filename);
  } catch (error) {
    console.error('Error exporting network JSON:', error);
    throw new Error(`Failed to export network JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export papers as CSV
 */
export async function exportPapersCSV(
  papers: Paper[],
  options: ExportOptions,
  onProgress?: ExportProgressCallback
): Promise<void> {
  try {
    onProgress?.({ stage: 'Preparing data', progress: 10, message: 'Processing papers...', completed: false });

    const headers = [
      'ID',
      'PMID',
      'DOI',
      'Title',
      'Authors',
      'Journal',
      'Publish Date',
      'Citation Count',
      'MeSH Terms'
    ];

    if (options.includeAbstracts) {
      headers.push('Abstract');
    }

    if (options.includeReferences) {
      headers.push('Reference Count', 'Citation Count', 'Similar Papers Count');
    }

    const csvRows = [headers.join(',')];

    onProgress?.({ stage: 'Processing papers', progress: 30, message: 'Converting papers to CSV format...', completed: false });

    for (let i = 0; i < papers.length; i++) {
      const paper = papers[i];
      const row = [
        escapeCsvField(paper.id),
        escapeCsvField(paper.pmid || ''),
        escapeCsvField(paper.doi || ''),
        escapeCsvField(paper.title),
        escapeCsvField(paper.authors.join('; ')),
        escapeCsvField(paper.journal),
        escapeCsvField(paper.publishDate),
        paper.citationCount?.toString() || '0',
        escapeCsvField(paper.meshTerms?.join('; ') || '')
      ];

      if (options.includeAbstracts) {
        row.push(escapeCsvField(paper.abstract));
      }

      if (options.includeReferences) {
        row.push(
          (paper.references?.length || 0).toString(),
          (paper.citations?.length || 0).toString(),
          (paper.similarPapers?.length || 0).toString()
        );
      }

      csvRows.push(row.join(','));

      // Update progress periodically
      if (i % 100 === 0) {
        const progress = 30 + (i / papers.length) * 50;
        onProgress?.({ 
          stage: 'Processing papers', 
          progress, 
          message: `Processed ${i}/${papers.length} papers...`, 
          completed: false 
        });
      }
    }

    onProgress?.({ stage: 'Generating file', progress: 85, message: 'Creating CSV file...', completed: false });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const filename = options.filename || `papers-export-${format(new Date(), 'yyyy-MM-dd-HH-mm-ss')}.csv`;
    
    onProgress?.({ stage: 'Downloading', progress: 100, message: 'Download complete!', completed: true });
    
    saveAs(blob, filename);
  } catch (error) {
    console.error('Error exporting papers CSV:', error);
    throw new Error(`Failed to export papers CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export citations and relationships as CSV
 */
export async function exportCitationsCSV(
  networkData: NetworkData,
  papers: Paper[],
  options: ExportOptions,
  onProgress?: ExportProgressCallback
): Promise<void> {
  try {
    onProgress?.({ stage: 'Preparing data', progress: 10, message: 'Processing citations...', completed: false });

    const headers = [
      'Source Paper ID',
      'Source Title',
      'Target Paper ID', 
      'Target Title',
      'Relationship Type',
      'Weight',
      'Source Authors',
      'Target Authors',
      'Source Journal',
      'Target Journal',
      'Source Year',
      'Target Year'
    ];

    const csvRows = [headers.join(',')];
    const paperMap = new Map(papers.map(p => [p.id, p]));

    onProgress?.({ stage: 'Processing relationships', progress: 30, message: 'Converting relationships to CSV...', completed: false });

    for (let i = 0; i < networkData.edges.length; i++) {
      const edge = networkData.edges[i];
      const sourcePaper = paperMap.get(edge.source);
      const targetPaper = paperMap.get(edge.target);

      if (sourcePaper && targetPaper) {
        const row = [
          escapeCsvField(edge.source),
          escapeCsvField(sourcePaper.title),
          escapeCsvField(edge.target),
          escapeCsvField(targetPaper.title),
          escapeCsvField(edge.type),
          (edge.weight || 1).toString(),
          escapeCsvField(sourcePaper.authors.join('; ')),
          escapeCsvField(targetPaper.authors.join('; ')),
          escapeCsvField(sourcePaper.journal),
          escapeCsvField(targetPaper.journal),
          new Date(sourcePaper.publishDate).getFullYear().toString(),
          new Date(targetPaper.publishDate).getFullYear().toString()
        ];

        csvRows.push(row.join(','));
      }

      // Update progress periodically
      if (i % 100 === 0) {
        const progress = 30 + (i / networkData.edges.length) * 50;
        onProgress?.({ 
          stage: 'Processing relationships', 
          progress, 
          message: `Processed ${i}/${networkData.edges.length} relationships...`, 
          completed: false 
        });
      }
    }

    onProgress?.({ stage: 'Generating file', progress: 85, message: 'Creating CSV file...', completed: false });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const filename = options.filename || `citations-export-${format(new Date(), 'yyyy-MM-dd-HH-mm-ss')}.csv`;
    
    onProgress?.({ stage: 'Downloading', progress: 100, message: 'Download complete!', completed: true });
    
    saveAs(blob, filename);
  } catch (error) {
    console.error('Error exporting citations CSV:', error);
    throw new Error(`Failed to export citations CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export network as GraphML format for external tools (Gephi, Cytoscape, etc.)
 */
export async function exportGraphML(
  networkData: NetworkData,
  papers: Paper[],
  clusteResult: ClusteringResult | null,
  options: ExportOptions,
  onProgress?: ExportProgressCallback
): Promise<void> {
  try {
    onProgress?.({ stage: 'Preparing data', progress: 10, message: 'Preparing GraphML structure...', completed: false });

    const paperMap = new Map(papers.map(p => [p.id, p]));
    
    // Create XML structure
    const xml = createXml('graphml');
    xml.att('xmlns', 'http://graphml.graphdrawing.org/xmlns');
    xml.att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
    xml.att('xsi:schemaLocation', 'http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd');

    // Define attributes
    xml.ele('key', { id: 'd0', 'for': 'node', 'attr.name': 'title', 'attr.type': 'string' });
    xml.ele('key', { id: 'd1', 'for': 'node', 'attr.name': 'authors', 'attr.type': 'string' });
    xml.ele('key', { id: 'd2', 'for': 'node', 'attr.name': 'journal', 'attr.type': 'string' });
    xml.ele('key', { id: 'd3', 'for': 'node', 'attr.name': 'publishDate', 'attr.type': 'string' });
    xml.ele('key', { id: 'd4', 'for': 'node', 'attr.name': 'citationCount', 'attr.type': 'int' });
    xml.ele('key', { id: 'd5', 'for': 'node', 'attr.name': 'type', 'attr.type': 'string' });
    xml.ele('key', { id: 'd6', 'for': 'node', 'attr.name': 'pmid', 'attr.type': 'string' });
    xml.ele('key', { id: 'd7', 'for': 'node', 'attr.name': 'doi', 'attr.type': 'string' });
    
    if (options.includeClusters && clusteResult) {
      xml.ele('key', { id: 'd8', 'for': 'node', 'attr.name': 'clusterId', 'attr.type': 'string' });
      xml.ele('key', { id: 'd9', 'for': 'node', 'attr.name': 'clusterName', 'attr.type': 'string' });
    }

    // Edge attributes
    xml.ele('key', { id: 'e0', 'for': 'edge', 'attr.name': 'type', 'attr.type': 'string' });
    xml.ele('key', { id: 'e1', 'for': 'edge', 'attr.name': 'weight', 'attr.type': 'double' });

    const graph = xml.ele('graph', { id: 'G', edgedefault: 'directed' });

    onProgress?.({ stage: 'Adding nodes', progress: 30, message: 'Adding nodes to GraphML...', completed: false });

    // Add nodes
    for (let i = 0; i < networkData.nodes.length; i++) {
      const node = networkData.nodes[i];
      const paper = paperMap.get(node.paper.id);
      
      if (paper) {
        const nodeElement = graph.ele('node', { id: node.id });
        
        nodeElement.ele('data', { key: 'd0' }).txt(paper.title);
        nodeElement.ele('data', { key: 'd1' }).txt(paper.authors.join('; '));
        nodeElement.ele('data', { key: 'd2' }).txt(paper.journal);
        nodeElement.ele('data', { key: 'd3' }).txt(paper.publishDate);
        nodeElement.ele('data', { key: 'd4' }).txt(paper.citationCount?.toString() || '0');
        nodeElement.ele('data', { key: 'd5' }).txt(node.type);
        nodeElement.ele('data', { key: 'd6' }).txt(paper.pmid || '');
        nodeElement.ele('data', { key: 'd7' }).txt(paper.doi || '');
        
        if (options.includeClusters && clusteResult && node.clusterId) {
          const cluster = clusteResult.clusters.find(c => c.id === node.clusterId);
          nodeElement.ele('data', { key: 'd8' }).txt(node.clusterId);
          nodeElement.ele('data', { key: 'd9' }).txt(cluster?.name || '');
        }
      }

      // Update progress periodically
      if (i % 50 === 0) {
        const progress = 30 + (i / networkData.nodes.length) * 25;
        onProgress?.({ 
          stage: 'Adding nodes', 
          progress, 
          message: `Added ${i}/${networkData.nodes.length} nodes...`, 
          completed: false 
        });
      }
    }

    onProgress?.({ stage: 'Adding edges', progress: 60, message: 'Adding edges to GraphML...', completed: false });

    // Add edges
    for (let i = 0; i < networkData.edges.length; i++) {
      const edge = networkData.edges[i];
      const edgeElement = graph.ele('edge', { 
        id: edge.id, 
        source: edge.source, 
        target: edge.target 
      });
      
      edgeElement.ele('data', { key: 'e0' }).txt(edge.type);
      edgeElement.ele('data', { key: 'e1' }).txt((edge.weight || 1).toString());

      // Update progress periodically
      if (i % 50 === 0) {
        const progress = 60 + (i / networkData.edges.length) * 25;
        onProgress?.({ 
          stage: 'Adding edges', 
          progress, 
          message: `Added ${i}/${networkData.edges.length} edges...`, 
          completed: false 
        });
      }
    }

    onProgress?.({ stage: 'Generating file', progress: 90, message: 'Creating GraphML file...', completed: false });

    const graphmlContent = xml.end({ prettyPrint: true });
    const blob = new Blob([graphmlContent], { type: 'application/xml' });
    const filename = options.filename || `network-export-${format(new Date(), 'yyyy-MM-dd-HH-mm-ss')}.graphml`;
    
    onProgress?.({ stage: 'Downloading', progress: 100, message: 'Download complete!', completed: true });
    
    saveAs(blob, filename);
  } catch (error) {
    console.error('Error exporting GraphML:', error);
    throw new Error(`Failed to export GraphML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export current visualization as PNG image
 */
export async function exportVisualizationPNG(
  element: Element,
  options: ExportOptions,
  onProgress?: ExportProgressCallback
): Promise<void> {
  try {
    onProgress?.({ stage: 'Capturing visualization', progress: 20, message: 'Preparing screenshot...', completed: false });

    // Ensure we have an HTMLElement for html2canvas
    const htmlElement = element instanceof HTMLElement ? element : 
                       element.closest('div') || 
                       element.parentElement ||
                       document.body;

    const canvas = await html2canvas(htmlElement, {
      backgroundColor: '#ffffff',
      scale: options.imageResolution || 2,
      useCORS: true,
      allowTaint: true,
      height: element.scrollHeight,
      width: element.scrollWidth,
      onclone: (clonedDoc) => {
        // Remove any UI overlays if needed
        const overlays = clonedDoc.querySelectorAll('[data-export-exclude]');
        overlays.forEach(overlay => overlay.remove());
      }
    });

    onProgress?.({ stage: 'Processing image', progress: 70, message: 'Processing image data...', completed: false });

    canvas.toBlob((blob) => {
      if (blob) {
        const filename = options.filename || `visualization-export-${format(new Date(), 'yyyy-MM-dd-HH-mm-ss')}.png`;
        
        onProgress?.({ stage: 'Downloading', progress: 100, message: 'Download complete!', completed: true });
        
        saveAs(blob, filename);
      } else {
        throw new Error('Failed to generate image blob');
      }
    }, 'image/png');
  } catch (error) {
    console.error('Error exporting visualization PNG:', error);
    throw new Error(`Failed to export visualization PNG: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export research report as PDF
 */
export async function exportResearchReportPDF(
  papers: Paper[],
  networkData: NetworkData,
  filterStats: FilterStats,
  clusteResult: ClusteringResult | null,
  filters: SearchFilters,
  options: ExportOptions,
  onProgress?: ExportProgressCallback
): Promise<void> {
  try {
    onProgress?.({ stage: 'Initializing PDF', progress: 10, message: 'Setting up PDF document...', completed: false });

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // Helper function to add text with automatic line breaks
    const addText = (text: string, x: number, y: number, maxWidth: number) => {
      const lines = pdf.splitTextToSize(text, maxWidth);
      pdf.text(lines, x, y);
      return y + (lines.length * 5);
    };

    // Helper function to check if we need a new page
    const checkNewPage = (requiredSpace: number) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
    };

    // Title
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    yPosition = addText('Research Network Analysis Report', margin, yPosition, pageWidth - 2 * margin);
    yPosition += 10;

    // Metadata
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    yPosition = addText(`Generated on: ${format(new Date(), 'MMMM dd, yyyy')}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition = addText(`Total Papers: ${papers.length}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition = addText(`Network Connections: ${networkData.edges.length}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition += 10;

    onProgress?.({ stage: 'Adding summary', progress: 30, message: 'Adding network summary...', completed: false });

    // Network Statistics
    checkNewPage(60);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    yPosition = addText('Network Statistics', margin, yPosition, pageWidth - 2 * margin);
    yPosition += 5;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const stats = calculateNetworkStatistics(networkData, papers);
    yPosition = addText(`Density: ${stats.density.toFixed(4)}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition = addText(`Average Citations: ${stats.averageCitations.toFixed(2)}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition = addText(`Year Range: ${stats.yearRange.min} - ${stats.yearRange.max}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition = addText(`Most Cited Paper: ${stats.mostCitedPaper?.title || 'N/A'}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition += 10;

    // Clustering Results (if available)
    if (options.includeClusters && clusteResult) {
      onProgress?.({ stage: 'Adding clusters', progress: 50, message: 'Adding cluster analysis...', completed: false });

      checkNewPage(80);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      yPosition = addText('Cluster Analysis', margin, yPosition, pageWidth - 2 * margin);
      yPosition += 5;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      yPosition = addText(`Algorithm: ${clusteResult.algorithm}`, margin, yPosition, pageWidth - 2 * margin);
      yPosition = addText(`Number of Clusters: ${clusteResult.clusters.length}`, margin, yPosition, pageWidth - 2 * margin);
      
      if (clusteResult.quality.silhouetteScore) {
        yPosition = addText(`Silhouette Score: ${clusteResult.quality.silhouetteScore.toFixed(4)}`, margin, yPosition, pageWidth - 2 * margin);
      }
      yPosition += 10;

      // Top clusters
      const topClusters = clusteResult.clusters
        .sort((a, b) => b.size - a.size)
        .slice(0, 5);

      for (const cluster of topClusters) {
        checkNewPage(25);
        pdf.setFont('helvetica', 'bold');
        yPosition = addText(`Cluster: ${cluster.name}`, margin, yPosition, pageWidth - 2 * margin);
        pdf.setFont('helvetica', 'normal');
        yPosition = addText(`Size: ${cluster.size} papers`, margin + 10, yPosition, pageWidth - 2 * margin);
        yPosition = addText(`Keywords: ${cluster.keywords.join(', ')}`, margin + 10, yPosition, pageWidth - 2 * margin);
        yPosition += 5;
      }
      yPosition += 10;
    }

    onProgress?.({ stage: 'Adding papers', progress: 70, message: 'Adding paper details...', completed: false });

    // Paper List
    checkNewPage(40);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    yPosition = addText('Paper Details', margin, yPosition, pageWidth - 2 * margin);
    yPosition += 5;

    // Sort papers by citation count and take top papers
    const topPapers = [...papers]
      .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0))
      .slice(0, options.pdfFormat === 'detailed' ? 20 : 10);

    for (let i = 0; i < topPapers.length; i++) {
      const paper = topPapers[i];
      
      checkNewPage(30);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      yPosition = addText(`${i + 1}. ${paper.title}`, margin, yPosition, pageWidth - 2 * margin);
      
      pdf.setFont('helvetica', 'normal');
      yPosition = addText(`Authors: ${paper.authors.join(', ')}`, margin + 5, yPosition, pageWidth - 2 * margin);
      yPosition = addText(`Journal: ${paper.journal}`, margin + 5, yPosition, pageWidth - 2 * margin);
      yPosition = addText(`Published: ${paper.publishDate}`, margin + 5, yPosition, pageWidth - 2 * margin);
      
      if (paper.citationCount) {
        yPosition = addText(`Citations: ${paper.citationCount}`, margin + 5, yPosition, pageWidth - 2 * margin);
      }
      
      if (paper.pmid) {
        yPosition = addText(`PMID: ${paper.pmid}`, margin + 5, yPosition, pageWidth - 2 * margin);
      }
      
      if (paper.doi) {
        yPosition = addText(`DOI: ${paper.doi}`, margin + 5, yPosition, pageWidth - 2 * margin);
      }
      
      yPosition += 5;

      // Update progress
      if (i % 5 === 0) {
        const progress = 70 + (i / topPapers.length) * 20;
        onProgress?.({ 
          stage: 'Adding papers', 
          progress, 
          message: `Added ${i}/${topPapers.length} papers...`, 
          completed: false 
        });
      }
    }

    onProgress?.({ stage: 'Finalizing PDF', progress: 95, message: 'Finalizing PDF document...', completed: false });

    // Save the PDF
    const filename = options.filename || `research-report-${format(new Date(), 'yyyy-MM-dd-HH-mm-ss')}.pdf`;
    
    onProgress?.({ stage: 'Downloading', progress: 100, message: 'Download complete!', completed: true });
    
    pdf.save(filename);
  } catch (error) {
    console.error('Error exporting PDF report:', error);
    throw new Error(`Failed to export PDF report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate network statistics
 */
function calculateNetworkStatistics(networkData: NetworkData, papers: Paper[]) {
  const totalNodes = networkData.nodes.length;
  const totalEdges = networkData.edges.length;
  const maxPossibleEdges = totalNodes * (totalNodes - 1);
  const density = maxPossibleEdges > 0 ? totalEdges / maxPossibleEdges : 0;

  const citationCounts = papers.map(p => p.citationCount || 0).filter(c => c > 0);
  const averageCitations = citationCounts.length > 0 ? citationCounts.reduce((a, b) => a + b, 0) / citationCounts.length : 0;

  const years = papers.map(p => new Date(p.publishDate).getFullYear()).filter(y => !isNaN(y));
  const yearRange = {
    min: years.length > 0 ? Math.min(...years) : 0,
    max: years.length > 0 ? Math.max(...years) : 0
  };

  const mostCitedPaper = papers.reduce((max, paper) => 
    (paper.citationCount || 0) > (max?.citationCount || 0) ? paper : max, 
    papers[0] || null
  );

  return {
    totalNodes,
    totalEdges,
    density,
    averageCitations,
    yearRange,
    mostCitedPaper
  };
}

/**
 * Escape CSV field content
 */
function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Main export function that routes to specific export handlers
 */
export async function exportData(
  format: ExportFormat,
  data: {
    networkData: NetworkData;
    papers: Paper[];
    filters: SearchFilters;
    filterStats: FilterStats;
    clusteResult: ClusteringResult | null;
    visualizationElement?: Element;
  },
  options: ExportOptions,
  onProgress?: ExportProgressCallback
): Promise<void> {
  const { networkData, papers, filters, filterStats, clusteResult, visualizationElement } = data;

  switch (format) {
    case 'json-complete':
    case 'json-filtered':
      return exportNetworkJSON(networkData, papers, filters, clusteResult, options, onProgress);
    
    case 'csv-papers':
      return exportPapersCSV(papers, options, onProgress);
    
    case 'csv-citations':
      return exportCitationsCSV(networkData, papers, options, onProgress);
    
    case 'graphml':
      return exportGraphML(networkData, papers, clusteResult, options, onProgress);
    
    case 'png-visualization':
      if (!visualizationElement) {
        throw new Error('Visualization element is required for image export');
      }
      return exportVisualizationPNG(visualizationElement, options, onProgress);
    
    case 'pdf-report':
      return exportResearchReportPDF(papers, networkData, filterStats, clusteResult, filters, options, onProgress);
    
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}