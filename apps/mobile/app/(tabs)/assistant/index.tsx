import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Sparkles } from "lucide-react-native";
import { Screen } from "../../../../components/Screen";
import { trpc } from "../../../../lib/trpc";
import { colors, radius, shadows } from "../../../../lib/tokens";

type Message = { id: string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What are my open tasks?",
  "Summarize recent meetings",
  "Search knowledge base",
];

const AssistantScreen = (): JSX.Element => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList<Message>>(null);

  const chatMutation = trpc.assistant.chat.useMutation({
    onSuccess: (data) => {
      const assistantMsg: Message = {
        id: String(Date.now()),
        role: "assistant",
        content: data.answer,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    },
    onError: (err) => {
      const errorMsg: Message = {
        id: String(Date.now()),
        role: "assistant",
        content: `Error: ${err.message}`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    },
  });

  const handleSend = (text?: string): void => {
    const msg = (text ?? input).trim();
    if (!msg || chatMutation.isPending) return;

    const userMsg: Message = { id: String(Date.now()), role: "user", content: msg };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    chatMutation.mutate({ message: msg, history });
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <Screen title="AI Assistant" scrollable={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        {messages.length === 0 ? (
          <View style={styles.welcome}>
            <View style={styles.welcomeIcon}>
              <Sparkles size={32} color={colors.brand} />
            </View>
            <Text style={styles.welcomeTitle}>How can I help?</Text>
            <Text style={styles.welcomeSubtitle}>
              Ask about your company data, tasks, meetings, or knowledge base.
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.chip}
                  onPress={() => handleSend(s)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.bubble,
                  item.role === "user" ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    item.role === "user" ? styles.userText : styles.assistantText,
                  ]}
                >
                  {item.content}
                </Text>
              </View>
            )}
          />
        )}

        {chatMutation.isPending && (
          <View style={styles.thinking}>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={styles.thinkingText}>Thinking...</Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything..."
            placeholderTextColor={colors.textPlaceholder}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={() => handleSend()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || chatMutation.isPending) && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!input.trim() || chatMutation.isPending}
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  welcome: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  welcomeIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.brandSubtle,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  suggestions: {
    marginTop: 20,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  list: { flex: 1 },
  listContent: { padding: 12, gap: 8 },
  bubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: radius.lg,
    marginBottom: 4,
  },
  userBubble: {
    backgroundColor: colors.brand,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: colors.surfaceCard,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    ...shadows.card,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  userText: { color: colors.white },
  assistantText: { color: colors.textPrimary },
  thinking: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  thinkingText: { fontSize: 13, color: colors.textSecondary },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    backgroundColor: colors.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: colors.white, fontWeight: "600", fontSize: 15 },
});

export default AssistantScreen;
