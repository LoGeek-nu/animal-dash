import { SectionKicker } from "../../../components/ui/atoms/SectionKicker.jsx";
import { CharacterAvatar } from "../../../components/ui/molecules/CharacterAvatar.jsx";

const HERO_CHARACTERS = ["momo", "koro", "dorami", "azuki"];

export function AttractHero() {
  return (
    <section className="attract-hero">
      <SectionKicker>OUREISAI 2026 · PLAYABLE EXHIBITION</SectionKicker>
      <h1><span>アニマル</span><strong>ダッシュ！</strong></h1>
      <p>かわいい動物たちと、いっしょに走ろう！</p>
      <div className="attract-runners" aria-label="登場キャラクター">
        {HERO_CHARACTERS.map((id, index) => (
          <div key={id} style={{ "--runner-delay": `${index * -.35}s` }}>
            <CharacterAvatar id={id} />
          </div>
        ))}
      </div>
    </section>
  );
}
