import { create } from "zustand";
import { Paper, NetworkData, VisualizationMode, SearchFilters, FilterStats } from "../types";
import { 
  defaultFilters, 
  filterNetworkData, 
  createFilterStats, 
  getYearRangeFromPapers,
  getCitationRangeFromPapers 
} from "../filters";

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
    citationRange: [0, 100]
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
      citationRange: [0, 100]
    }
  })
}));
