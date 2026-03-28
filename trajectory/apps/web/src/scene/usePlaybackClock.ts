type PlaybackClockState = {
  currentTimeSeconds: number;
  speed: number;
};

export function createPlaybackClock() {
  let state: PlaybackClockState = {
    currentTimeSeconds: 0,
    speed: 1
  };

  return {
    getState() {
      return state;
    },
    setSpeed(speed: number) {
      state = { ...state, speed };
    },
    tick(deltaSeconds: number) {
      state = {
        ...state,
        currentTimeSeconds: state.currentTimeSeconds + deltaSeconds * state.speed
      };
    }
  };
}

