import { getBackend } from "../../backends/registry.js";
import { MarkdownAdapter } from "./base/MarkdownAdapter.js";

export class WindsurfAdapter extends MarkdownAdapter {
  protected config = getBackend("windsurf");
}
