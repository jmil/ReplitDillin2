import React, { useState, useRef } from 'react';
import { usePapers } from '../lib/stores/usePapers';
import { ExportFormat, ExportOptions } from '../lib/export';
import { 
  Dialog,
  DialogContent, 
  DialogDescription,
  DialogFooter, 
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Download, 
  FileJson, 
  FileSpreadsheet, 
  Network, 
  Image, 
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { format } from 'date-fns';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  visualizationElement?: Element | null;
}

export function ExportModal({ isOpen, onClose, visualizationElement }: ExportModalProps) {
  const { 
    allPapers,
    filteredNetworkData,
    networkData,
    filters,
    filterStats,
    clustering,
    exportState,
    exportNetworkData
  } = usePapers();

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json-complete');
  const [customFilename, setCustomFilename] = useState('');
  const [exportOptions, setExportOptions] = useState<Partial<ExportOptions>>({
    includeMetadata: true,
    includeAbstracts: true,
    includeReferences: true,
    includeClusters: clustering.isActive,
    imageResolution: 2,
    pdfFormat: 'summary'
  });

  // Enhanced validation for various export scenarios
  const getValidationState = () => {
    // Check for basic requirements
    if (!allPapers.length) {
      return { 
        isValid: false, 
        error: 'No research data available for export. Please search for papers first.',
        severity: 'error' as const
      };
    }

    // PNG export specific validation
    if (selectedFormat === 'png-visualization' && !visualizationElement) {
      return { 
        isValid: false, 
        error: 'Visualization not available for image export. Please ensure a visualization is currently displayed.',
        severity: 'warning' as const
      };
    }

    // Network export validation - check if network data exists
    if (['graphml', 'json-complete', 'json-filtered'].includes(selectedFormat) && 
        (!networkData || networkData.nodes.length === 0)) {
      return { 
        isValid: false, 
        error: 'No network data available. Please load research connections first.',
        severity: 'error' as const
      };
    }

    // Filtered export validation - warn if no filtering applied but using filtered format
    if (selectedFormat === 'json-filtered' && 
        filteredNetworkData.nodes.length === networkData.nodes.length) {
      return { 
        isValid: true, 
        error: 'No filters applied - filtered export will be the same as complete export.',
        severity: 'info' as const
      };
    }

    return { isValid: true, error: null, severity: null };
  };

  const validationState = getValidationState();
  const canExport = validationState.isValid && !exportState.isExporting;

  const handleExport = async () => {
    if (!allPapers.length) {
      return;
    }

    // Additional validation for PNG export
    if (selectedFormat === 'png-visualization' && !visualizationElement) {
      console.error('PNG export attempted without visualization element');
      return;
    }

    const timestamp = format(new Date(), 'yyyy-MM-dd-HH-mm-ss');
    const defaultFilenames = {
      'json-complete': `network-complete-${timestamp}.json`,
      'json-filtered': `network-filtered-${timestamp}.json`,
      'csv-papers': `papers-${timestamp}.csv`,
      'csv-citations': `citations-${timestamp}.csv`,
      'graphml': `network-${timestamp}.graphml`,
      'png-visualization': `visualization-${timestamp}.png`,
      'pdf-report': `research-report-${timestamp}.pdf`
    };

    const options: ExportOptions = {
      format: selectedFormat,
      filename: customFilename || defaultFilenames[selectedFormat],
      ...exportOptions
    };

    try {
      await exportNetworkData(selectedFormat, options, visualizationElement || undefined);
      
      // Close modal after successful export
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
      // Error handling is managed by the export store, but we can add additional UI feedback here if needed
    }
  };

  const formatDescriptions = {
    'json-complete': {
      icon: FileJson,
      title: 'Complete Network JSON',
      description: 'Full network data with all papers, citations, and relationships',
      size: `~${Math.round((allPapers.length * 2.5) / 1000)}MB estimated`
    },
    'json-filtered': {
      icon: FileJson,
      title: 'Filtered Network JSON',
      description: 'Network data respecting current filters and search criteria',
      size: `~${Math.round((filterStats.filteredPapers * 2.5) / 1000)}MB estimated`
    },
    'csv-papers': {
      icon: FileSpreadsheet,
      title: 'Papers CSV',
      description: 'Spreadsheet with paper details, authors, journals, and citations',
      size: `${filterStats.filteredPapers} papers`
    },
    'csv-citations': {
      icon: FileSpreadsheet,
      title: 'Citations CSV',
      description: 'Relationships and citations between papers for network analysis',
      size: `${networkData.edges.length} relationships`
    },
    'graphml': {
      icon: Network,
      title: 'GraphML Network',
      description: 'Network format for Gephi, Cytoscape, and other analysis tools',
      size: `${networkData.nodes.length} nodes, ${networkData.edges.length} edges`
    },
    'png-visualization': {
      icon: Image,
      title: 'Visualization Image',
      description: 'High-resolution PNG of current visualization',
      size: 'PNG format, customizable resolution'
    },
    'pdf-report': {
      icon: FileText,
      title: 'Research Report',
      description: 'Comprehensive PDF report with analysis and citations',
      size: `${Math.min(20, allPapers.length)} top papers included`
    }
  };

  const currentFormat = formatDescriptions[selectedFormat];
  const Icon = currentFormat.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Research Data
          </DialogTitle>
          <DialogDescription>
            Export your research network and citation data in various formats for analysis, 
            reporting, or use in external tools.
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator during export */}
        {exportState.isExporting && exportState.exportProgress && (
          <div className="space-y-3">
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{exportState.exportProgress.stage}</span>
                    <span>{Math.round(exportState.exportProgress.progress)}%</span>
                  </div>
                  <Progress value={exportState.exportProgress.progress} className="w-full" />
                  <p className="text-xs text-muted-foreground">
                    {exportState.exportProgress.message}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Success message */}
        {exportState.exportProgress?.completed && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Export completed successfully! Your file should start downloading automatically.
            </AlertDescription>
          </Alert>
        )}


        {/* Export format selection */}
        {!exportState.isExporting && (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-medium">Export Format</Label>
              
              <RadioGroup 
                value={selectedFormat} 
                onValueChange={(value) => setSelectedFormat(value as ExportFormat)}
              >
                {Object.entries(formatDescriptions).map(([format, info]) => {
                  const FormatIcon = info.icon;
                  return (
                    <div key={format} className="flex items-start space-x-3 space-y-0">
                      <RadioGroupItem value={format} id={format} className="mt-1" />
                      <div className="flex-1 cursor-pointer" onClick={() => setSelectedFormat(format as ExportFormat)}>
                        <Label 
                          htmlFor={format} 
                          className="flex items-center gap-2 cursor-pointer font-medium"
                        >
                          <FormatIcon className="h-4 w-4" />
                          {info.title}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {info.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {info.size}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>

            {/* Export options */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Export Options</Label>
              
              {/* Filename customization */}
              <div className="space-y-2">
                <Label htmlFor="filename" className="text-sm">Custom Filename (optional)</Label>
                <Input
                  id="filename"
                  placeholder={`Leave empty for auto-generated name`}
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                />
              </div>

              {/* Content options */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="metadata"
                    checked={exportOptions.includeMetadata}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeMetadata: checked as boolean }))
                    }
                  />
                  <Label htmlFor="metadata" className="text-sm">
                    Include metadata (filters, timestamps, statistics)
                  </Label>
                </div>

                {(selectedFormat.includes('json') || selectedFormat.includes('csv') || selectedFormat === 'pdf-report') && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="abstracts"
                        checked={exportOptions.includeAbstracts}
                        onCheckedChange={(checked) => 
                          setExportOptions(prev => ({ ...prev, includeAbstracts: checked as boolean }))
                        }
                      />
                      <Label htmlFor="abstracts" className="text-sm">
                        Include paper abstracts
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="references"
                        checked={exportOptions.includeReferences}
                        onCheckedChange={(checked) => 
                          setExportOptions(prev => ({ ...prev, includeReferences: checked as boolean }))
                        }
                      />
                      <Label htmlFor="references" className="text-sm">
                        Include reference lists and citations
                      </Label>
                    </div>
                  </>
                )}

                {clustering.isActive && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="clusters"
                      checked={exportOptions.includeClusters}
                      onCheckedChange={(checked) => 
                        setExportOptions(prev => ({ ...prev, includeClusters: checked as boolean }))
                      }
                    />
                    <Label htmlFor="clusters" className="text-sm">
                      Include cluster analysis results
                    </Label>
                  </div>
                )}
              </div>

              {/* Format-specific options */}
              {selectedFormat === 'png-visualization' && (
                <div className="space-y-2">
                  <Label className="text-sm">Image Resolution</Label>
                  <Select 
                    value={exportOptions.imageResolution?.toString()} 
                    onValueChange={(value) => 
                      setExportOptions(prev => ({ ...prev, imageResolution: parseInt(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Standard (1x)</SelectItem>
                      <SelectItem value="2">High (2x) - Recommended</SelectItem>
                      <SelectItem value="3">Ultra High (3x)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedFormat === 'pdf-report' && (
                <div className="space-y-2">
                  <Label className="text-sm">Report Detail Level</Label>
                  <RadioGroup 
                    value={exportOptions.pdfFormat} 
                    onValueChange={(value) => 
                      setExportOptions(prev => ({ ...prev, pdfFormat: value as 'summary' | 'detailed' }))
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="summary" id="summary" />
                      <Label htmlFor="summary" className="text-sm">
                        Summary (top 10 papers, network overview)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="detailed" id="detailed" />
                      <Label htmlFor="detailed" className="text-sm">
                        Detailed (top 20 papers, comprehensive analysis)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>

            {/* Warning for large datasets */}
            {((selectedFormat === 'json-complete' && allPapers.length > 500) ||
              (selectedFormat === 'pdf-report' && exportOptions.pdfFormat === 'detailed')) && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Large dataset detected. Export may take several minutes to complete.
                </AlertDescription>
              </Alert>
            )}

            {/* Enhanced validation feedback */}
            {validationState.error && (
              <Alert className={
                validationState.severity === 'error' ? 'border-red-200 bg-red-50' :
                validationState.severity === 'warning' ? 'border-orange-200 bg-orange-50' :
                'border-blue-200 bg-blue-50'
              }>
                {validationState.severity === 'error' ? (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                ) : validationState.severity === 'warning' ? (
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                ) : (
                  <Info className="h-4 w-4 text-blue-600" />
                )}
                <AlertDescription className={
                  validationState.severity === 'error' ? 'text-red-800' :
                  validationState.severity === 'warning' ? 'text-orange-800' :
                  'text-blue-800'
                }>
                  {validationState.error}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={exportState.isExporting}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={!canExport}
            className={!canExport ? 'opacity-50 cursor-not-allowed' : ''}
            title={validationState.error || 'Export research data'}
          >
            {exportState.isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Icon className="h-4 w-4 mr-2" />
                Export Data
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}