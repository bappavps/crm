
"use client"

import React from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Barcode from 'react-barcode'
import { cn } from "@/lib/utils"

interface TemplateElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
  content?: string;
  placeholder?: string;
  barcodeType?: any;
  style: any;
}

interface TemplateRendererProps {
  template: any;
  data: Record<string, any>;
  scale?: number;
}

const MM_TO_PX = 3.78;

const FONT_FAMILIES = [
  { id: 'inter', value: 'var(--font-inter), sans-serif' },
  { id: 'roboto', value: "'Roboto', sans-serif" },
  { id: 'montserrat', value: "'Montserrat', sans-serif" },
  { id: 'poppins', value: "'Poppins', sans-serif" },
  { id: 'oswald', value: "'Oswald', sans-serif" },
  { id: 'open-sans', value: "'Open Sans', sans-serif" },
  { id: 'arial', value: "Arial, sans-serif" },
  { id: 'helvetica', value: "Helvetica, sans-serif" },
  { id: 'mono', value: "ui-monospace, SFMono-Regular, monospace" },
];

export function TemplateRenderer({ template, data, scale = 1 }: TemplateRendererProps) {
  if (!template) return null;

  const elements = template.elements || [];
  const paperWidth = template.paperWidth || 210;
  const paperHeight = template.paperHeight || 297;

  /**
   * REPLACEMENT ENGINE: Detects {{placeholder}} and replaces with live data.
   * Supports embedded text: "Width: {{width}} MM" -> "Width: 1020 MM"
   */
  const processText = (text: string) => {
    if (!text) return "";
    return text.replace(/\{\{(.+?)\}\}/g, (match, key) => {
      const cleanKey = key.trim();
      return data[cleanKey] !== undefined ? String(data[cleanKey]) : ""; // Return empty if not found to handle fallbacks correctly
    });
  };

  const isValidURL = (str: string) => str.startsWith("http://") || str.startsWith("https://");

  const getFontFamilyValue = (id: string) => FONT_FAMILIES.find(f => f.id === id)?.value || 'sans-serif';

  const renderElement = (el: TemplateElement) => {
    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${el.x}px`,
      top: `${el.y}px`,
      width: `${el.width}px`,
      height: el.type === 'line' ? `${el.style.borderWidth || 2}px` : `${el.height}px`,
      transform: `rotate(${el.rotate || 0}deg)`,
      opacity: el.style.opacity || 1,
      backgroundColor: el.type === 'line' ? el.style.borderColor : (el.style.backgroundColor || 'transparent'),
      border: (el.style.borderWidth && el.type !== 'line') ? `${el.style.borderWidth}px ${el.style.lineStyle || 'solid'} ${el.style.borderColor || '#000'}` : 'none',
      borderRadius: el.type === 'circle' ? '100%' : `${el.style.borderRadius || 0}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: el.style.textAlign === 'center' ? 'center' : el.style.textAlign === 'right' ? 'flex-end' : 'flex-start',
      overflow: 'hidden',
      zIndex: 10
    };

    const textStyle: React.CSSProperties = {
      fontSize: `${el.style.fontSize}px`,
      fontFamily: getFontFamilyValue(el.style.fontFamily),
      fontWeight: el.style.fontWeight,
      color: el.style.color,
      textAlign: el.style.textAlign || 'left' as any,
      width: '100%',
      padding: '4px'
    };

    switch (el.type) {
      case 'text':
      case 'title':
        return (
          <div style={style}>
            <span style={textStyle}>{processText(el.content || "")}</span>
          </div>
        );
      case 'field':
        return (
          <div style={style}>
            <span style={textStyle}>{processText(el.placeholder || "")}</span>
          </div>
        );
      case 'table':
        const tableKey = (el.placeholder || "").replace(/[{}]/g, '');
        const tableData = data[tableKey] || [];
        
        if (tableKey === 'sourceRolls') {
          return (
            <div style={{ ...style, flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', height: 'auto' }}>
              <div style={{ display: 'flex', borderBottom: '2px solid black', padding: '4px', backgroundColor: '#f0f0f0' }}>
                <span style={{ flex: 2, fontSize: '10px', fontWeight: 'bold' }}>ROLL ID</span>
                <span style={{ flex: 2, fontSize: '10px', fontWeight: 'bold' }}>PAPER TYPE</span>
                <span style={{ flex: 2, fontSize: '10px', fontWeight: 'bold' }}>DIMENSION</span>
                <span style={{ flex: 2, fontSize: '10px', fontWeight: 'bold' }}>COMPANY</span>
              </div>
              {tableData.map((row: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', borderBottom: '1px solid #ccc', padding: '4px' }}>
                  <span style={{ flex: 2, fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold' }}>{row.rollId}</span>
                  <span style={{ flex: 2, fontSize: '10px' }}>{row.paperType}</span>
                  <span style={{ flex: 2, fontSize: '10px' }}>{row.width}mm x {row.length}m</span>
                  <span style={{ flex: 2, fontSize: '10px' }}>{row.company}</span>
                </div>
              ))}
            </div>
          );
        }

        return (
          <div style={{ ...style, flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', height: 'auto' }}>
            <div style={{ display: 'flex', borderBottom: '2px solid black', padding: '4px', backgroundColor: '#f0f0f0' }}>
              <span style={{ flex: 2, fontSize: '10px', fontWeight: 'bold' }}>ROLL ID</span>
              <span style={{ flex: 1, fontSize: '10px', fontWeight: 'bold' }}>W (MM)</span>
              <span style={{ flex: 1, fontSize: '10px', fontWeight: 'bold' }}>L (MTR)</span>
              <span style={{ flex: 1, fontSize: '10px', fontWeight: 'bold' }}>DEST</span>
            </div>
            {tableData.map((row: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', borderBottom: '1px solid #ccc', padding: '4px' }}>
                <span style={{ flex: 2, fontSize: '10px', fontFamily: 'monospace' }}>{row.rollNo || row.roll_code}</span>
                <span style={{ flex: 1, fontSize: '10px' }}>{row.widthMm || row.width}</span>
                <span style={{ flex: 1, fontSize: '10px' }}>{row.lengthMeters || row.length}</span>
                <span style={{ flex: 1, fontSize: '10px', fontWeight: 'bold' }}>{row.jobNo ? 'JOB' : 'STOCK'}</span>
              </div>
            ))}
          </div>
        );
      case 'barcode':
        const barcodeVal = processText(el.placeholder || "") || data.rollNo || data.id || "123456789012";
        return (
          <div style={style}>
            <div style={{ transform: `scale(${Math.min(1, el.width / 150)})`, transformOrigin: 'center' }}>
              <Barcode 
                format={el.barcodeType as any || 'CODE128'} 
                value={barcodeVal} 
                height={el.height - 20} 
                width={1.5} 
                fontSize={10} 
                displayValue={true} 
              />
            </div>
          </div>
        );
      case 'qr':
        let qrVal = processText(el.placeholder || "");
        
        // FIX: If placeholder resolution returns empty, use fallbacks to avoid "NA"
        if (!qrVal || qrVal.trim() === "") {
          qrVal = data.roll_url || data.rollNo || data.id || "NA";
        }

        return (
          <div 
            style={{ 
              ...style, 
              cursor: isValidURL(qrVal) ? 'pointer' : 'default' 
            }}
            onClick={() => {
              if (isValidURL(qrVal)) {
                window.open(qrVal, "_blank");
              }
            }}
            className="group/qr"
          >
            <QRCodeSVG 
              value={qrVal} 
              size={Math.min(el.width, el.height) - 5} 
              className="group-hover/qr:opacity-80 transition-opacity"
            />
          </div>
        );
      case 'rectangle':
      case 'circle':
        return <div style={style} />;
      case 'line':
        return <div style={style} />;
      case 'image':
        return el.content ? (
          <img src={el.content} style={{ ...style, objectFit: 'contain', border: 'none' }} alt="Element" />
        ) : null;
      default:
        return null;
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page {
              size: ${paperWidth}mm ${paperHeight}mm;
              margin: 0;
            }
            body { margin: 0; }
            .print-page-break {
              page-break-after: always;
            }
          }
        `
      }} />
      
      <div 
        className="bg-white relative shadow-sm border border-slate-200 print:border-none print:shadow-none overflow-hidden print-page-break"
        style={{ 
          width: `${paperWidth * MM_TO_PX}px`, 
          height: `${paperHeight * MM_TO_PX}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          margin: scale !== 1 ? '0 auto' : '0'
        }}
      >
        {/* Background Layer */}
        {template.background?.image && (
          <div className="absolute inset-0 pointer-events-none z-0" style={{ opacity: template.background.opacity || 1 }}>
            <img src={template.background.image} className="w-full h-full object-contain" alt="Background" />
          </div>
        )}

        {elements.map((el: any) => (
          <React.Fragment key={el.id}>
            {renderElement(el)}
          </React.Fragment>
        ))}
      </div>
    </>
  );
}
