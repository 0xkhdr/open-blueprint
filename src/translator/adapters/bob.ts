import { getBackend } from "../../backends/registry.js";
import { MarkdownAdapter } from "./base/MarkdownAdapter.js";

export class BobAdapter extends MarkdownAdapter {
  protected config = getBackend("bob");
}
