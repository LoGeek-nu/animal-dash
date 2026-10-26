"use client";

/* eslint-disable @next/next/no-img-element -- local transparent game sprites are already sized and optimized */

import { useEffect, useState } from "react";
import { CharacterAvatar } from "../../../components/ui/molecules/CharacterAvatar.jsx";
import { TUTORIAL_STEP_DURATION, tutorialSteps } from "../../../domain/attract.js";
import { obstacleTypes } from "../../../domain/course.js";
import { CourseObstacle } from "./CourseObstacle.jsx";

const BUTTON_LABELS = { jump: "ジャンプ", boost: "ブースト" };

export function AttractTutorial() {
  const [stepIndex, setStepIndex] = useState(0);
  const step = tutorialSteps[stepIndex];
  const obstacle = step.obstacleType && { id: step.obstacleType, type: step.obstacleType, ...obstacleTypes[step.obstacleType] };

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
        <header><span>使うボタンは2つ</span><strong>遊び方は<br />かんたん！</strong></header>
        {tutorialSteps.map((item, index) => (
          <div className={index === stepIndex ? "is-active" : index < stepIndex ? "is-complete" : ""} key={item.id}>
            <span>{item.number}</span><p><strong>{item.buttons.map((button) => <b className={`control-dot is-${button}`} key={button} />)}{item.label}</strong><small>{item.title}</small></p><i>{index < stepIndex ? "✓" : ""}</i>
          </div>
        ))}
      </aside>
      <section className="tutorial-playfield" aria-live="polite">
        <div className="tutorial-sky"><i className="tutorial-cloud cloud-left" /><i className="tutorial-cloud cloud-right" /></div>
        <div className="tutorial-flags" />
        <div className="tutorial-ground" />
        <div className="tutorial-copy" key={`copy-${step.id}`}><span>{step.number} · {step.label}</span><strong>{step.title}</strong><small>{step.copy}</small></div>
        <div className="tutorial-control" key={`control-${step.id}`}>
          <div className="tutorial-buttons">
            {step.buttons.map((button) => <span className={`tutorial-button is-${button}`} key={button}><i /><b>{BUTTON_LABELS[button]}</b></span>)}
          </div>
          <span className="tutorial-prompt">{step.prompt}</span>
        </div>
        <div className="tutorial-stamina"><span>ブースト</span><i><b /></i></div>
        {obstacle && <CourseObstacle obstacle={obstacle} className="tutorial-obstacle" />}
        {step.id === "goal" && <img className="tutorial-finish" src="/course/final.png" alt="" draggable={false} />}
        <div className="tutorial-runner-shadow" />
        <div className="tutorial-runner" key={`runner-${step.id}`}><span className="speed-streak tutorial-speed-lines" aria-hidden="true"><i /><i /><i /></span><i className="tutorial-dust" /><CharacterAvatar id={step.characterId} /><b>NICE!</b></div>
        <div className="tutorial-progress" key={`progress-${step.id}`}><i /></div>
      </section>
    </div>
  );
}
