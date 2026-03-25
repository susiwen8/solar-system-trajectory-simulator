import { createPlaybackClock } from "../../../src/scene/usePlaybackClock";


test("advances mission time according to the selected speed multiplier", () => {
  const clock = createPlaybackClock();

  clock.setSpeed(100);
  clock.tick(0.25);

  expect(clock.getState().currentTimeSeconds).toBe(25);
});

