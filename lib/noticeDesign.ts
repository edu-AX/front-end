// 가정통신문 글 → 레퍼런스 디자인(DesignProfile)을 입힌 용지 HTML.
// 미리보기·인쇄/PDF·서식 포함 복사가 모두 같은 HTML 을 쓴다. 스타일은 전부 인라인이라 새 창·클립보드로 옮겨도 모양이 같다.
// DesignProfile 은 백엔드(lib/notice/design.ts)가 레퍼런스(PDF·한글)에서 읽어 온 값이다.

export interface FontSpec { family: string; bold: boolean; original: string }
export interface DesignProfile {
  source: "pdf" | "hwp" | "default";
  pageMm: [number, number];
  marginMm: { top: number; right: number; bottom: number; left: number };
  pageBorder: boolean;
  fonts: { body: FontSpec; title: FontSpec; subject: FontSpec; heading: FontSpec; meta: FontSpec; closing: FontSpec };
  sizes: { body: number; title: number; subject: number; heading: number; meta: number; slogan: number; note: number; closingDate: number; closingSchool: number };
  lineHeight: number;
  header: { boxed: boolean; emblem: boolean; grayBar: string | null; subjectBoxed: boolean; titleAlign: "center" | "left" };
  table: { headerFill: string | null; borderPt: number; fontPt: number };
  closing: { dateBold: boolean; schoolBold: boolean; align: "center" | "right" };
  images: { logo?: string; emblem?: string };
  summary: string[];
}

/** 레퍼런스 없이 쓰는 기본 디자인 (백엔드 defaultDesign 과 같은 값) */
export const DEFAULT_DESIGN: DesignProfile = (() => {
  const family = `"함초롬돋움","HCR Dotum","Malgun Gothic","맑은 고딕","Noto Sans KR",sans-serif`;
  const sans = { family, bold: false, original: "HCRDotum" };
  return {
    source: "default", pageMm: [210, 297], marginMm: { top: 15, right: 20, bottom: 15, left: 20 }, pageBorder: false,
    fonts: { body: sans, title: { ...sans, bold: true }, subject: sans, heading: { ...sans, bold: true }, meta: sans, closing: { ...sans, bold: true } },
    sizes: { body: 11, title: 28, subject: 12, heading: 11, meta: 9, slogan: 10, note: 9, closingDate: 13, closingSchool: 20 },
    lineHeight: 1.6,
    header: { boxed: true, emblem: false, grayBar: "#b2b2b2", subjectBoxed: false, titleAlign: "center" },
    table: { headerFill: "#d9d9d9", borderPt: 0.7, fontPt: 10 },
    closing: { dateBold: true, schoolBold: true, align: "center" },
    images: {}, summary: ["레퍼런스 없이 기본 디자인으로 그려요."],
  };
})();

// ---------------------------------------------------------------- 글 → 블록
export type Block =
  | { t: "slogan" | "docNo" | "title" | "contact" | "subject"; text: string }
  | { t: "para" | "heading" | "item" | "bullet" | "note" | "blockTitle" | "date" | "school" | "formTitle" | "formLine"; text: string }
  | { t: "table"; rows: string[][] }
  | { t: "gap" }
  | { t: "cut" };

