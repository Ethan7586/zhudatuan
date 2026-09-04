export interface Command<TName extends string = string> {
  readonly type: TName;
}
