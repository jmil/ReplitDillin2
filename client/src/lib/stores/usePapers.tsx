import { create } from "zustand";
import { Paper, NetworkData, VisualizationMode } from "../types";

interface PapersState {
  mainPaper: Paper | null;
  allPapers: Paper[];
  networkData: NetworkData;
  currentMode: VisualizationMode;
  selectedPaper: Paper | null;
  isLoading: boolean;
  error: string | null;
  
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
}

export const usePapers = create<PapersState>((set, get) => ({
  mainPaper: null,
  allPapers: [],
  networkData: { nodes: [], edges: [] },
  currentMode: 'cytoscape',
  selectedPaper: null,
  isLoading: false,
  error: null,
  
  setMainPaper: (paper) => set({ mainPaper: paper }),
  addPapers: (papers) => set(state => ({ 
    allPapers: [...state.allPapers, ...papers] 
  })),
  setNetworkData: (data) => set({ networkData: data }),
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
      
      set({
        mainPaper: data.mainPaper,
        allPapers: [data.mainPaper, ...data.relatedPapers],
        networkData: data.networkData,
        isLoading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Search failed',
        isLoading: false
      });
    }
  },
  
  clearData: () => set({
    mainPaper: null,
    allPapers: [],
    networkData: { nodes: [], edges: [] },
    selectedPaper: null,
    error: null
  })
}));
