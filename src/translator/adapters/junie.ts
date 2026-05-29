import { getBackend } from "../../backends/registry.js";
import { MarkdownAdapter } from "./base/MarkdownAdapter.js";

export class JunieAdapter extends MarkdownAdapter {
  protected config = getBackend("junie");
}
