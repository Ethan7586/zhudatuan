export interface NavigationPort {
  assign(target: string): void;
  replace(target: string): void;
  reload(): void;
}
