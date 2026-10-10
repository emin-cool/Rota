import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { tr } from '@/i18n/tr';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

// Android'de OAuth tarayıcısından dönüşü tamamlamak için gerekli.
WebBrowser.maybeCompleteAuthSession();

/** Supabase/GoTrue hata mesajlarını Türkçe, kullanıcıya gösterilebilir metne çevirir. */
export function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const e = tr.auth.errors;
  if (/invalid login credentials/i.test(raw)) return e.invalidCredentials;
  if (/email not confirmed/i.test(raw)) return e.emailNotConfirmed;
  if (/already registered|already been registered/i.test(raw)) return e.alreadyRegistered;
  if (/password should be at least|weak password/i.test(raw)) return e.weakPassword;
  if (/rate limit|too many/i.test(raw)) return e.rateLimited;
  if (/network|fetch failed/i.test(raw)) return e.network;
  return e.generic;
}

function assertConfigured() {
  if (!isSupabaseConfigured) throw new Error(tr.auth.errors.notConfigured);
}

export async function signInWithEmail(email: string, password: string) {
  assertConfigured();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

/** `needsConfirmation: true` → Supabase'de e-posta doğrulama açık, oturum doğrulamadan sonra başlar. */
export async function signUpWithEmail(email: string, password: string) {
  assertConfigured();
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function sendPasswordReset(email: string) {
  assertConfigured();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: Linking.createURL('login'),
  });
  if (error) throw error;
}

/** Google: Supabase OAuth + sistem tarayıcısı (PKCE). Expo Go ve development build'de çalışır. */
export async function signInWithGoogle(): Promise<boolean> {
  assertConfigured();
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('OAuth URL alınamadı');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false; // kullanıcı vazgeçti

  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('OAuth kodu dönmedi');
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  return true;
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

/** Apple: yalnızca iOS, yerel akış (id token + nonce). */
export async function signInWithApple(): Promise<boolean> {
  assertConfigured();
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new Error('Apple kimlik jetonu alınamadı');

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) throw error;

    // Apple adı sadece ilk girişte verir; profildeki görünen ada yaz.
    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ');
    if (fullName) {
      await supabase.auth.updateUser({ data: { full_name: fullName } });
    }
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw e;
  }
}

export async function signOut() {
  await supabase.auth.signOut();
}
