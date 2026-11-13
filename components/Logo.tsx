import Link from "next/link";

/** 톤앤매너 로고. 원본에서 주변 장식을 제거한 public/logo.png 사용 */
export default function Logo({ width = 120, href = "/" }: { width?: number; href?: string | null }) {
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src="/logo.png" alt="톤앤매너" width={width} style={{ width, height: "auto" }} />;
  return href ? <Link href={href} className="inline-block transition hover:scale-105">{img}</Link> : img;
}
