import { getBackend } from "../../backends/registry.js";
import { MarkdownAdapter } from "./base/MarkdownAdapter.js";

export class CostrictAdapter extends MarkdownAdapter {
  protected config = getBackend("costrict");
}
