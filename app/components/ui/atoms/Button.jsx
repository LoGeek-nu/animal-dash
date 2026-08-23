"use client";

import { forwardRef } from "react";
import styles from "./Button.module.css";

const VARIANT_CLASSES = {
  primary: `${styles.dialogAction} ${styles.primary} primary-button`,
  secondary: `${styles.dialogAction} ${styles.secondary} secondary-button`,
  ghost: `${styles.adminAction} ${styles.ghost} ghost-button`,
  danger: `${styles.dialogAction} ${styles.danger} danger-button`,
  raceStart: `${styles.adminAction} ${styles.raceStart} race-start-button`,
  secondaryStart: `${styles.adminAction} ${styles.secondaryStart} secondary-start`,
  assign: `${styles.assign} assign-button`,
  icon: `${styles.icon} remove-racer`,
  clear: `${styles.clear} clear-selection`,
  unstyled: "",
};

export const Button = forwardRef(function Button(
  { variant = "primary", className = "", type = "button", ...props },
  ref,
) {
  const classes = [VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary, className]
    .filter(Boolean)
    .join(" ");

  return <button ref={ref} type={type} className={classes} {...props} />;
});
