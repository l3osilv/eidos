import LoginForm from '../components/LoginForm';
import { User } from '../types';

interface RegisterProps {
  onLoginSuccess: (user: User) => void;
}

export default function Register({ onLoginSuccess }: RegisterProps) {
  return (
    <LoginForm
      onLoginSuccess={onLoginSuccess}
      isRegister={true}
    />
  );
}
