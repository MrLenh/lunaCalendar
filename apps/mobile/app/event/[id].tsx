import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import dayjs from "dayjs";
import type { CalendarEvent } from "@luna/shared-types";
import { EventForm } from "../../components/EventForm";
import * as api from "../../lib/api";
import type { NewEventInput } from "../../lib/api";

export default function EditEventScreen() {
  const params = useLocalSearchParams<{ id: string; event?: string }>();
  const router = useRouter();

  const [event, setEvent] = useState<CalendarEvent | null>(() => {
    if (!params.event) return null;
    try {
      return JSON.parse(params.event) as CalendarEvent;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(!event);
  const [error, setError] = useState<string | null>(null);

  // Fallback path for opening this screen without the event already in hand
  // (e.g. a direct deep link on web): the backend spec only guarantees a
  // ranged GET /events, so scan a generous window and find the id in it.
  useEffect(() => {
    if (event) return;
    (async () => {
      setIsLoading(true);
      try {
        // Backend expects date-only "YYYY-MM-DD" bounds, not full ISO timestamps.
        const from = dayjs().subtract(5, "year").startOf("year").format("YYYY-MM-DD");
        const to = dayjs().add(5, "year").endOf("year").format("YYYY-MM-DD");
        const results = await api.listEvents(from, to);
        const found = results.find((e) => e.id === params.id);
        if (found) setEvent(found);
        else setError("Không tìm thấy sự kiện.");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [event, params.id]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Không tìm thấy sự kiện."}</Text>
      </View>
    );
  }

  const handleSubmit = async (input: NewEventInput) => {
    await api.updateEvent(event.id, input);
    router.back();
  };

  const handleDelete = async () => {
    await api.deleteEvent(event.id);
    router.back();
  };

  return (
    <EventForm
      initialEvent={event}
      submitLabel="Lưu thay đổi"
      onSubmit={handleSubmit}
      onDelete={handleDelete}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { color: "#c0392b", textAlign: "center" },
});
