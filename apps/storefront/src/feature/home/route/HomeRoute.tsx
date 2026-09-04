import { useHomeViewModel } from '../viewmodel/HomeViewModel';
import { HomePage } from '../view/HomePage';
export function Component() {
  return <HomePage viewmodel={useHomeViewModel()} />;
}
