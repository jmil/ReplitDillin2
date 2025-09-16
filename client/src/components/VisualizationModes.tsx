import React from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { usePapers } from "../lib/stores/usePapers";
import { CytoscapeNetwork } from "./visualizations/CytoscapeNetwork";
import { D3Network } from "./visualizations/D3Network";
import { TimelineView } from "./visualizations/TimelineView";
import { OrbitView } from "./visualizations/OrbitView";
import { UniverseView } from "./visualizations/UniverseView";
import { 
  Network, 
  Share2, 
  Clock, 
  Orbit, 
  Zap,
  Maximize2
} from "lucide-react";

export function VisualizationModes() {
  const { 
    currentMode, 
    setVisualizationMode, 
    filteredNetworkData, 
    filterStats,
    filters 
  } = usePapers();
  const [fullscreen, setFullscreen] = React.useState(false);

  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
  };

  const visualizationTabs = [
    {
      id: 'cytoscape' as const,
      label: 'Network Graph',
      icon: Network,
      description: 'Interactive citation network',
      component: CytoscapeNetwork
    },
    {
      id: 'd3' as const,
      label: 'D3 Network',
      icon: Share2,
      description: 'Force-directed graph',
      component: D3Network
    },
    {
      id: 'timeline' as const,
      label: 'Timeline',
      icon: Clock,
      description: 'Chronological view',
      component: TimelineView
    },
    {
      id: 'orbit' as const,
      label: 'Orbit View',
      icon: Orbit,
      description: '3D orbital visualization',
      component: OrbitView
    },
    {
      id: 'universe' as const,
      label: 'Universe',
      icon: Zap,
      description: 'Temporal funnel view',
      component: UniverseView
    }
  ];

  return (
    <div className={`${fullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      <Card className="h-full">
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Research Visualization
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>
                Showing {filterStats.filteredPapers} of {filterStats.totalPapers} papers
              </span>
              {filterStats.filteredPapers !== filterStats.totalPapers && (
                <span className="text-blue-600 font-medium">(Filtered)</span>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="flex items-center gap-2"
          >
            <Maximize2 className="h-4 w-4" />
            {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </Button>
        </div>

        <Tabs 
          value={currentMode} 
          onValueChange={(value) => setVisualizationMode(value as any)}
          className="h-full"
        >
          <TabsList className="grid w-full grid-cols-5 bg-white border-b p-1">
            {visualizationTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex flex-col items-center gap-1 py-3 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {visualizationTabs.map((tab) => {
            const Component = tab.component;
            return (
              <TabsContent 
                key={tab.id}
                value={tab.id} 
                className={`mt-0 h-full ${fullscreen ? 'h-screen' : 'h-[600px]'}`}
              >
                <div className="h-full relative">
                  <Component 
                    data={filteredNetworkData} 
                    fullscreen={fullscreen}
                  />
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </Card>
    </div>
  );
}
