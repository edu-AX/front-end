// 가정통신문 글 + 레퍼런스 디자인 → 한글(.hwpx) 파일.
// hwpx 는 zip 안에 XML 문서가 든 한글 문서 형식이다. 한컴오피스가 만든 실제 파일의 구조(header.xml 의 글꼴·글자 모양·문단 모양·테두리,
// section0.xml 의 문단·표·그림)를 그대로 따라 쓰고, 글꼴·크기·머리말 표·로고·엠블럼·표 머리 색은 레퍼런스에서 읽은 디자인을 넣는다.
// 외부 패키지 없이 브라우저에서 바로 만든다 (zip 은 압축 없이 묶는다).
import { parseNotice, type Block, type DesignProfile, type FontSpec } from "./noticeDesign";

const HU_PER_MM = 7200 / 25.4;
const hu = (mm: number) => Math.round(mm * HU_PER_MM);
const A4_W = 59528, A4_H = 84188; // 한글 A4 (1/7200 인치)

const esc = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const faceOf = (f: FontSpec) => /"([^"]+)"/.exec(f.family)?.[1] ?? /'([^']+)'/.exec(f.family)?.[1] ?? "함초롬돋움";
const hex = (c: string | null | undefined, fb: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c.toUpperCase() : fb);

// ---------------------------------------------------------------- 그림
interface Img { id: string; file: string; mime: string; bytes: Uint8Array; w: number; h: number }
function decodeImage(dataUrl: string | undefined, n: number): Img | null {
  const m = dataUrl && /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const dv = new DataView(bytes.buffer);
  let w = 0, h = 0;
  if (m[1] === "png" && bytes.length > 24) { w = dv.getUint32(16); h = dv.getUint32(20); }
  else {
    for (let i = 2; i + 9 < bytes.length; ) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const mk = bytes[i + 1];
      if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) { h = dv.getUint16(i + 5); w = dv.getUint16(i + 7); break; }
      i += 2 + dv.getUint16(i + 2);
    }
  }
  if (!w || !h) return null;
  return { id: `image${n}`, file: `BinData/image${n}.${m[1] === "png" ? "png" : "jpg"}`, mime: m[1] === "png" ? "image/png" : "image/jpeg", bytes, w, h };
}

// ---------------------------------------------------------------- zip (압축 없이 묶기)
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (n: number) => [n & 255, (n >> 8) & 255], u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const local = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...name]);
    parts.push(local, f.data);
    central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
    offset += local.length + size;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}

// ---------------------------------------------------------------- header.xml 등록부
class Registry {
  fonts: string[] = [];
  chars: string[] = []; charKeys = new Map<string, number>();
  paras: string[] = []; paraKeys = new Map<string, number>();
  fills: string[] = []; fillKeys = new Map<string, number>();

  font(face: string) { let i = this.fonts.indexOf(face); if (i < 0) { this.fonts.push(face); i = this.fonts.length - 1; } return i; }

  /** 글자 모양: 글꼴·크기(pt)·굵기·색 */
  char(face: string, pt: number, bold: boolean, color = "#000000"): number {
    const h = Math.max(300, Math.round(pt * 100)), f = this.font(face);
    const key = `${f}|${h}|${bold}|${color}`;
    const hit = this.charKeys.get(key);
    if (hit !== undefined) return hit;
    const same = (v: number) => `hangul="${v}" latin="${v}" hanja="${v}" japanese="${v}" other="${v}" symbol="${v}" user="${v}"`;
    const id = this.chars.length;
    this.chars.push(`<hh:charPr id="${id}" height="${h}" textColor="${color}" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1"><hh:fontRef ${same(f)}/><hh:ratio ${same(100)}/><hh:spacing ${same(0)}/><hh:relSz ${same(100)}/><hh:offset ${same(0)}/>${bold ? "<hh:bold/>" : ""}<hh:underline type="NONE" shape="SOLID" color="#000000"/><hh:strikeout shape="NONE" color="#000000"/><hh:outline type="NONE"/><hh:shadow type="NONE" color="#B2B2B2" offsetX="10" offsetY="10"/></hh:charPr>`);
    this.charKeys.set(key, id);
    return id;
  }

