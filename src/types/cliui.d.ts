declare module "cliui" {
  interface Column {
    text: string;
    width?: number;
    align?: "left" | "right" | "center";
    padding?: number[];
    border?: boolean;
  }

  interface UI {
    div(...columns: Array<Column | string>): void;
    span(...columns: Array<Column | string>): void;
    resetOutput(): void;
    toString(): string;
  }

  export default function cliui(options?: { width?: number; wrap?: boolean }): UI;
}
