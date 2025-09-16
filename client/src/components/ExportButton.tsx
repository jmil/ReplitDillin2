import React, { useState, useRef } from 'react';
import { usePapers } from '../lib/stores/usePapers';
import { ExportModal } from './ExportModal';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from './ui/dropdown-menu';
import { 
  Download, 
  FileJson, 
  FileSpreadsheet, 
  Network, 
  Image, 
  FileText,
  ChevronDown
} from 'lucide-react';

interface ExportButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  showLabel?: boolean;
  visualizationElement?: Element | null;
}

export function ExportButton({ 
  className = '',
  variant = 'outline',
  size = 'default',
  showLabel = true,
  visualizationElement
}: ExportButtonProps) {
  const { 
    allPapers,
    exportState,
    exportNetworkData
  } = usePapers();
  
  const [isModalOpen, setIsModalOpen] = useState(false);

  const quickExportOptions = [
    {
      format: 'json-complete' as const,
      icon: FileJson,
      label: 'Complete JSON',
      description: 'Full network data'
    },
    {
      format: 'csv-papers' as const,
      icon: FileSpreadsheet,
      label: 'Papers CSV',
      description: 'Spreadsheet format'
    },
    {
      format: 'graphml' as const,
      icon: Network,
      label: 'GraphML Network',
      description: 'For external tools'
    },
    {
      format: 'png-visualization' as const,
      icon: Image,
      label: 'Visualization PNG',
      description: 'Current view as image',
      disabled: !visualizationElement
    },
    {
      format: 'pdf-report' as const,
      icon: FileText,
      label: 'Research Report',
      description: 'PDF summary'
    }
  ];

  const handleQuickExport = async (format: any) => {
    if (!allPapers.length) return;
    
    // Runtime guard for PNG export - prevent failure when no visualization element is available
    if (format === 'png-visualization' && !visualizationElement) {
      console.error('PNG export attempted without visualization element');
      // You could add toast notification here if available:
      // toast.error('Visualization not available for image export. Please ensure a visualization is loaded.');
      return;
    }
    
    const defaultOptions = {
      format,
      includeMetadata: true,
      includeAbstracts: format !== 'png-visualization',
      includeReferences: true,
      includeClusters: true,
      imageResolution: 2,
      pdfFormat: 'summary' as const
    };

    try {
      await exportNetworkData(format, defaultOptions, visualizationElement || undefined);
    } catch (error) {
      console.error('Quick export failed:', error);
      // Enhanced error handling - you could add toast notification here:
      // toast.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const isDisabled = !allPapers.length || exportState.isExporting;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            disabled={isDisabled}
            className={`${className} ${exportState.isExporting ? 'animate-pulse' : ''}`}
          >
            <Download className="h-4 w-4" />
            {showLabel && (
              <>
                <span className="ml-2">
                  {exportState.isExporting ? 'Exporting...' : 'Export'}
                </span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Quick Export</DropdownMenuLabel>
          
          {quickExportOptions.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenuItem
                key={option.format}
                disabled={option.disabled || isDisabled}
                onClick={() => handleQuickExport(option.format)}
                className="cursor-pointer"
              >
                <Icon className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </div>
              </DropdownMenuItem>
            );
          })}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            disabled={isDisabled}
            onClick={() => setIsModalOpen(true)}
            className="cursor-pointer"
          >
            <Download className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">More Options...</span>
              <span className="text-xs text-muted-foreground">Advanced export settings</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Export Modal */}
      <ExportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        visualizationElement={visualizationElement}
      />
    </>
  );
}

// Variant for inline use without dropdown
export function QuickExportButton({ 
  format,
  className = '',
  children,
  visualizationElement
}: {
  format: any;
  className?: string;
  children: React.ReactNode;
  visualizationElement?: Element | null;
}) {
  const { allPapers, exportState, exportNetworkData } = usePapers();

  const handleExport = async () => {
    if (!allPapers.length) return;
    
    const defaultOptions = {
      format,
      includeMetadata: true,
      includeAbstracts: format !== 'png-visualization',
      includeReferences: true,
      includeClusters: true,
      imageResolution: 2,
      pdfFormat: 'summary' as const
    };

    try {
      await exportNetworkData(format, defaultOptions, visualizationElement || undefined);
    } catch (error) {
      console.error('Quick export failed:', error);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={!allPapers.length || exportState.isExporting}
      className={className}
    >
      {children}
    </Button>
  );
}