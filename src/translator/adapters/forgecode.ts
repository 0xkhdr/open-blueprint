import { getBackend } from "../../backends/registry.js";
import { SkillOnlyAdapter } from "./base/SkillOnlyAdapter.js";

export class ForgeCodeAdapter extends SkillOnlyAdapter {
  protected config = getBackend("forgecode");
}
