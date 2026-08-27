export interface Query<TName extends string = string> {
  readonly type: TName;
}
