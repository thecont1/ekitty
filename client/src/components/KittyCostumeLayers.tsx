import type { ReactNode } from "react";
import type { CostumeId } from "@/lib/portfolioCostumes";

export default function KittyCostumeLayers({ layers, darkMode = false }: { layers: readonly CostumeId[]; darkMode?: boolean }) {
  const paper = darkMode ? "#243437" : "#fcfaf4";
  const ink = darkMode ? "#d8e1df" : "#353b38";
  const brass = darkMode ? "#d79b79" : "#9b5939";
  const art: Record<CostumeId, ReactNode> = {
    wounded: <g transform="rotate(-14 90 43)"><rect x="70" y="36" width="38" height="14" rx="4" fill={paper} /><path d="M82 37v12m14-12v12M75 42h2m25 0h2" /></g>,
    monopoly: <><path d="M70 31l-3-22 37-2 4 23M60 33q26 5 56-3" fill={ink} /><path d="M69 25l37-2" stroke={brass} /><path d="M60 125l12-7 9 29-15 7-8-7m71-29l9 15-7 21-17-8 6-25" fill="#274e3e" fillOpacity=".7" /><path d="M67 124l8 18m48-18l-3 18" /></>,
    firefighter: <><path d="M61 124l14-6 8 35-21 3-5-13m65-24l11 6 5 21-22 7" fill="#ba5246" fillOpacity=".8" /><path d="M61 143l18-3m39 0l18 3" stroke={paper} strokeWidth="4" /><path d="M65 27q18-15 38-5l6 9-45 5z" fill="#ba5246" /></>,
    parachute: <><path d="M53 29q36-36 75 0-36-13-75 0z" fill={paper} /><path d="M53 29l17 44m58-44l-17 43M76 22q0-9 13-17 17 9 17 17" /></>,
    rocket: <><path d="M126 84l9-18 8 18-1 39h-16z" fill={paper} /><path d="M126 112l-7 13h7m16-13l8 13h-8M129 127l5 13 6-13" /><circle cx="135" cy="87" r="4" /></>,
    strutting: <><path d="M57 51l24-3 1 12q-12 10-22 0zm39-6l24-1-1 12q-13 8-22-1z" fill={ink} /><path d="M81 52l16-2" /><path d="M64 86q26 28 57-7" stroke={brass} strokeWidth="5" strokeDasharray="3 4" /><path d="M62 52l12-1m27-3l11-1" stroke={paper} strokeWidth="1.5" /></>,
    patchwork: <><path d="M61 124l13-5 7 31-20 4z" fill="#829c8c" fillOpacity=".7" /><path d="M123 119l11 7 3 23-20 5z" fill="#b77b71" fillOpacity=".7" /><path d="M63 133l12-3m-8-7l4 22m49-8l15-3m-7-9l3 20" strokeDasharray="2 3" /></>,
    fledgling: <path d="M62 38l3-17 10 5 7-13 11 10 12-8 6 18q-25 10-49 5z" fill={paper} />,
    veteran: <><ellipse cx="71" cy="55" rx="13" ry="10" fill={paper} fillOpacity=".35" /><ellipse cx="107" cy="50" rx="13" ry="10" fill={paper} fillOpacity=".35" /><path d="M84 53l10-2m-36 4l-7-1m69-5l7-3m-67 18l-1 18" /></>,
    tightrope: <><path d="M37 141q51 8 114-4" strokeWidth="3" /><path d="M55 179q38-4 83-1" strokeDasharray="4 3" /><circle cx="37" cy="141" r="3" fill={ink} /><circle cx="151" cy="137" r="3" fill={ink} /></>,
    fog: <><path d="M63 36q25-12 49-7l7 20q-33-6-54 9z" fill={paper} fillOpacity=".35" strokeDasharray="1 5" /><path d="M65 41l48-7M65 49l51-7" strokeDasharray="1 6" /></>,
    basket: <><path d="M65 160q33 6 66-2l-5 23H71z" fill={paper} fillOpacity=".8" /><path d="M67 168l62-2m-60 9l58-2m-49-12l2 19m13-18v19m15-20l-2 19m16-20l-3 20" strokeWidth="1.5" /></>,
  };
  return (
    <g className="kitty-costumes" aria-hidden="true" pointerEvents="none" fill="none" stroke={ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      {layers.map((id) => <g data-costume={id} key={id}>{art[id]}</g>)}
    </g>
  );
}
