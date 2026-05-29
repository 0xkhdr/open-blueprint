import { getBackend } from "../../backends/registry.js";
import { TomlCommandAdapter } from "./base/TomlCommandAdapter.js";

export class QwenAdapter extends TomlCommandAdapter {
  protected config = getBackend("qwen");
}
