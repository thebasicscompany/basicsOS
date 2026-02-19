import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { authClient } from "../../lib/auth-client";
import { authStyles as s } from "../../lib/auth-styles";
import { colors } from "../../lib/tokens";

// Expo Router requires default export for layouts and screens.
const LoginScreen = (): JSX.Element => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const handleSignIn = async (): Promise<void> => {
    if (!email.trim() || !password.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      const token = (result as { data?: { token?: string } }).data?.token;
      if (token !== undefined) {
        await SecureStore.setItemAsync("auth_token", token);
      }
      router.replace("/(tabs)");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <View style={s.logoRow}>
            <View style={s.logo}>
              <Text style={s.logoText}>B</Text>
            </View>
            <Text style={s.appName}>Basics OS</Text>
          </View>
          <Text style={s.title}>Sign in</Text>

          {error !== null && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <View style={s.field}>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textPlaceholder}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Password</Text>
            <TextInput
              ref={passwordRef}
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
              placeholderTextColor={colors.textPlaceholder}
              secureTextEntry
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={() => void handleSignIn()}
            />
          </View>

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={() => void handleSignIn()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.buttonText}>Sign in</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.linkRow}
            onPress={() => router.replace("/(auth)/register")}
          >
            <Text style={s.linkText}>Don&apos;t have an account? </Text>
            <Text style={s.link}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
