import { getBackend } from "../../backends/registry.js";
import { SkillOnlyAdapter } from "./base/SkillOnlyAdapter.js";

export class KimiAdapter extends SkillOnlyAdapter {
  protected config = getBackend("kimi");
}
