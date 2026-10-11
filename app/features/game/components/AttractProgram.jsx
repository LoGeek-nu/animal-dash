import { ATTRACT_SCENES } from "../../../domain/attract.js";

export function AttractProgram({ scene, revision }) {
  return (
    <section className="attract-program" aria-label="上映プログラム">
      {ATTRACT_SCENES.map((item, index) => (
        <div className={scene === index ? "is-active" : ""} key={item.id}>
          <span>0{index + 1}</span><strong>{item.label}</strong><small>{item.caption}</small>
          {scene === index && <i key={`${scene}-${revision}`} style={{ "--scene-duration": `${item.duration}ms` }} />}
        </div>
      ))}
    </section>
  );
}
