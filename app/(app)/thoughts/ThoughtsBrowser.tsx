"use client";

import ThoughtsBrowserDesktop from "./ThoughtsBrowser.desktop";
import ThoughtsBrowserMobile from "./ThoughtsBrowser.mobile";
import {
  useThoughtsBrowser,
  type ThoughtsBrowserInput,
} from "./useThoughtsBrowser";

/**
 * One screen, one state, two shells.
 *
 * Which shell is on screen is a layout question, so the stylesheet answers it:
 * both mount, one is `display: none`. A hook would answer "desktop" on the
 * server and correct itself after paint, which on the densest screen in the app
 * is a visible reflow. The cost is that both trees render — they are
 * presentational and read the same hook, so that is a render, not a duplicate
 * source of truth.
 */
export default function ThoughtsBrowser(props: ThoughtsBrowserInput) {
  const state = useThoughtsBrowser(props);

  return (
    <>
      <ThoughtsBrowserDesktop
        state={state}
        settingsId={props.settingsId}
        corrections={props.corrections}
      />
      <ThoughtsBrowserMobile
        state={state}
        settingsId={props.settingsId}
        corrections={props.corrections}
      />
    </>
  );
}
