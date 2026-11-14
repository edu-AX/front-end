import { describe, expect, it } from "vitest";
import { buildHwpx, zipStore } from "@/lib/hwpx";
import { DEFAULT_DESIGN, scaleDesign, type DesignProfile } from "@/lib/noticeDesign";

/** 압축 없이 묶은 zip 읽기 (테스트용) */
function unzip(buf: Uint8Array): Record<string, Uint8Array> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out: Record<string, Uint8Array> = {};
  const order: string[] = [];
  let p = 0;
  while (p + 30 < buf.length && dv.getUint32(p, true) === 0x04034b50) {
    const method = dv.getUint16(p + 8, true), size = dv.getUint32(p + 18, true), nl = dv.getUint16(p + 26, true), el = dv.getUint16(p + 28, true);
    const name = new TextDecoder().decode(buf.subarray(p + 30, p + 30 + nl));
    expect(method).toBe(0); // 압축 없음
    out[name] = buf.subarray(p + 30 + nl + el, p + 30 + nl + el + size);
    order.push(name);
    p += 30 + nl + el + size;
  }
  (out as Record<string, unknown>).__order = order;
  return out;
}
const str = (b: Uint8Array) => new TextDecoder().decode(b);

const TEXT = `【학교 표어】
가 정 통 신 문
담당자: 【   】부 ☎ 【   】
제목: 2027학년도 수학여행 안내 & 동의서
  학부모님 가정에 건강과 평안이 가득하시기를 기원합니다.

1. 행사 개요
  가. 일시: 2027. 5. 12.(수)
2. 세부 일정
  일정 | 세부 내용 | 비고
  2027. 5. 12.(수) | 【   】 | 【   】
○ 학생 준비물
  - 신분증
  * 일정은 변경될 수 있음

2027년 3월 11일
인 덕 고 등 학 교 장

- - - - - - - - 절 취 선 - - - - - - - -

수학여행 참가 동의서
  학부모(보호자): 【   】`;

// 1x1 PNG
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const design: DesignProfile = {
  ...DEFAULT_DESIGN, source: "pdf",
  header: { boxed: true, emblem: true, grayBar: "#b2b2b2", subjectBoxed: true, titleAlign: "center" },
  table: { headerFill: "#e0e5fa", borderPt: 0.5, fontPt: 10.5 },
  images: { logo: PNG, emblem: PNG },
};

describe("zip 묶기", () => {
  it("mimetype 이 맨 처음, 압축 없이 들어가고 끝에 중앙 디렉터리가 있다", () => {
    const z = zipStore([{ name: "mimetype", data: new TextEncoder().encode("application/hwp+zip") }, { name: "a/b.txt", data: new TextEncoder().encode("한글") }]);
    const f = unzip(z);
    expect((f as Record<string, unknown>).__order).toEqual(["mimetype", "a/b.txt"]);
    expect(str(f["mimetype"])).toBe("application/hwp+zip");
    expect(str(f["a/b.txt"])).toBe("한글");
    const dv = new DataView(z.buffer);
    expect(dv.getUint32(z.length - 22, true)).toBe(0x06054b50); // 끝 레코드
    expect(dv.getUint16(z.length - 12, true)).toBe(2); // 파일 수
  });
});

