import { getBackend } from "../../backends/registry.js";
import { MarkdownAdapter } from "./base/MarkdownAdapter.js";

export class QoderAdapter extends MarkdownAdapter {
  protected config = getBackend("qoder");
}
