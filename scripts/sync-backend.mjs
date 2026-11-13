#!/usr/bin/env node
// 백엔드(edu-AX/back-end) 공유 코드 동기화 스크립트.
//
// 화면이 브라우저에서 바로 계산에 쓰는 도메인 코드(타입·D-day 역산·대시보드·인수인계 함수·마스킹)와
// 샘플 데이터는 백엔드 저장소가 원본이다. 이 스크립트는 backend.lock.json 에 적힌
// 백엔드 커밋에서 그 파일들만 그대로 가져온다. 프론트에서 이 파일들을 직접 고치지 말 것.
//
//   npm run sync:backend                  lock 의 커밋으로 맞추기
//   npm run sync:backend -- --latest      백엔드 main 최신 커밋으로 올리고 lock 갱신
//   npm run sync:backend -- --from ../back-end   로컬 백엔드 폴더에서 가져오기 (그 폴더 HEAD 로 lock 갱신)
//   npm run sync:check                    지금 파일이 lock 의 커밋과 같은지 검사 (다르면 실패)
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const lockPath = join(root, "backend.lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));

const args = process.argv.slice(2);
const check = args.includes("--check");
const latest = args.includes("--latest");
const fromIdx = args.indexOf("--from");
const fromDir = fromIdx >= 0 ? resolve(root, args[fromIdx + 1] ?? "") : null;

const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

let source;
let commit = lock.commit;
if (fromDir) {
  if (!existsSync(join(fromDir, "package.json"))) throw new Error(`백엔드 폴더가 아니에요: ${fromDir}`);
  source = fromDir;
  commit = git(fromDir, "rev-parse", "HEAD");
  const dirty = git(fromDir, "status", "--porcelain", "--", ...lock.files);
  if (dirty) {
    console.error("⚠ 로컬 백엔드에 커밋 안 된 변경이 있어요. 먼저 백엔드에서 커밋하세요:\n" + dirty);
    process.exit(1);
  }
} else {
  source = join(root, ".backend-cache");
  if (!existsSync(join(source, ".git"))) {
    console.log(`백엔드 저장소 받는 중: ${lock.repo}`);
    execFileSync("git", ["clone", "--quiet", lock.repo, source], { stdio: "inherit" });
  }
  git(source, "fetch", "--quiet", "origin");
  if (latest) commit = git(source, "rev-parse", `origin/${lock.branch ?? "main"}`);
  git(source, "checkout", "--quiet", "--detach", commit);
}

const mismatched = [];
for (const f of lock.files) {
  const src = join(source, f);
  const dst = join(root, f);
  if (!existsSync(src)) throw new Error(`백엔드 ${commit.slice(0, 7)} 에 ${f} 가 없어요`);
  if (check) {
    const same = existsSync(dst) && readFileSync(src).equals(readFileSync(dst));
    if (!same) mismatched.push(f);
  } else {
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);
  }
}

if (check) {
  if (mismatched.length) {
    console.error(`✗ 백엔드 ${commit.slice(0, 7)} 와 다른 파일 ${mismatched.length}개:\n  ` + mismatched.join("\n  "));
    console.error("→ npm run sync:backend 로 맞추세요. (프론트에서 이 파일을 고쳤다면 백엔드에 먼저 반영)");
    process.exit(1);
  }
  console.log(`✓ 공유 파일 ${lock.files.length}개가 백엔드 ${commit.slice(0, 7)} 와 같아요`);
} else {
  if (commit !== lock.commit) {
    lock.commit = commit;
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
  }
  console.log(`✓ 백엔드 ${commit.slice(0, 7)} 에서 공유 파일 ${lock.files.length}개를 가져왔어요`);
}
