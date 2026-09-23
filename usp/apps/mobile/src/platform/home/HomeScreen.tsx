import { Placeholder } from '../../shared/Placeholder';
import { useMeName } from '../auth/auth';

export default function HomeScreen() {
  return <Placeholder title={{ ar: 'الرئيسية', en: 'Home' }} feature="platform.home" root person={useMeName()} />;
}