  /** 문단 모양: 정렬·왼쪽 여백·들여쓰기(+첫 줄 들여쓰기 / -내어쓰기)·문단 위/아래 간격(HWPUNIT)·줄 간격(%) */
  para(o: { align: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFY"; left?: number; intent?: number; prev?: number; next?: number; line: number }): number {
    const key = JSON.stringify(o);
    const hit = this.paraKeys.get(key);
    if (hit !== undefined) return hit;
    const id = this.paras.length;
    const margin = `<hh:margin><hc:intent value="${o.intent ?? 0}" unit="HWPUNIT"/><hc:left value="${o.left ?? 0}" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="${o.prev ?? 0}" unit="HWPUNIT"/><hc:next value="${o.next ?? 0}" unit="HWPUNIT"/></hh:margin><hh:lineSpacing type="PERCENT" value="${Math.round(o.line)}" unit="HWPUNIT"/>`;
    this.paras.push(`<hh:paraPr id="${id}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0" textDir="LTR"><hh:align horizontal="${o.align}" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/><hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/><hh:autoSpacing eAsianEng="0" eAsianNum="0"/><hp:switch><hp:case hp:required-namespace="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar">${margin}</hp:case><hp:default>${margin}</hp:default></hp:switch><hh:border borderFillIDRef="1" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/></hh:paraPr>`);
    this.paraKeys.set(key, id);
    return id;
  }

  /** 테두리·배경: 네 변의 선 굵기(mm, 0 이면 없음)와 배경색. id 는 1부터 (1 = 테두리·배경 없음) */
  fill(o: { box?: number; fill?: string | null; top?: number; bottom?: number; left?: number; right?: number } = {}): number {
    const w = { l: o.left ?? o.box ?? 0, r: o.right ?? o.box ?? 0, t: o.top ?? o.box ?? 0, b: o.bottom ?? o.box ?? 0 };
    const fill = o.fill ? hex(o.fill, "") : "";
    const key = JSON.stringify([w, fill]);
    const hit = this.fillKeys.get(key);
    if (hit !== undefined) return hit;
    const id = this.fills.length + 1;
    const side = (tag: string, mm: number) => `<hh:${tag} type="${mm > 0 ? "SOLID" : "NONE"}" width="${mm > 0 ? `${mm} mm` : "0.1 mm"}" color="#000000"/>`;
    this.fills.push(`<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0"><hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>${side("leftBorder", w.l)}${side("rightBorder", w.r)}${side("topBorder", w.t)}${side("bottomBorder", w.b)}<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>${fill ? `<hc:fillBrush><hc:winBrush faceColor="${fill}" hatchColor="#FF000000" alpha="0"/></hc:fillBrush>` : ""}</hh:borderFill>`);
    this.fillKeys.set(key, id);
    return id;
  }

  headerXml(): string {
    if (this.fonts.length === 0) this.font("함초롬돋움");
    const langs = ["HANGUL", "LATIN", "HANJA", "JAPANESE", "OTHER", "SYMBOL", "USER"];
    const fontfaces = langs.map((l) => `<hh:fontface lang="${l}" fontCnt="${this.fonts.length}">${this.fonts.map((f, i) => `<hh:font id="${i}" face="${esc(f)}" type="TTF" isEmbedded="0"><hh:typeInfo familyType="FCAT_GOTHIC" weight="6" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/></hh:font>`).join("")}</hh:fontface>`).join("");
    return `${XML_DECL}<hh:head ${NS} version="1.5" secCnt="1"><hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/><hh:refList><hh:fontfaces itemCnt="7">${fontfaces}</hh:fontfaces><hh:borderFills itemCnt="${this.fills.length}">${this.fills.join("")}</hh:borderFills><hh:charProperties itemCnt="${this.chars.length}">${this.chars.join("")}</hh:charProperties><hh:tabProperties itemCnt="2"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/><hh:tabPr id="1" autoTabLeft="1" autoTabRight="0"/></hh:tabProperties><hh:numberings itemCnt="1"><hh:numbering id="1" start="0">${NUMBER_HEADS}</hh:numbering></hh:numberings><hh:paraProperties itemCnt="${this.paras.length}">${this.paras.join("")}</hh:paraProperties><hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles></hh:refList><hh:compatibleDocument targetProgram="HWP201X"><hh:layoutCompatibility/></hh:compatibleDocument><hh:docOption><hh:linkinfo path="" pageInherit="0" footnoteInherit="0"/></hh:docOption><hh:trackchageConfig flags="56"/></hh:head>`;
  }
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';
const NS = 'xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"';
const NUMBER_HEADS = [
  ["DIGIT", "^1."], ["HANGUL_SYLLABLE", "^2."], ["DIGIT", "^3)"], ["HANGUL_SYLLABLE", "^4)"], ["DIGIT", "(^5)"], ["HANGUL_SYLLABLE", "(^6)"], ["CIRCLED_DIGIT", "^7"],
].map(([f, t], i) => `<hh:paraHead start="1" level="${i + 1}" align="LEFT" useInstWidth="1" autoIndent="1" widthAdjust="0" textOffsetType="PERCENT" textOffset="50" numFormat="${f}" charPrIDRef="4294967295" checkable="${i === 6 ? 1 : 0}">${t}</hh:paraHead>`).join("")
  + [8, 9, 10].map((l) => `<hh:paraHead start="1" level="${l}" align="LEFT" useInstWidth="0" autoIndent="0" widthAdjust="0" textOffsetType="PERCENT" textOffset="0" numFormat="DIGIT" charPrIDRef="0" checkable="0"/>`).join("");

// ---------------------------------------------------------------- 본문 XML 만들기
export function buildHwpx(text: string, d: DesignProfile, k = 1): Uint8Array {
  const blocks = parseNotice(text);
  const reg = new Registry();
  reg.fill(); // 1번: 테두리·배경 없음
  const s = d.sizes;
  const contentW = hu(210 - d.marginMm.left - d.marginMm.right);
  const lineP = d.lineHeight * 100;
  let uid = 1_000_000_000;
  const nextId = () => ++uid;
  const imgs: Img[] = [];

  // 문단 하나
  const para = (t: string, o: { face: FontSpec; pt: number; bold?: boolean; align: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFY"; left?: number; intent?: number; prev?: number; next?: number; line?: number; width?: number; inner?: string }) => {
    const bold = o.bold ?? o.face.bold;
    const c = reg.char(faceOf(o.face), o.pt, bold);
    const p = reg.para({ align: o.align, left: o.left, intent: o.intent, prev: o.prev, next: o.next, line: o.line ?? lineP });
    const h = Math.round(o.pt * 100);
    const body = o.inner ?? (t ? `<hp:t>${esc(t)}</hp:t>` : "");
    return `<hp:p id="0" paraPrIDRef="${p}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${c}">${body}</hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="${h}" textheight="${h}" baseline="${Math.round(h * 0.85)}" spacing="${Math.round(h * ((o.line ?? lineP) / 100 - 1))}" horzpos="0" horzsize="${o.width ?? contentW}" flags="393216"/></hp:linesegarray></hp:p>`;
  };

  // 그림(글자처럼 붙음)
  const pic = (img: Img, widthMm: number) => {
    const cw = hu(widthMm), ch = Math.round((cw * img.h) / img.w), ow = img.w * 75, oh = img.h * 75;
    return `<hp:pic id="${nextId()}" zOrder="${imgs.length}" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${nextId()}" reverse="0"><hp:offset x="0" y="0"/><hp:orgSz width="${ow}" height="${oh}"/><hp:curSz width="${cw}" height="${ch}"/><hp:flip horizontal="0" vertical="0"/><hp:rotationInfo angle="0" centerX="${Math.round(cw / 2)}" centerY="${Math.round(ch / 2)}" rotateimage="1"/><hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="${(cw / ow).toFixed(6)}" e2="0" e3="0" e4="0" e5="${(ch / oh).toFixed(6)}" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo><hc:img binaryItemIDRef="${img.id}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/><hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${ow}" y="0"/><hc:pt2 x="${ow}" y="${oh}"/><hc:pt3 x="0" y="${oh}"/></hp:imgRect><hp:imgClip left="0" right="${ow}" top="0" bottom="${oh}"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:imgDim dimwidth="${ow}" dimheight="${oh}"/><hp:effects/><hp:sz width="${cw}" widthRelTo="ABSOLUTE" height="${ch}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/></hp:pic>`;
  };
  const addImage = (url: string | undefined) => { const i = decodeImage(url, imgs.length + 1); if (i) imgs.push(i); return i; };

  // 표 한 칸
  interface Cell { col: number; row: number; colSpan?: number; rowSpan?: number; w: number; h: number; fill: number; paras: string[]; vAlign?: "CENTER" | "TOP" | "BOTTOM" }
  const table = (rows: number, cols: number, width: number, cells: Cell[], borderFill: number) => {
    const trs: string[] = [];
    for (let r = 0; r < rows; r++) {
      const inRow = cells.filter((c) => c.row === r).sort((a, b) => a.col - b.col);
      trs.push(`<hp:tr>${inRow.map((c) => `<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${c.fill}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="${c.vAlign ?? "CENTER"}" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${c.paras.join("")}</hp:subList><hp:cellAddr colAddr="${c.col}" rowAddr="${c.row}"/><hp:cellSpan colSpan="${c.colSpan ?? 1}" rowSpan="${c.rowSpan ?? 1}"/><hp:cellSz width="${c.w}" height="${c.h}"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>`).join("")}</hp:tr>`);
    }
    const height = cells.filter((c) => c.col === 0).reduce((a, c) => a + c.h, 0);
    return `<hp:tbl id="${nextId()}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="0" rowCnt="${rows}" colCnt="${cols}" cellSpacing="0" borderFillIDRef="${borderFill}" noAdjust="0"><hp:sz width="${width}" widthRelTo="ABSOLUTE" height="${height}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="141"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>${trs.join("")}</hp:tbl>`;
  };
  const lineW = Math.max(0.12, Math.round(d.table.borderPt * 0.3528 * 100) / 100);
  const box = reg.fill({ box: lineW });

  const get = (t: string) => blocks.find((b) => b.t === t) as { text: string } | undefined;
  const title = get("title"), contact = get("contact"), subject = get("subject"), slogan = get("slogan"), docNo = get("docNo");

  // ---- 머리말 ----
  const headerParts: string[] = [];
  const logo = addImage(d.images.logo), emblem = d.header.emblem ? addImage(d.images.emblem) : null;
  const sloganPara = () => {
    const parts = [logo ? pic(logo, 22 * k) : "", esc(slogan?.text ?? ""), docNo ? `   ${esc(docNo.text)}` : ""];
    return para("", { face: d.fonts.body, pt: s.slogan, align: "LEFT", inner: `${parts[0]}${parts[1] || parts[2] ? `<hp:t>${parts[1]}${parts[2]}</hp:t>` : ""}` });
  };
  if (d.header.boxed) {
    const hasEmblemCol = d.header.emblem;
    const embW = hasEmblemCol ? hu(24 * k) : 0;
    const mainW = contentW - embW;
    const hasTop = !!(slogan || logo || docNo);
    const cells: Cell[] = [];
    let r = 0;
    const cols = hasEmblemCol ? 2 : 1;
    const titleH = Math.round(s.title * 100 * 1.5) + Math.round(s.meta * 100 * 1.3) + 600;
    const barH = d.header.grayBar ? hu(2.2 * k) : 0;
    const subjH = Math.round(s.subject * 100 * 1.9);
    if (hasTop) { cells.push({ col: 0, row: r, colSpan: cols, w: contentW, h: Math.round(s.slogan * 100 * 2.2), fill: box, paras: [sloganPara()] }); r++; }
    const rowsMain = 2 + (barH ? 1 : 0);
    if (hasEmblemCol) {
      const emH = titleH + barH + subjH;
      cells.push({ col: 0, row: r, rowSpan: rowsMain, w: embW, h: emH, fill: box, paras: [para("", { face: d.fonts.body, pt: s.body, align: "CENTER", line: 100, inner: emblem ? pic(emblem, 20 * k) : `<hp:t></hp:t>` })] });
    }
    const mc = hasEmblemCol ? 1 : 0;
    cells.push({ col: mc, row: r, w: mainW, h: titleH, fill: box, paras: [
      para(title?.text ?? "가정통신문", { face: d.fonts.title, pt: s.title, align: d.header.titleAlign === "center" ? "CENTER" : "LEFT", line: 120, width: mainW }),
      ...(contact ? [para(contact.text, { face: d.fonts.meta, pt: s.meta, align: "RIGHT", line: 120, width: mainW })] : []),
    ] });
    r++;
    if (barH) { cells.push({ col: mc, row: r, w: mainW, h: barH, fill: reg.fill({ box: lineW, fill: d.header.grayBar }), paras: [para("", { face: d.fonts.body, pt: 2, align: "LEFT", line: 100 })] }); r++; }
    cells.push({ col: mc, row: r, w: mainW, h: subjH, fill: box, paras: [para(subject?.text ?? "", { face: d.fonts.subject, pt: s.subject, align: "LEFT", width: mainW })] });
    r++;
    headerParts.push(table(r, cols, contentW, cells, box));
  } else {
    if (slogan || logo) headerParts.push(sloganPara());
    headerParts.push(para(title?.text ?? "가정통신문", { face: d.fonts.title, pt: s.title, align: "CENTER", line: 130 }));
    if (contact) headerParts.push(para(contact.text, { face: d.fonts.meta, pt: s.meta, align: "RIGHT" }));
    if (subject) headerParts.push(para(subject.text, { face: d.fonts.subject, pt: s.subject, align: "LEFT", prev: 600 }));
  }

  // ---- 본문 ----
  const em = (n: number) => Math.round(s.body * 100 * n);
  const body: string[] = [];
  for (const b of blocks as Block[]) {
    switch (b.t) {
      case "slogan": case "docNo": case "title": case "contact": case "subject": break;
      case "gap": body.push(para("", { face: d.fonts.body, pt: Math.max(3, s.body * 0.35), align: "LEFT", line: 100 })); break;
      case "para": body.push(para(b.text, { face: d.fonts.body, pt: s.body, align: "JUSTIFY", intent: em(1) })); break;
      case "heading": body.push(para(b.text, { face: d.fonts.heading, pt: s.heading, align: "LEFT", prev: em(0.5) })); break;
      case "item": body.push(para(b.text, { face: d.fonts.body, pt: s.body, align: "LEFT", left: em(1.2) })); break;
      case "bullet": body.push(para(`- ${b.text}`, { face: d.fonts.body, pt: s.body, align: "LEFT", left: em(1.4), intent: -em(0.8) })); break;
      case "note": body.push(para(b.text, { face: d.fonts.body, pt: s.note, align: "RIGHT" })); break;
      case "blockTitle": body.push(para(`○ ${b.text}`, { face: d.fonts.heading, pt: s.heading, align: "LEFT", prev: em(0.4) })); break;
      case "table": {
        const cols = Math.max(...b.rows.map((r) => r.length));
        const tw = Math.round(contentW * 0.94), cw = Math.floor(tw / cols);
        const head = reg.fill({ box: lineW, fill: d.table.headerFill });
        const cells: Cell[] = b.rows.flatMap((row, ri) => Array.from({ length: cols }, (_, ci) => ({
          col: ci, row: ri, w: cw, h: Math.round(d.table.fontPt * 100 * 2), fill: ri === 0 ? head : box,
          paras: [para(row[ci] ?? "", { face: d.fonts.body, pt: d.table.fontPt, bold: ri === 0, align: "CENTER", line: 120, width: cw })],
        })));
        body.push(`<hp:p id="0" paraPrIDRef="${reg.para({ align: "CENTER", line: 100, prev: em(0.3), next: em(0.3) })}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${reg.char(faceOf(d.fonts.body), s.body, false)}">${table(b.rows.length, cols, tw, cells, box)}<hp:t/></hp:run></hp:p>`);
        break;
      }
      case "date": body.push(para(b.text.replace(/\s+/g, " "), { face: d.fonts.closing, pt: s.closingDate, bold: d.closing.dateBold, align: d.closing.align === "center" ? "CENTER" : "RIGHT", prev: em(2) })); break;
      case "school": body.push(para(b.text, { face: d.fonts.closing, pt: s.closingSchool, bold: d.closing.schoolBold, align: d.closing.align === "center" ? "CENTER" : "RIGHT", prev: em(0.8) })); break;
      case "cut": body.push(para("- - - - - - - - - - - - - -  ✂ 절 취 선  - - - - - - - - - - - - - -", { face: d.fonts.body, pt: s.note, align: "CENTER", prev: em(1), next: em(0.6) })); break;
      case "formTitle": body.push(para(b.text, { face: d.fonts.heading, pt: s.heading + 3 * k, align: "CENTER", next: em(0.5) })); break;
      case "formLine": body.push(para(b.text, { face: d.fonts.body, pt: s.body, align: "LEFT", left: em(1.2) })); break;
    }
  }

  // ---- 첫 문단: 쪽 설정(secPr) + 머리말 ----
  const m = d.marginMm;
  const pageFill = d.pageBorder ? reg.fill({ box: Math.max(0.2, lineW * 1.5) }) : 1;
  const pbf = (type: string) => `<hp:pageBorderFill type="${type}" borderFillIDRef="${pageFill}" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>`;
  const secPr = `<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/><hp:pagePr landscape="WIDELY" width="${A4_W}" height="${A4_H}" gutterType="LEFT_ONLY"><hp:margin header="0" footer="0" gutter="0" left="${hu(m.left)}" right="${hu(m.right)}" top="${hu(m.top)}" bottom="${hu(m.bottom)}"/></hp:pagePr><hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr><hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr>${pbf("BOTH")}${pbf("EVEN")}${pbf("ODD")}</hp:secPr><hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>`;
  const c0 = reg.char(faceOf(d.fonts.body), s.body, false), p0 = reg.para({ align: "LEFT", line: lineP });
  const first = d.header.boxed
    ? `<hp:p id="0" paraPrIDRef="${p0}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${c0}">${secPr}</hp:run><hp:run charPrIDRef="${c0}">${headerParts[0]}<hp:t/></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="${contentW}" flags="393216"/></hp:linesegarray></hp:p>`
    : `<hp:p id="0" paraPrIDRef="${p0}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${c0}">${secPr}</hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="${contentW}" flags="393216"/></hp:linesegarray></hp:p>${headerParts.join("")}`;
  const section = `${XML_DECL}<hs:sec ${NS}>${first}${body.join("")}</hs:sec>`;

  // ---- 패키지 ----
  const enc = new TextEncoder();
  const manifest = [
    '<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>',
    ...imgs.map((i) => `<opf:item id="${i.id}" href="${i.file}" media-type="${i.mime}" isEmbeded="1"/>`),
    '<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>',
    '<opf:item id="settings" href="settings.xml" media-type="application/xml"/>',
  ].join("");
  const title0 = esc((subject?.text ?? "가정통신문").replace(/^제목\s*[:：]\s*/, ""));
  const hpf = `${XML_DECL}<opf:package ${NS} version="" unique-identifier="" id=""><opf:metadata><opf:title>${title0}</opf:title><opf:language>ko</opf:language></opf:metadata><opf:manifest>${manifest}</opf:manifest><opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>`;
  const files: { name: string; data: Uint8Array }[] = [
    { name: "mimetype", data: enc.encode("application/hwp+zip") },
    { name: "version.xml", data: enc.encode(`${XML_DECL}<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="1" buildNumber="0" os="1" xmlVersion="1.5" application="Hancom Office Hangul" appVersion="13, 0, 0, 2725 WIN32LEWindows_10"/>`) },
    { name: "Contents/header.xml", data: enc.encode(reg.headerXml()) },
    { name: "Contents/section0.xml", data: enc.encode(section) },
    ...imgs.map((i) => ({ name: i.file, data: i.bytes })),
    { name: "Preview/PrvText.txt", data: enc.encode(text.replace(/\n{2,}/g, "\n").slice(0, 1000)) },
    { name: "settings.xml", data: enc.encode(`${XML_DECL}<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"><ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/></ha:HWPApplicationSetting>`) },
    { name: "META-INF/container.rdf", data: enc.encode(`${XML_DECL}<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/header.xml"/></rdf:Description><rdf:Description rdf:about="Contents/header.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#HeaderFile"/></rdf:Description><rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/section0.xml"/></rdf:Description><rdf:Description rdf:about="Contents/section0.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#SectionFile"/></rdf:Description><rdf:Description rdf:about=""><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#Document"/></rdf:Description></rdf:RDF>`) },
    { name: "Contents/content.hpf", data: enc.encode(hpf) },
    { name: "META-INF/container.xml", data: enc.encode(`${XML_DECL}<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/><ocf:rootfile full-path="Preview/PrvText.txt" media-type="text/plain"/><ocf:rootfile full-path="META-INF/container.rdf" media-type="application/rdf+xml"/></ocf:rootfiles></ocf:container>`) },
    { name: "META-INF/manifest.xml", data: enc.encode(`${XML_DECL}<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>`) },
  ];
  return zipStore(files);
}
