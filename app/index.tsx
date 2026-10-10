import { Redirect } from 'expo-router';

// Auth akışı P0.2'de gelecek; şimdilik doğrudan sekmelere git.
export default function Index() {
  return <Redirect href="/map" />;
}
