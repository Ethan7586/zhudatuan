export interface ObservableViewModel<TState> {
  state(): TState;
  subscribe(listener: () => void): () => void;
}

export class ViewModelHarness<TState> {
  private readonly states: TState[];
  private readonly unsubscribe: () => void;

  constructor(private readonly viewmodel: ObservableViewModel<TState>) {
    this.states = [viewmodel.state()];
    this.unsubscribe = viewmodel.subscribe(() => this.states.push(viewmodel.state()));
  }

  current(): TState {
    return this.viewmodel.state();
  }

  history(): readonly TState[] {
    return Object.freeze([...this.states]);
  }

  stop(): void {
    this.unsubscribe();
  }
}
