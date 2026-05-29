import { getBackend } from "../../backends/registry.js";
import { SkillOnlyAdapter } from "./base/SkillOnlyAdapter.js";

export class TraeAdapter extends SkillOnlyAdapter {
  protected config = getBackend("trae");
}
