import { create } from "zustand";
import { Paper, NetworkData, VisualizationMode, SearchFilters, FilterStats, ClusteringState, ClusteringResult, ClusteringConfig } from "../types";
import { 
  defaultFilters, 
  filterNetworkData, 
  createFilterStats, 
  getYearRangeFromPapers,
  getCitationRangeFromPapers,
  hasActiveFilters
} from "../filters";
import { ExportFormat, ExportOptions, ExportProgress, exportData } from "../export";
import { defaultClusteringConfig, defaultClusteringEngine } from "../clustering";

// Export state interface
interface ExportState {
  isExporting: boolean;
  exportProgress: ExportProgress | null;
  lastExportDate: Date | null;
  supportedFormats: ExportFormat[];
}

interface PapersState {
  mainPaper: Paper | null;
  allPapers: Paper[];
  networkData: NetworkData;
  filteredNetworkData: NetworkData;
  currentMode: VisualizationMode;
  selectedPaper: Paper | null;
  isLoading: boolean;
  error: string | null;
  filters: SearchFilters;
  filterStats: FilterStats;
  
  // Export state
  exportState: ExportState;
  
  // Actions
  setMainPaper: (paper: Paper) => void;
  addPapers: (papers: Paper[]) => void;
  setNetworkData: (data: NetworkData) => void;
  setVisualizationMode: (mode: VisualizationMode) => void;
  setSelectedPaper: (paper: Paper | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  searchPaper: (query: string) => Promise<void>;
  clearData: () => void;
  updateFilters: (newFilters: Partial<SearchFilters>) => void;
  resetFilters: () => void;
  applyFilters: () => void;
  
  // Clustering actions
  clustering: ClusteringState;
  performClustering: (config: ClusteringConfig) => Promise<void>;
  setClusteringResult: (result: ClusteringResult | null) => void;
  toggleClustering: (enabled: boolean) => void;
  updateClusteringConfig: (config: Partial<ClusteringConfig>) => void;
  
  // Export actions
  exportNetworkData: (format: ExportFormat, options: ExportOptions, visualizationElement?: Element) => Promise<void>;
  setExportProgress: (progress: ExportProgress | null) => void;
}

export const usePapers = create<PapersState>((set, get) => ({
  mainPaper: null,
  allPapers: [],
  networkData: { nodes: [], edges: [] },
  filteredNetworkData: { nodes: [], edges: [] },
  currentMode: 'cytoscape',
  selectedPaper: null,
  isLoading: false,
  error: null,
  filters: defaultFilters,
  filterStats: {
    totalPapers: 0,
    filteredPapers: 0,
    yearRange: [new Date().getFullYear() - 10, new Date().getFullYear()],
    availableJournals: [],
    availableAuthors: [],
    citationRange: [0, 100],
    availableClusters: []
  },
  
  // Clustering state
  clustering: {
    isActive: false,
    currentResult: null,
    availableResults: [],
    isProcessing: false,
    config: defaultClusteringConfig
  },
  
  // Export state
  exportState: {
    isExporting: false,
    exportProgress: null,
    lastExportDate: null,
    supportedFormats: [
      'json-complete',
      'json-filtered',
      'csv-papers',
      'csv-citations',
      'graphml',
      'png-visualization',
      'pdf-report'
    ]
  },
  
  setMainPaper: (paper) => set({ mainPaper: paper }),
  addPapers: (papers) => set(state => ({ 
    allPapers: [...state.allPapers, ...papers] 
  })),
  setNetworkData: (data) => {
    const state = get();
    const filteredData = filterNetworkData(data, state.filters);
    const newStats = createFilterStats(data.nodes.map(n => n.paper));
    
    set({ 
      networkData: data,
      filteredNetworkData: filteredData,
      filterStats: newStats
    });
  },
  setVisualizationMode: (mode) => set({ currentMode: mode }),
  setSelectedPaper: (paper) => set({ selectedPaper: paper }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  searchPaper: async (query: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      const papers = [data.mainPaper, ...data.relatedPapers];
      
      // Create initial filter bounds based on loaded data
      const yearRange = getYearRangeFromPapers(papers);
      const citationRange = getCitationRangeFromPapers(papers);
      const newFilterDefaults = {
        ...defaultFilters,
        yearRange,
        maxCitations: citationRange[1]
      };
      
      const filteredNetworkData = filterNetworkData(data.networkData, newFilterDefaults);
      const newStats = createFilterStats(papers);
      
      set({
        mainPaper: data.mainPaper,
        allPapers: papers,
        networkData: data.networkData,
        filteredNetworkData: filteredNetworkData,
        filters: newFilterDefaults,
        filterStats: newStats,
        isLoading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Search failed',
        isLoading: false
      });
    }
  },
  
  updateFilters: (newFilters: Partial<SearchFilters>) => {
    const state = get();
    const updatedFilters = { ...state.filters, ...newFilters };
    const filteredData = filterNetworkData(state.networkData, updatedFilters);
    const updatedStats = {
      ...state.filterStats,
      filteredPapers: filteredData.nodes.length
    };
    
    set({ 
      filters: updatedFilters,
      filteredNetworkData: filteredData,
      filterStats: updatedStats
    });
  },
  
  resetFilters: () => {
    const state = get();
    const papers = state.allPapers;
    const yearRange = getYearRangeFromPapers(papers);
    const citationRange = getCitationRangeFromPapers(papers);
    
    const resetFilters = {
      ...defaultFilters,
      yearRange,
      maxCitations: citationRange[1]
    };
    
    const filteredData = filterNetworkData(state.networkData, resetFilters);
    const newStats = createFilterStats(papers);
    
    set({
      filters: resetFilters,
      filteredNetworkData: filteredData,
      filterStats: newStats
    });
  },
  
  applyFilters: () => {
    const state = get();
    const filteredData = filterNetworkData(state.networkData, state.filters);
    const updatedStats = {
      ...state.filterStats,
      filteredPapers: filteredData.nodes.length
    };
    
    set({
      filteredNetworkData: filteredData,
      filterStats: updatedStats
    });
  },
  
  clearData: () => set({
    mainPaper: null,
    allPapers: [],
    networkData: { nodes: [], edges: [] },
    filteredNetworkData: { nodes: [], edges: [] },
    selectedPaper: null,
    error: null,
    filters: defaultFilters,
    filterStats: {
      totalPapers: 0,
      filteredPapers: 0,
      yearRange: [new Date().getFullYear() - 10, new Date().getFullYear()],
      availableJournals: [],
      availableAuthors: [],
      citationRange: [0, 100],
      availableClusters: []
    },
    clustering: {
      isActive: false,
      currentResult: null,
      availableResults: [],
      isProcessing: false,
      config: defaultClusteringConfig
    }
  }),

  // Clustering actions
  performClustering: async (config: ClusteringConfig) => {
    const state = get();
    if (state.allPapers.length === 0) {
      set({ error: 'No papers available for clustering' });
      return;
    }

    set({
      clustering: {
        ...state.clustering,
        isProcessing: true,
        config
      },
      error: null
    });

    try {
      const result = await defaultClusteringEngine.performClustering(
        state.allPapers,
        state.networkData,
        config
      );

      // Update network nodes with cluster information
      const updatedNetworkData = {
        ...state.networkData,
        nodes: state.networkData.nodes.map(node => {
          const clusterId = result.assignments[node.paper.id];
          const cluster = clusterId ? result.clusters.find(c => c.id === clusterId) : null;
          return {
            ...node,
            clusterId: clusterId || null,
            clusterColor: cluster?.color || node.color
          };
        })
      };

      // Update filter stats with available clusters
      const updatedFilterStats = {
        ...state.filterStats,
        availableClusters: result.clusters
      };

      // Apply current filters to new network data
      const filteredData = filterNetworkData(updatedNetworkData, state.filters);

      set({
        clustering: {
          ...state.clustering,
          isActive: true,
          currentResult: result,
          availableResults: [...state.clustering.availableResults, result],
          isProcessing: false
        },
        networkData: updatedNetworkData,
        filteredNetworkData: filteredData,
        filterStats: updatedFilterStats
      });

    } catch (error) {
      set({
        clustering: {
          ...state.clustering,
          isProcessing: false
        },
        error: error instanceof Error ? error.message : 'Clustering failed'
      });
    }
  },

  setClusteringResult: (result: ClusteringResult | null) => {
    const state = get();
    
    if (!result) {
      // Remove clustering
      const updatedNetworkData = {
        ...state.networkData,
        nodes: state.networkData.nodes.map(node => ({
          ...node,
          clusterId: undefined,
          clusterColor: undefined
        }))
      };

      const filteredData = filterNetworkData(updatedNetworkData, state.filters);
      const updatedFilterStats = {
        ...state.filterStats,
        availableClusters: []
      };

      set({
        clustering: {
          ...state.clustering,
          isActive: false,
          currentResult: null
        },
        networkData: updatedNetworkData,
        filteredNetworkData: filteredData,
        filterStats: updatedFilterStats
      });
      return;
    }

    // Apply clustering result
    const updatedNetworkData = {
      ...state.networkData,
      nodes: state.networkData.nodes.map(node => ({
        ...node,
        clusterId: result.assignments.get(node.paper.id) || null,
        clusterColor: result.clusters.find(c => c.id === result.assignments.get(node.paper.id))?.color || node.color
      }))
    };

    const filteredData = filterNetworkData(updatedNetworkData, state.filters);
    const updatedFilterStats = {
      ...state.filterStats,
      availableClusters: result.clusters
    };

    set({
      clustering: {
        ...state.clustering,
        isActive: true,
        currentResult: result
      },
      networkData: updatedNetworkData,
      filteredNetworkData: filteredData,
      filterStats: updatedFilterStats
    });
  },

  toggleClustering: (enabled: boolean) => {
    const state = get();
    
    if (!enabled) {
      // Disable clustering
      const updatedNetworkData = {
        ...state.networkData,
        nodes: state.networkData.nodes.map(node => ({
          ...node,
          clusterId: undefined,
          clusterColor: undefined
        }))
      };

      const filteredData = filterNetworkData(updatedNetworkData, state.filters);
      const updatedFilterStats = {
        ...state.filterStats,
        availableClusters: []
      };

      set({
        clustering: {
          ...state.clustering,
          isActive: false
        },
        networkData: updatedNetworkData,
        filteredNetworkData: filteredData,
        filterStats: updatedFilterStats
      });
    } else if (state.clustering.currentResult) {
      // Re-enable with existing result
      get().setClusteringResult(state.clustering.currentResult);
    }
  },

  updateClusteringConfig: (newConfig: Partial<ClusteringConfig>) => {
    const state = get();
    set({
      clustering: {
        ...state.clustering,
        config: {
          ...state.clustering.config,
          ...newConfig
        }
      }
    });
  },

  // Export actions
  exportNetworkData: async (format: ExportFormat, options: ExportOptions, visualizationElement?: Element) => {
    const state = get();
    
    try {
      set({
        exportState: {
          ...state.exportState,
          isExporting: true,
          exportProgress: {
            stage: 'Initializing',
            progress: 0,
            message: 'Preparing export...',
            completed: false
          }
        }
      });

      // Determine if we should use filtered data based on format and active filters
      const useFilteredData = (options.format === 'json-filtered') || 
                               (options.format === 'csv-papers' && hasActiveFilters(state.filters, defaultFilters));

      const exportDataPayload = {
        networkData: useFilteredData 
          ? state.filteredNetworkData 
          : state.networkData,
        papers: useFilteredData
          ? state.filteredNetworkData.nodes.map(node => node.paper)
          : state.allPapers,
        filters: state.filters,
        filterStats: state.filterStats,
        clusteResult: state.clustering.currentResult,
        visualizationElement
      };

      await exportData(format, exportDataPayload, options, (progress) => {
        set(state => ({
          exportState: {
            ...state.exportState,
            exportProgress: progress
          }
        }));
      });

      set({
        exportState: {
          ...state.exportState,
          isExporting: false,
          exportProgress: null,
          lastExportDate: new Date()
        }
      });

    } catch (error) {
      console.error('Export failed:', error);
      set({
        exportState: {
          ...state.exportState,
          isExporting: false,
          exportProgress: null
        },
        error: error instanceof Error ? error.message : 'Export failed'
      });
    }
  },

  setExportProgress: (progress: ExportProgress | null) => {
    set(state => ({
      exportState: {
        ...state.exportState,
        exportProgress: progress
      }
    }));
  }
}));
