export interface ChangelogEntry {
  version: string;
  date: string; // ISO date
  title: string;
  summary: string;
  changes: { type: "new" | "improved" | "fixed"; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.3.0",
    date: "2026-10-20",
    title: "Recipes, brand kit and share links",
    summary: "Five launch recipes done brilliantly, a brand kit that applies itself, and public share links for every export.",
    changes: [
      { type: "new", text: "Recipes gallery with Talking-head, Vlog, Product demo, Montage and Explainer." },
      { type: "new", text: "Save any finished project as your own recipe and remix it later." },
      { type: "new", text: "Brand kit: logo, fonts, colours, handle, intro/outro and a default caption style." },
      { type: "new", text: "Share links with a public player and download button." },
      { type: "improved", text: "Footage health report now counts silences, filler words, shaky and dark sections." },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-10-06",
    title: "The plan you approve",
    summary: "Every project now starts with a plain-words plan. Toggle lines, change styles, then approve.",
    changes: [
      { type: "new", text: "Plan step before building: hook, cuts, captions, music, graphics and estimated length." },
      { type: "new", text: "Twelve caption styles including Bold Pop, Hormozi, Karaoke and Handwritten." },
      { type: "improved", text: "Chat replies now list exactly what changed and create a checkpoint." },
      { type: "fixed", text: "Captions no longer overlap the TikTok action bar in 9:16 exports." },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-09-22",
    title: "First light",
    summary: "Upload footage, describe the video, get a draft.",
    changes: [
      { type: "new", text: "Home with the prompt box, drag-and-drop uploads, aspect, length and style chips." },
      { type: "new", text: "Resumable parallel uploads with a background tray." },
      { type: "new", text: "Instant preview of the current edit in the browser, no server render." },
      { type: "new", text: "Projects and Asset library." },
    ],
  },
];
