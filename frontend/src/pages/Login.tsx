import LoginForm from '../components/LoginForm';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  return (
    <LoginForm
      onLoginSuccess={onLoginSuccess}
      isRegister={false}
    />
  );
}
