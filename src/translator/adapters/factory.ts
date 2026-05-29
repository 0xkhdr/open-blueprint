import { getBackend } from "../../backends/registry.js";
import { MarkdownAdapter } from "./base/MarkdownAdapter.js";

export class FactoryAdapter extends MarkdownAdapter {
  protected config = getBackend("factory");
}
