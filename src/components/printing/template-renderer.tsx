
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
  style: any;
}

interface TemplateRendererProps {
  elements: TemplateElement[];
  data: Record<string, any>;
  paperWidth: number;
  paperHeight: number;
  scale?: number;
}

const MM_TO_PX = 3.78;

const FONT_FAMILIES = [
  { id: 'inter', value: 'var(--font-inter), sans-serif' },
  { id: 'roboto', value: "'Roboto', sans-serif" },
  { id: 'playfair', value: "'Playfair Display', serif" },
  { id: 'montserrat', value: "'Montserrat', sans-serif" },
  { id: 'oswald', value: "'Oswald', sans-serif" },
  { id: 'mono', value: "ui-monospace, SFMono-Regular, monospace" },
  { id: 'cursive', value: "cursive" },
];

export function TemplateRenderer({ elements, data, paperWidth, paperHeight, scale = 1 }: TemplateRendererProps) {
  
  const getVal = (key: string) => {
    if (!key) return "";
    const cleanKey = key.replace(/[{}]/g, '');
    return String(data[cleanKey] || "");
  };

  const getFontFamilyValue = (id: string) => FONT_FAMILIES.find(f => f.id === id)?.value || 'sans-serif';

  const renderElement = (el: TemplateElement) => {
    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${el.x}px`,
      top: `${el.y}px`,
      width: `${el.width}px`,
      height: `${el.height}px`,
      transform: `rotate(${el.rotate || 0}deg)`,
      opacity: el.style.opacity || 1,
      backgroundColor: el.style.backgroundColor || 'transparent',
      border: el.style.borderWidth ? `${el.style.borderWidth}px ${el.style.lineStyle || 'solid'} ${el.style.borderColor || '#000'}` : 'none',
      borderRadius: el.type === 'circle' ? '100%' : `${el.style.borderRadius || 0}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: el.style.textAlign === 'center' ? 'center' : el.style.textAlign === 'right' ? 'flex-end' : 'flex-start',
      overflow: 'hidden'
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
            <span style={textStyle}>{el.content}</span>
          </div>
        );
      case 'field':
        return (
          <div style={style}>
            <span style={textStyle}>{getVal(el.placeholder || "")}</span>
          </div>
        );
      case 'table':
        const tableData = data[el.placeholder || ""] || [];
        return (
          <div style={{ ...style, flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start' }}>
            {/* Header */}
            <div style={{ display: 'flex', borderBottom: '2px solid black', padding: '4px', backgroundColor: '#f0f0f0' }}>
              <span style={{ flex: 2, fontSize: '10px', fontWeight: 'bold' }}>ROLL ID</span>
              <span style={{ flex: 1, fontSize: '10px', fontWeight: 'bold' }}>W (MM)</span>
              <span style={{ flex: 1, fontSize: '10px', fontWeight: 'bold' }}>L (MTR)</span>
              <span style={{ flex: 1, fontSize: '10px', fontWeight: 'bold' }}>DEST</span>
            </div>
            {/* Rows */}
            {tableData.map((row: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', borderBottom: '1px solid #ccc', padding: '4px' }}>
                <span style={{ flex: 2, fontSize: '10px', fontFamily: 'monospace' }}>{row.roll_code || row.rollNo}</span>
                <span style={{ flex: 1, fontSize: '10px' }}>{row.width || row.widthMm}</span>
                <span style={{ flex: 1, fontSize: '10px' }}>{row.length || row.lengthMeters}</span>
                <span style={{ flex: 1, fontSize: '10px', fontWeight: 'bold' }}>{row.destination || (row.jobNo ? 'JOB' : 'STOCK')}</span>
              </div>
            ))}
          </div>
        );
      case 'barcode':
        return (
          <div style={style}>
            <div style={{ transform: `scale(${Math.min(1, el.width / 150)})`, transformOrigin: 'center' }}>
              <Barcode value={getVal(el.placeholder || "") || "SAMPLE"} height={el.height - 20} width={1.5} fontSize={10} displayValue={true} />
            </div>
          </div>
        );
      case 'qr':
        return (
          <div style={style}>
            <QRCodeSVG value={getVal(el.placeholder || "") || "NA"} size={Math.min(el.width, el.height) - 5} />
          </div>
        );
      case 'rectangle':
      case 'circle':
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
            #print-area-rendered {
              width: ${paperWidth}mm !important;
              height: ${paperHeight}mm !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
            }
          }
        `
      }} />
      
      <div 
        id="print-area-rendered"
        className="bg-white relative shadow-sm border border-slate-200 print:border-none print:shadow-none overflow-hidden"
        style={{ 
          width: `${paperWidth * MM_TO_PX}px`, 
          height: `${paperHeight * MM_TO_PX}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top center'
        }}
      >
        {elements.map(el => (
          <React.Fragment key={el.id}>
            {renderElement(el)}
          </React.Fragment>
        ))}
      </div>
    </>
  );
}
