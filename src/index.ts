import { configManager } from "./config.js";
import { eos } from "./eos.js";
import { faderProfileManager } from "./fader-profiles.js";
import { midi } from "./midi.js";

const initializeBridge = () => {
  configManager.initialize();
  faderProfileManager.initialize();
  eos.initialize();
  midi.initialize();
};

initializeBridge();
