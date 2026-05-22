export type FontCategory = "sans" | "serif" | "mono";

export interface BrewFont {
  token: string;
  name: string;
  description: string;
  category: FontCategory;
  installCmd: string;
}
