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
const RegisterScreen = (): JSX.Element => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleSignUp = async (): Promise<void> => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("All fields are required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      const token = (result as { data?: { token?: string } }).data?.token;
      if (token !== undefined) {
        await SecureStore.setItemAsync("auth_token", token);
      }
      router.replace("/(tabs)");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign up failed");
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
          <Text style={s.title}>Create account</Text>

          {error !== null && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <View style={s.field}>
            <Text style={s.label}>Full name</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textPlaceholder}
              autoCapitalize="words"
              autoComplete="name"
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Email</Text>
            <TextInput
              ref={emailRef}
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textPlaceholder}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
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
              autoComplete="new-password"
              returnKeyType="go"
              onSubmitEditing={() => void handleSignUp()}
            />
            <Text style={s.hint}>At least 8 characters</Text>
          </View>

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={() => void handleSignUp()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={s.buttonText}>Create account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.linkRow} onPress={() => router.replace("/(auth)/login")}>
            <Text style={s.linkText}>Already have an account? </Text>
            <Text style={s.link}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default RegisterScreen;