export function parseNotice(text: string): Block[] {
  const out: Block[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let afterCut = false, formTitleDone = false, seenSubject = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], l = raw.trim();
    if (!l) { out.push({ t: "gap" }); continue; }
    if (/^-\s*(-\s*){6,}.*절\s*취\s*선/.test(l) || /절\s*취\s*선/.test(l) && /^[-\s]/.test(l)) { out.push({ t: "cut" }); afterCut = true; formTitleDone = false; continue; }
    if (afterCut) {
      if (!formTitleDone) { out.push({ t: "formTitle", text: l }); formTitleDone = true; } else out.push({ t: "formLine", text: raw.replace(/^\s{2}/, "") });
      continue;
    }
    const m = /^(가\s*정\s*통\s*신\s*문)\s*(.*)$/.exec(l);
    if (m) { out.push({ t: "title", text: m[1] }); if (m[2]) out.push({ t: "contact", text: m[2] }); continue; }
    if (/^\(.*호\)\s*$/.test(l) && !seenSubject) { out.push({ t: "docNo", text: l }); continue; }
    if (/^담당자?\s*[:：]/.test(l) && !seenSubject) { out.push({ t: "contact", text: l }); continue; }
    if (/^제목\s*[:：]/.test(l)) { out.push({ t: "subject", text: l }); seenSubject = true; continue; }
    if (!seenSubject && !out.some((b) => b.t === "title") && !out.some((b) => b.t === "slogan")) { out.push({ t: "slogan", text: l }); continue; }
    if (/^\d{1,2}\.\s*\S/.test(l)) { out.push({ t: "heading", text: l }); continue; }
    if (/^[○◦●]\s*/.test(l)) { out.push({ t: "blockTitle", text: l.replace(/^[○◦●]\s*/, "") }); continue; }
    if (l.includes(" | ")) {
      const rows = [l.split("|").map((c) => c.trim())];
      while (i + 1 < lines.length && lines[i + 1].includes(" | ")) rows.push(lines[++i].split("|").map((c) => c.trim()));
      out.push({ t: "table", rows }); continue;
    }
    if (/^[*※]/.test(l)) { out.push({ t: "note", text: l }); continue; }
    if (/^[가-하]\.\s/.test(l)) { out.push({ t: "item", text: l }); continue; }
    if (/^[-–·]\s+/.test(l)) { out.push({ t: "bullet", text: l.replace(/^[-–·]\s+/, "") }); continue; }
    if (/^\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일$/.test(l)) { out.push({ t: "date", text: l }); continue; }
    if (/^(?:[가-힣]\s){3,}[가-힣]$/.test(l) || /^[가-힣]{2,}(?:초|중|고등)학교장$/.test(l)) { out.push({ t: "school", text: l }); continue; }
    out.push({ t: "para", text: raw.startsWith("  ") ? l : l });
  }
  return out;
}

// ---------------------------------------------------------------- 블록 → HTML
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const safeColor = (c: string | null | undefined, fb: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : fb);
// style="…" 안에 들어가므로 큰따옴표는 작은따옴표로 바꾼다
const safeFamily = (f: string) => f.replace(/"/g, "'").replace(/[^\w\s,'가-힣-]/g, "");
const safeImg = (u?: string) => (u && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : null);
const BLANK_RE = /(【\s*[^【】]*】)/g;

