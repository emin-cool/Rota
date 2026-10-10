import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, HeadlineLg, Text } from '@/components/ui';
import { TextField } from '@/components/ui/TextField';
import { tr } from '@/i18n/tr';
import {
  authErrorMessage,
  isAppleSignInAvailable,
  sendPasswordReset,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

type Mode = 'login' | 'signup';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<null | 'email' | 'google' | 'apple' | 'reset'>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    void isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const emailError = touched && !EMAIL_RE.test(email.trim()) ? tr.auth.validation.email : null;
  const passwordError =
    touched && mode === 'signup' && password.length < 8 ? tr.auth.validation.passwordShort : null;

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    setInfo(null);
    try {
      await action();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const submitEmail = () => {
    setTouched(true);
    if (!EMAIL_RE.test(email.trim()) || password.length < (mode === 'signup' ? 8 : 1)) return;
    void run('email', async () => {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        const { needsConfirmation } = await signUpWithEmail(email, password);
        if (needsConfirmation) {
          setInfo(tr.auth.checkEmail);
          setMode('login');
        }
      }
      // Oturum açılınca kök layout otomatik olarak onboarding/ana ekrana yönlendirir.
    });
  };

  const forgot = () => {
    if (!EMAIL_RE.test(email.trim())) {
      setTouched(true);
      setError(tr.auth.enterEmailFirst);
      return;
    }
    void run('reset', async () => {
      await sendPasswordReset(email);
      setInfo(tr.auth.resetSent);
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-canvas"
    >
      <View className="h-14 flex-row items-center px-space-sm" style={{ marginTop: insets.top }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.common.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
          className="h-11 w-11 items-center justify-center rounded-full"
        >
          <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.ink.DEFAULT} />
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-space-md px-margin"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View className="gap-space-xs">
          <HeadlineLg>{tr.auth.title}</HeadlineLg>
          <Text variant="body-lg" className="text-ink-secondary">
            {tr.auth.subtitle}
          </Text>
        </View>

        {/* Segment: Giriş Yap / Kayıt Ol */}
        <View
          accessibilityRole="tablist"
          className="h-12 flex-row rounded-full bg-surface-container p-1"
        >
          {(['login', 'signup'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
              onPress={() => switchMode(m)}
              className={`flex-1 items-center justify-center rounded-full ${
                mode === m ? 'bg-white' : ''
              }`}
            >
              <Text
                variant="body-md-medium"
                className={mode === m ? 'font-bold text-brand' : 'text-ink-secondary'}
              >
                {m === 'login' ? tr.auth.tabLogin : tr.auth.tabSignup}
              </Text>
            </Pressable>
          ))}
        </View>

        {!isSupabaseConfigured ? (
          <View className="rounded-md bg-error-container p-space-md">
            <Text variant="body-md" className="text-on-error-container">
              {tr.auth.errors.notConfigured}
            </Text>
          </View>
        ) : null}

        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              mode === 'login'
                ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                : AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
            }
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={26}
            style={{ height: 52 }}
            onPress={() => void run('apple', async () => void (await signInWithApple()))}
          />
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.auth.google}
          disabled={busy !== null}
          onPress={() => void run('google', async () => void (await signInWithGoogle()))}
          className={`h-[52px] flex-row items-center justify-center gap-space-sm rounded-full border border-hairline bg-white active:bg-surface-container-low ${
            busy !== null ? 'opacity-50' : ''
          }`}
        >
          <AntDesign name="google" size={20} color={colors.ink.DEFAULT} />
          <Text variant="body-lg" className="font-bold">
            {tr.auth.google}
          </Text>
        </Pressable>

        <View className="flex-row items-center gap-space-md py-space-xs">
          <View className="h-px flex-1 bg-hairline" />
          <Text variant="label-sm" className="text-ink-muted">
            {tr.auth.orEmail}
          </Text>
          <View className="h-px flex-1 bg-hairline" />
        </View>

        <TextField
          label={tr.auth.emailLabel}
          icon="mail-outline"
          placeholder={tr.auth.emailPlaceholder}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          error={emailError}
        />
        <TextField
          label={tr.auth.passwordLabel}
          icon="lock-outline"
          placeholder={tr.auth.passwordPlaceholder}
          value={password}
          onChangeText={setPassword}
          passwordToggle
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          textContentType={mode === 'login' ? 'password' : 'newPassword'}
          onSubmitEditing={submitEmail}
          error={passwordError}
          labelAction={
            mode === 'login' ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                disabled={busy !== null}
                onPress={forgot}
              >
                <Text variant="label-sm" className="font-bold text-brand">
                  {tr.auth.forgot}
                </Text>
              </Pressable>
            ) : null
          }
        />

        {error ? (
          <Text variant="body-md" className="text-error" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        {info ? (
          <Text variant="body-md" className="text-brand" accessibilityLiveRegion="polite">
            {info}
          </Text>
        ) : null}

        <Button
          title={tr.auth.continueEmail}
          loading={busy === 'email' || busy === 'reset'}
          disabled={busy !== null}
          leading={<MaterialIcons name="arrow-forward" size={20} color={colors['on-primary']} />}
          onPress={submitEmail}
        />

        <View className="flex-row items-center justify-center gap-1">
          <Text variant="body-md" className="text-ink-secondary">
            {mode === 'login' ? tr.auth.noAccount : tr.auth.hasAccount}
          </Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}
          >
            <Text variant="body-md" className="font-bold text-brand">
              {mode === 'login' ? tr.auth.tabSignup : tr.auth.tabLogin}
            </Text>
          </Pressable>
        </View>

        <Text variant="label-sm" className="px-space-md text-center text-ink-muted">
          {tr.auth.legal}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
