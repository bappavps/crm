
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
  { id: 'roboto', value: 'Roboto, sans-serif' },
  { id: 'playfair', value: 'Playfair Display, serif' },
  { id: 'montserrat', value: 'Montserrat, sans-serif' },
  { id: 'oswald', value: 'Oswald, sans-serif' },
  { id: 'lato', value: 'Lato, sans-serif' },
  { id: 'poppins', value: 'Poppins, sans-serif' },
  { id: 'merriweather', value: 'Merriweather, serif' },
  { id: 'mono', value: 'ui-monospace, SFMono-Regular, monospace' },
  { id: 'narrow', value: 'Arial Narrow, sans-serif' },
];

export function TemplateRenderer({ elements, data, paperWidth, paperHeight, scale = 1 }: TemplateRendererProps) {
  const replacePlaceholders = (text: string) => {
    if (!text) return "";
    let result = text;
    Object.entries(data).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value || ""));
    });
    return result;
  };

  const getFontFamilyValue = (id: string) => FONT_FAMILIES.find(f => f.id === id)?.value || 'sans-serif';

  const renderElement = (el: TemplateElement) => {
    const style = {
      ...el.style,
      left: `${el.x}px`,
      top: `${el.y}px`,
      width: `${el.width}px`,
      height: `${el.height}px`,
      transform: `rotate(${el.rotate || 0}deg)`,
      fontSize: `${el.style.fontSize}px`,
      fontFamily: getFontFamilyValue(el.style.fontFamily),
      position: 'absolute' as const,
      display: 'flex',
      alignItems: 'center',
      justifyContent: el.style.textAlign === 'center' ? 'center' : el.style.textAlign === 'right' ? 'flex-end' : 'flex-start',
      overflow: 'hidden'
    };

    switch (el.type) {
      case 'text':
      case 'title':
        return <div style={style}>{replacePlaceholders(el.content || "")}</div>;
      case 'field':
        return <div style={style}>{replacePlaceholders(el.placeholder || "")}</div>;
      case 'barcode':
        const barcodeVal = replacePlaceholders(el.placeholder || "");
        return (
          <div style={{ ...style, overflow: 'hidden' }}>
            <div style={{ transform: `scale(${Math.min(1, el.width / 150)})`, transformOrigin: 'left center' }}>
              <Barcode 
                value={barcodeVal || "SAMPLE"} 
                height={el.height - 20} 
                width={1.5} 
                fontSize={10} 
                displayValue={true} 
              />
            </div>
          </div>
        );
      case 'qr':
        const qrVal = replacePlaceholders(el.placeholder || "");
        return (
          <div style={style}>
            <QRCodeSVG value={qrVal || "NA"} size={el.width} />
          </div>
        );
      case 'line':
        return <div style={{ ...style, height: '2px', backgroundColor: 'black' }} />;
      case 'rectangle':
        return <div style={{ ...style, border: '2px solid black' }} />;
      case 'circle':
        return <div style={{ ...style, border: '2px solid black', borderRadius: '100%' }} />;
      case 'image':
        return el.content ? (
          <img src={el.content} style={style} className="object-contain" alt="Rendered" />
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div 
      className="bg-white relative shadow-sm border border-slate-200 print:border-none print:shadow-none"
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
  );
}
