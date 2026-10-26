/* eslint-disable @next/next/no-img-element -- local transparent game sprites are already sized and optimized */

export function TitleLogo({ className = "" }) {
  return <img className={["title-logo", className].filter(Boolean).join(" ")} src="/title.png" alt="アニマルダッシュ！" draggable={false} />;
}
