import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGN, noticePrintDocument, noticeToHtml, parseNotice, type DesignProfile } from "@/lib/noticeDesign";

const TEXT = `【학교 표어】
(【문서번호】호)
가 정 통 신 문
담당자: 【   】부 ☎ 【   】
제목: 2027학년도 수학여행 안내
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

describe("가정통신문 글 → 블록", () => {
  const types = parseNotice(TEXT).map((b) => b.t);
  it("머리말·본문·항목·표·맺음말·동의서를 알아본다", () => {
    expect(types.slice(0, 5)).toEqual(["slogan", "docNo", "title", "contact", "subject"]);
    expect(types).toContain("heading");
    expect(types).toContain("item");
    expect(types).toContain("table");
    expect(types).toContain("blockTitle");
    expect(types).toContain("bullet");
    expect(types).toContain("note");
    expect(types.slice(-8)).toEqual(expect.arrayContaining(["date", "school", "cut", "formTitle", "formLine"]));
  });
  it("표는 행·칸으로 나눈다", () => {
    const t = parseNotice(TEXT).find((b) => b.t === "table");
    expect(t && t.t === "table" && t.rows).toEqual([["일정", "세부 내용", "비고"], ["2027. 5. 12.(수)", "【   】", "【   】"]]);
  });
  it("표어 줄이 없으면 첫 줄은 제목", () => {
    expect(parseNotice("가정통신문\n제목: x")[0]).toEqual({ t: "title", text: "가정통신문" });
  });
});

describe("디자인을 입힌 HTML", () => {
  const design: DesignProfile = {
    ...DEFAULT_DESIGN, source: "pdf",
    header: { boxed: true, emblem: true, grayBar: "#b2b2b2", subjectBoxed: true, titleAlign: "center" },
    sizes: { ...DEFAULT_DESIGN.sizes, title: 33, body: 11 },
    table: { headerFill: "#e0e5fa", borderPt: 0.5, fontPt: 10.5 },
    images: { logo: "data:image/png;base64,AAAA", emblem: "data:image/png;base64,BBBB" },
  };
  const html = noticeToHtml(TEXT, design);

  it("레퍼런스의 크기·색·그림을 그대로 쓴다", () => {
    expect(html).toContain("font-size:33pt");
    expect(html).toContain("background:#e0e5fa");
    expect(html).toContain("background:#b2b2b2");
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).toContain('src="data:image/png;base64,BBBB"');
    expect(html).toContain("width:210mm");
  });
  it("글꼴 이름의 큰따옴표가 style 속성을 깨지 않는다", () => {
    expect(html).toContain("font-family:'함초롬돋움'");
    expect(html).not.toMatch(/font-family:[^;]*"함초롬/);
  });
  it("빈칸 강조는 미리보기에서만", () => {
    expect(html).not.toContain("fff3b0");
    expect(noticeToHtml(TEXT, design, { highlightBlanks: true })).toContain("fff3b0");
  });
  it("글과 그림 주소를 안전하게 처리한다", () => {
    const evil = { ...design, images: { logo: 'data:image/png;base64,AA"><script>alert(1)</script>', emblem: "javascript:alert(1)" }, table: { ...design.table, headerFill: "red;background:url(x)" } } as DesignProfile;
    const h = noticeToHtml("가정통신문\n제목: <img src=x onerror=alert(1)>\n  본문 <b>굵게</b> & \"따옴표\"", evil);
    expect(h).not.toContain("<script>");
    expect(h).not.toContain("javascript:");
    expect(h).not.toContain("<img src=x");
    expect(h).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(h).not.toContain("url(x)");
  });
  it("상자 없는 디자인과 인쇄용 문서도 만든다", () => {
    const plain = noticeToHtml(TEXT, { ...design, header: { ...design.header, boxed: false, emblem: false } });
    expect(plain).toContain("border-bottom");
    const doc = noticePrintDocument(TEXT, design, "수학여행 <안내>");
    expect(doc).toContain("@page{size:210mm 297mm;margin:0}");
    expect(doc).toContain("<title>수학여행 &lt;안내&gt;</title>");
  });
});