describe("한글(.hwpx) 만들기", () => {
  const f = unzip(buildHwpx(TEXT, scaleDesign(design, 0.9), 0.9));
  const header = str(f["Contents/header.xml"]), section = str(f["Contents/section0.xml"]), hpf = str(f["Contents/content.hpf"]);

  it("한글 문서 패키지 구성을 갖춘다", () => {
    expect((f as Record<string, unknown>).__order).toEqual(expect.arrayContaining(["mimetype", "version.xml", "Contents/header.xml", "Contents/section0.xml", "Contents/content.hpf", "settings.xml", "META-INF/container.xml"]));
    expect(((f as Record<string, unknown>).__order as string[])[0]).toBe("mimetype");
    expect(str(f["mimetype"])).toBe("application/hwp+zip");
    expect(str(f["META-INF/container.xml"])).toContain("Contents/content.hpf");
  });

  it("A4 크기·여백, 글자 내용, 표, 맺음말이 들어간다", () => {
    expect(section).toContain('width="59528" height="84188"');
    expect(section).toContain("2027학년도 수학여행 안내 &amp; 동의서"); // XML 기호는 이스케이프
    expect(section).toContain("<hp:tbl "); // 머리말 표 + 일정 표
    expect((section.match(/<hp:tbl /g) ?? []).length).toBe(2);
    expect(section).toContain("가 정 통 신 문");
    expect(section).toContain("인 덕 고 등 학 교 장");
    expect(section).toContain("✂ 절 취 선");
    expect(section).toContain("【   】");
  });

  it("레퍼런스의 로고·엠블럼 그림이 BinData 로 들어가고 문서가 가리킨다", () => {
    expect(Object.keys(f)).toEqual(expect.arrayContaining(["BinData/image1.png", "BinData/image2.png"]));
    expect(hpf).toContain('id="image1" href="BinData/image1.png" media-type="image/png" isEmbeded="1"');
    expect(section).toContain('binaryItemIDRef="image1"');
    expect(section).toContain('binaryItemIDRef="image2"');
  });

  it("header.xml 의 개수 표시가 실제 항목 수와 같다", () => {
    const count = (tag: string) => (header.match(new RegExp(`<hh:${tag} `, "g")) ?? []).length;
    const cnt = (list: string) => Number(new RegExp(`<hh:${list} itemCnt="(\\d+)"`).exec(header)![1]);
    expect(cnt("charProperties")).toBe(count("charPr"));
    expect(cnt("paraProperties")).toBe(count("paraPr"));
    expect(cnt("borderFills")).toBe(count("borderFill"));
    expect(header).toContain('<hh:fontfaces itemCnt="7">');
    expect(header).toContain('face="함초롬돋움"');
    expect(header).toContain('face="HY헤드라인M"'.replace("HY헤드라인M", "함초롬돋움")); // 본문 글꼴
  });

  it("본문이 가리키는 글자·문단·테두리 모양이 모두 header.xml 에 있다", () => {
    const ids = (re: RegExp, s: string) => [...s.matchAll(re)].map((m) => Number(m[1]));
    const chars = new Set(ids(/<hh:charPr id="(\d+)"/g, header)), paras = new Set(ids(/<hh:paraPr id="(\d+)"/g, header)), fills = new Set(ids(/<hh:borderFill id="(\d+)"/g, header));
    for (const id of ids(/charPrIDRef="(\d+)"/g, section)) expect(chars.has(id)).toBe(true);
    for (const id of ids(/paraPrIDRef="(\d+)"/g, section)) expect(paras.has(id)).toBe(true);
    for (const id of ids(/borderFillIDRef="(\d+)"/g, section)) expect(fills.has(id)).toBe(true);
  });

  it("표 머리 칸과 회색 줄에 레퍼런스 색을 쓴다", () => {
    expect(header).toContain('faceColor="#E0E5FA"');
    expect(header).toContain('faceColor="#B2B2B2"');
  });

  it("머리말이 상자가 아니고 그림이 없어도 만들어진다", () => {
    const g = unzip(buildHwpx(TEXT, { ...design, images: {}, header: { ...design.header, boxed: false, emblem: false } }));
    expect(Object.keys(g).some((k) => k.startsWith("BinData/"))).toBe(false);
    expect((str(g["Contents/section0.xml"]).match(/<hp:tbl /g) ?? []).length).toBe(1); // 일정 표만
  });

  it("잘못된 그림 주소는 넣지 않는다", () => {
    const g = unzip(buildHwpx(TEXT, { ...design, images: { logo: "javascript:alert(1)", emblem: "data:image/png;base64,@@@" } }));
    expect(Object.keys(g).some((k) => k.startsWith("BinData/"))).toBe(false);
  });
});
