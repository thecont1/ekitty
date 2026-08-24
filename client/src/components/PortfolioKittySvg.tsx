/**
 * Inkfield Menagerie: this component faithfully renders the supplied ekitty1.svg
 * line illustration while accepting data-driven stroke and body treatments.
 */

import type { CSSProperties } from "react";

type PortfolioKittySvgProps = {
  stroke: string;
  fill: string;
  fillOpacity: number;
  strokeWidth: number;
  className?: string;
};

export default function PortfolioKittySvg({ stroke, fill, fillOpacity, strokeWidth, className }: PortfolioKittySvgProps) {
  const variables = {
    "--cat-stroke-color": stroke,
    "--cat-stroke-width": strokeWidth,
    "--cat-fill-color": fill,
  } as CSSProperties;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" style={variables} className={className} aria-hidden="true">
      <defs><style>{`.cat-path { fill: none; stroke: var(--cat-stroke-color, #000); stroke-width: var(--cat-stroke-width, 1.5); stroke-linecap: round; stroke-linejoin: round; } .cat-fill { fill: var(--cat-fill-color, #000); }`}</style></defs>
      {fillOpacity > 0 && <path d="M64 50 C72 36 92 31 110 39 C126 47 132 64 127 82 C122 98 130 116 133 137 C136 158 120 174 102 169 C94 178 78 176 73 166 C61 165 55 154 58 137 C61 119 55 106 53 89 C49 71 53 58 64 50 Z" fill={fill} opacity={fillOpacity} />}
      <path className="cat-path" d="M121.48,93.28a54.4,54.4,0,0,0,12-33.48A36.64,36.64,0,0,0,120,32.96S118.92,20,114.8,18.24s-16.4,8-16.4,8-20,.84-27.72,5.96c0,0-17.76-4.24-20-1.16s1.04,16.56,1.04,16.56a36.4,36.4,0,0,0-5.8,20.68c0,13,19.64,31.32,19.64,31.32a84.84,84.84,0,0,0-12.48,41.72c0,17.08,8.32,21.2,8.32,21.2" />
      <path className="cat-path" d="M69,118.44,80.6,164s-4.96,10.08,10.28,10.08,12-12.64,7.68-14.36l-7.52-28.88" />
      {/* Back leg */}
      <path className="cat-path" d="M116.52,152.28c-8,3.24-10.96,15.72,3.24,15.72s19.68-16,19.68-27a116.28,116.28,0,0,0-4.96-27,17,17,0,0,0,4.96-7.36c.68-3.6,4.44-40,4.76-41.56a17.08,17.08,0,0,0,1.88-5.96,10.6,10.6,0,0,0-13.96-8" />
      {/* Paw detail */}
      <path className="cat-path" d="M100.92,161.76a76,76,0,0,1,9-1.08" />
      {/* Front paw */}
      <path className="cat-path" d="M80,166.28a26.72,26.72,0,0,1-11.28,1.72c-4.28,0-14-7.08-.6-15.64" />
      <circle className="cat-path" cx="91.72" cy="111.84" r="10.04" />
      <path className="cat-path" d="M95.56,102.48a148.56,148.56,0,0,0,23.52-2.84" />
      <path className="cat-path" d="M65.56,99.64a118.84,118.84,0,0,0,22.44,2.88" />
      <path className="cat-path" d="M99.04,50.52a11.64,11.64,0,0,1,15.04-2.88" />
      <path className="cat-path" d="M61.48,57.44a11.64,11.64,0,0,1,15.04-2.84" />
      <path className="cat-path" d="M103.68,64.28C97.88,73.28,92,68,89.68,64c-.36,5.36-3.76,12.44-11.64,5.36" />
      <path className="cat-path" d="M115.08,56a15.16,15.16,0,0,0,9.24-2.28" />
      <path className="cat-path" d="M116,61.08A18.64,18.64,0,0,0,126.04,60" />
      <path className="cat-path" d="M115.08,65.76a11.44,11.44,0,0,0,9.8,0" />
      <path className="cat-path" d="M64.68,66.96a15.28,15.28,0,0,1-9.48,.68" />
      <path className="cat-path" d="M65.32,72.24a18.4,18.4,0,0,1-9.84,1.88" />
      <path className="cat-path" d="M67.72,76.4a11.48,11.48,0,0,1-9.32,3.04" />
      <circle className="cat-fill" cx="88.84" cy="60.64" r="3" />
      <path className="cat-path" d="M51.72,47.64C55.2,42,60,37.56,70.68,32.24" />
      <path className="cat-path" d="M98.4,26.28A33.4,33.4,0,0,1,120,32.96" />
    </svg>
  );
}
