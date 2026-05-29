import { getBackend } from "../../backends/registry.js";
import { MarkdownAdapter } from "./base/MarkdownAdapter.js";

export class KiloCodeAdapter extends MarkdownAdapter {
  protected config = getBackend("kilocode");
}