export function noticeToHtml(text: string, d: DesignProfile, opts: { highlightBlanks?: boolean } = {}): string {
  const blocks = parseNotice(text);
  const ff = (f: FontSpec) => `font-family:${safeFamily(f.family)};font-weight:${f.bold ? 700 : 400};`;
  const t = (s: string) => {
    const e = esc(s);
    return opts.highlightBlanks ? e.replace(BLANK_RE, '<span style="background:#fff3b0;border-radius:3px;padding:0 1px">$1</span>') : e;
  };
  const px = (pt: number) => `${pt}pt`;
  const bw = Math.max(0.5, d.table.borderPt);
  const lineCol = "#222";
  const get = (type: string) => blocks.find((b) => b.t === type) as { text: string } | undefined;
  const title = get("title"), contact = get("contact"), subject = get("subject"), slogan = get("slogan"), docNo = get("docNo");

  const emblemSrc = safeImg(d.images.emblem), logoSrc = safeImg(d.images.logo);
  const emblemCell = d.header.emblem
    ? `<td rowspan="2" style="width:24mm;border-right:${bw}pt solid ${lineCol};text-align:center;vertical-align:middle;padding:2mm">${emblemSrc ? `<img src="${emblemSrc}" style="width:20mm;height:auto" alt="학교 마크">` : `<div style="width:18mm;height:18mm;margin:auto;border:1px dashed #aaa;color:#999;font:8pt sans-serif;display:flex;align-items:center;justify-content:center">학교 마크</div>`}</td>`
    : "";
  const titleRow = `<td style="padding:2mm 3mm 0;vertical-align:bottom">
    <div style="display:flex;align-items:flex-end;justify-content:${d.header.titleAlign === "center" ? "space-between" : "flex-start"};gap:4mm">
      <div style="${ff(d.fonts.title)}font-size:${px(d.sizes.title)};flex:1;text-align:${d.header.titleAlign};letter-spacing:.08em;line-height:1.2">${esc(title?.text ?? "가정통신문")}</div>
      ${contact ? `<div style="${ff(d.fonts.meta)}font-size:${px(d.sizes.meta)};white-space:nowrap;padding-bottom:1mm">${t(contact.text)}</div>` : ""}
    </div>
    ${d.header.grayBar ? `<div style="height:2.2mm;background:${safeColor(d.header.grayBar, "#b2b2b2")};margin-top:1.5mm"></div>` : ""}</td>`;
  const subjectRow = `<td style="${ff(d.fonts.subject)}font-size:${px(d.sizes.subject)};padding:1.8mm 3mm;${d.header.subjectBoxed ? `border-top:${bw}pt solid ${lineCol};` : ""}">${subject ? t(subject.text) : ""}</td>`;
  const topRow = slogan || logoSrc || docNo
    ? `<tr><td colspan="${d.header.emblem ? 2 : 1}" style="padding:1.5mm 3mm;border-bottom:${bw}pt solid ${lineCol};${ff(d.fonts.body)}font-size:${px(d.sizes.slogan)}">
        <div style="display:flex;align-items:center;gap:3mm">${logoSrc ? `<img src="${logoSrc}" style="height:7mm;width:auto" alt="로고">` : ""}<span>${slogan ? t(slogan.text) : ""}</span><span style="margin-left:auto">${docNo ? t(docNo.text) : ""}</span></div></td></tr>`
    : "";
  const header = d.header.boxed
    ? `<table style="width:100%;border-collapse:collapse;border:${bw}pt solid ${lineCol};margin-bottom:5mm">${topRow}<tr>${emblemCell}${titleRow}</tr><tr>${subjectRow}</tr></table>`
    : `<div style="margin-bottom:5mm">${slogan ? `<div style="${ff(d.fonts.body)}font-size:${px(d.sizes.slogan)}">${t(slogan.text)}</div>` : ""}<div style="${ff(d.fonts.title)}font-size:${px(d.sizes.title)};text-align:center;letter-spacing:.08em;border-bottom:${bw}pt solid ${lineCol};padding:3mm 0">${esc(title?.text ?? "가정통신문")}</div>${contact ? `<div style="text-align:right;${ff(d.fonts.meta)}font-size:${px(d.sizes.meta)}">${t(contact.text)}</div>` : ""}<div style="${ff(d.fonts.subject)}font-size:${px(d.sizes.subject)};margin-top:3mm">${subject ? t(subject.text) : ""}</div></div>`;

  const body: string[] = [];
  const bodyStyle = `${ff(d.fonts.body)}font-size:${px(d.sizes.body)};line-height:${d.lineHeight};`;
  for (const b of blocks) {
    switch (b.t) {
      case "slogan": case "docNo": case "title": case "contact": case "subject": break; // 머리말에 이미 그림
      case "gap": body.push(`<div style="height:${px(d.sizes.body * 0.7)}"></div>`); break;
      case "para": body.push(`<p style="margin:0;${bodyStyle}text-align:justify;text-indent:1em">${t(b.text)}</p>`); break;
      case "heading": body.push(`<p style="margin:${px(d.sizes.body * 0.9)} 0 ${px(d.sizes.body * 0.2)};${ff(d.fonts.heading)}font-size:${px(d.sizes.heading)};line-height:${d.lineHeight}">${t(b.text)}</p>`); break;
      case "item": body.push(`<p style="margin:0;padding-left:1.2em;${bodyStyle}">${t(b.text)}</p>`); break;
      case "bullet": body.push(`<p style="margin:0;padding-left:1.4em;text-indent:-.8em;${bodyStyle}">- ${t(b.text)}</p>`); break;
      case "note": body.push(`<p style="margin:1mm 0 0;text-align:right;${ff(d.fonts.body)}font-size:${px(d.sizes.note)}">${t(b.text)}</p>`); break;
      case "blockTitle": body.push(`<p style="margin:${px(d.sizes.body * 0.8)} 0 0;${ff(d.fonts.heading)}font-size:${px(d.sizes.heading)}">○ ${t(b.text)}</p>`); break;
      case "table": {
        const cell = (c: string, head: boolean) => `<${head ? "th" : "td"} style="border:${bw}pt solid ${lineCol};padding:1.2mm 2mm;text-align:center;font-size:${px(d.table.fontPt)};${head ? `${d.table.headerFill ? `background:${safeColor(d.table.headerFill, "#d9d9d9")};` : ""}font-weight:600;` : ""}">${t(c)}</${head ? "th" : "td"}>`;
        body.push(`<table style="width:94%;margin:2mm auto;border-collapse:collapse;${ff(d.fonts.body)}"><tr>${b.rows[0].map((c) => cell(c, true)).join("")}</tr>${b.rows.slice(1).map((r) => `<tr>${r.map((c) => cell(c, false)).join("")}</tr>`).join("")}</table>`);
        break;
      }
      case "date": body.push(`<p style="white-space:pre;margin:${px(d.sizes.body * 2.4)} 0 ${px(d.sizes.body * 0.6)};text-align:${d.closing.align};${ff({ ...d.fonts.closing, bold: d.closing.dateBold })}font-size:${px(d.sizes.closingDate)}">${t(b.text.replace(/\s+/g, " ").replace(/(\d)\s*년\s*/, "$1년  ").replace(/월\s*/, "월  "))}</p>`); break;
      case "school": body.push(`<p style="margin:${px(d.sizes.body)} 0 0;text-align:${d.closing.align};${ff({ ...d.fonts.closing, bold: d.closing.schoolBold })}font-size:${px(d.sizes.closingSchool)};letter-spacing:.35em">${t(b.text)}</p>`); break;
      case "cut": body.push(`<div style="margin:${px(d.sizes.body * 1.6)} 0;border-top:1px dashed #555;text-align:center;font-size:9pt;color:#555;position:relative"><span style="position:relative;top:-.7em;background:#fff;padding:0 3mm">✂ 절 취 선</span></div>`); break;
      case "formTitle": body.push(`<p style="margin:0 0 ${px(d.sizes.body * 0.8)};text-align:center;${ff(d.fonts.heading)}font-size:${px(d.sizes.heading + 3)}">${t(b.text)}</p>`); break;
      case "formLine": body.push(`<p style="margin:0;padding-left:1.2em;${bodyStyle}">${t(b.text)}</p>`); break;
    }
  }

  const [w, h] = d.pageMm, m = d.marginMm;
  const border = d.pageBorder ? `border:${bw * 1.5}pt solid ${lineCol};` : "";
  return `<div data-notice-page style="box-sizing:border-box;width:${w}mm;min-height:${h}mm;padding:${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;background:#fff;color:#111;${border}">${header}${body.join("")}</div>`;
}

/** 새 창에 넣을 인쇄용 문서 */
export function noticePrintDocument(text: string, d: DesignProfile, title: string): string {
  const [w, h] = d.pageMm;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:${w}mm ${h}mm;margin:0}html,body{margin:0;background:#fff}[data-notice-page]{margin:0 auto}</style></head><body>${noticeToHtml(text, d)}</body></html>`;
}
