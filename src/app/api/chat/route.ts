import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/answer";

// API 키(LLM_API_KEY)는 서버에서만 읽는다. 현재는 데모 모드(키워드 검색)만 구현.
export async function POST(req: Request) {
  const { question } = (await req.json()) as { question?: string };
  if (!question?.trim()) return NextResponse.json({ answer: "질문을 입력해 주세요.", sources: [] });
  return NextResponse.json(answerQuestion(question));
}
