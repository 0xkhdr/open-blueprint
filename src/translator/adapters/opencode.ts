import { getBackend } from "../../backends/registry.js";
import { MarkdownAdapter } from "./base/MarkdownAdapter.js";

export class OpenCodeAdapter extends MarkdownAdapter {
  protected config = getBackend("opencode");
}
