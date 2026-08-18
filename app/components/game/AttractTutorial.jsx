"use client";

import { useEffect, useState } from "react";
import { TUTORIAL_STEP_DURATION, tutorialSteps } from "../../attract-data.js";
import { courseObstacles } from "../../course-data.js";
import { CharacterAvatar } from "../character/CharacterAvatar.jsx";
import { CourseObstacle } from "./CourseObstacle.jsx";

export function AttractTutorial() {
  const [stepIndex, setStepIndex] = useState(0);
  const step = tutorialSteps[stepIndex];
  const obstacle = courseObstacles.find(({ id }) => id === step.obstacleId);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setStepIndex((current) => (current + 1) % tutorialSteps.length),
      TUTORIAL_STEP_DURATION,
    );
    return () => window.clearTimeout(timer);
  }, [stepIndex]);

  return (
    <div className={`attract-tutorial tutorial-${step.id}`}>
      <aside className="tutorial-step-list" aria-label="遊び方の手順">
        <header><span>HOW TO PLAY</span><strong>遊び方は<br />かんたん！</strong></header>
        {tutorialSteps.map((item, index) => (
          <div className={index === stepIndex ? "is-active" : index < stepIndex ? "is-complete" : ""} key={item.id}>
            <span>{item.number}</span><p><strong>{item.label}</strong><small>{item.title}</small></p><i>{index < stepIndex ? "✓" : ""}</i>
          </div>
        ))}
      </aside>
      <section className="tutorial-playfield" aria-live="polite">
        <div className="tutorial-sky"><i className="tutorial-cloud cloud-left" /><i className="tutorial-cloud cloud-right" /></div>
        <div className="tutorial-flags" />
        <div className="tutorial-ground" />
        <div className="tutorial-copy" key={`copy-${step.id}`}><span>{step.number} · {step.label}</span><strong>{step.title}</strong><small>{step.copy}</small></div>
        <div className="tutorial-control" key={`control-${step.id}`}><kbd>{step.button}</kbd><span>いま押す！</span></div>
        <div className="tutorial-stamina"><span>BOOST</span><i><b /></i></div>
        {obstacle && <CourseObstacle obstacle={obstacle} left={step.id === "boost" ? 72 : 64} className="tutorial-obstacle" />}
        {step.id === "goal" && <div className="tutorial-finish"><span>FINISH</span></div>}
        <div className="tutorial-runner-shadow" />
        <div className="tutorial-runner" key={`runner-${step.id}`}><span className="tutorial-speed-lines">≋</span><i className="tutorial-dust" /><CharacterAvatar id={step.characterId} /><b>NICE!</b></div>
        <div className="tutorial-progress" key={`progress-${step.id}`}><i /></div>
      </section>
    </div>
  );
}
