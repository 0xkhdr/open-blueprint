import { getBackend } from "../../backends/registry.js";
import { MarkdownAdapter } from "./base/MarkdownAdapter.js";

export class CrushAdapter extends MarkdownAdapter {
  protected config = getBackend("crush");
}
