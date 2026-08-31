import { AuthProvider } from './AuthProvider';
import { AuthRouter } from './AuthRouter';

export default function App() {
  return (
    <AuthProvider>
      <AuthRouter />
    </AuthProvider>
  );
}
