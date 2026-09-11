import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import dayjs from "dayjs";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import type { CalendarEvent } from "@luna/shared-types";
import { VN_TIMEZONE, getLunarHolidayName, getSolarHolidayName, solarToLunar } from "@luna/lunar-calendar";
import * as api from "../../lib/api";

export default function EventsScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(() =>
    params.date ? dayjs(params.date) : dayjs()
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep in sync when navigated here with a specific ?date= from the calendar tab.
  useEffect(() => {
    if (params.date) setSelectedDate(dayjs(params.date));
  }, [params.date]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Backend expects date-only "YYYY-MM-DD" bounds, not full ISO timestamps.
      const from = selectedDate.format("YYYY-MM-DD");
      const to = selectedDate.format("YYYY-MM-DD");
      const result = await api.listEvents(from, to);
      result.sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
      setEvents(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const lunar = solarToLunar(selectedDate.date(), selectedDate.month() + 1, selectedDate.year(), VN_TIMEZONE);
  const holidayName =
    getSolarHolidayName(selectedDate.month() + 1, selectedDate.date()) ??
    getLunarHolidayName(lunar.month, lunar.day);

  const handleDelete = (event: CalendarEvent) => {
    Alert.alert("Xóa sự kiện", `Xóa "${event.title}"?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteEvent(event.id);
            load();
          } catch (err) {
            Alert.alert("Lỗi", err instanceof Error ? err.message : String(err));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.dayHeader}>
        <Pressable onPress={() => setSelectedDate((d) => d.subtract(1, "day"))} style={styles.dayNav}>
          <Text style={styles.dayNavText}>‹</Text>
        </Pressable>
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={styles.dayTitle}>{selectedDate.format("dddd, DD/MM/YYYY")}</Text>
          <Text style={styles.lunarLine}>
            Âm lịch {lunar.day}/{lunar.month}{lunar.isLeapMonth ? " (nhuận)" : ""}/{lunar.year}
          </Text>
          {holidayName && <Text style={styles.holidayLine}>{holidayName}</Text>}
        </View>
        <Pressable onPress={() => setSelectedDate((d) => d.add(1, "day"))} style={styles.dayNav}>
          <Text style={styles.dayNavText}>›</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.createButton}
        onPress={() =>
          router.push({ pathname: "/event/new", params: { date: selectedDate.format("YYYY-MM-DD") } })
        }
      >
        <Text style={styles.createButtonText}>+ Thêm sự kiện</Text>
      </Pressable>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Không có sự kiện nào trong ngày này.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.eventCard}
              onPress={() =>
                router.push({
                  pathname: "/event/[id]",
                  // Pass the event we already have in hand so the edit screen can
                  // render instantly; it re-fetches in the background as a fallback
                  // for the case where it's opened directly (e.g. a deep link).
                  params: { id: item.id, event: JSON.stringify(item) },
                })
              }
              onLongPress={() => handleDelete(item)}
            >
              <Text style={styles.eventTitle}>{item.title}</Text>
              <Text style={styles.eventMeta}>
                {item.allDay
                  ? "Cả ngày"
                  : `${dayjs(item.startAt).format("HH:mm")} - ${dayjs(item.endAt).format("HH:mm")}`}
                {item.location ? `  •  ${item.location}` : ""}
              </Text>
              {item.recurrence && (
                <Text style={styles.recurrenceBadge}>
                  {item.recurrence.type === "lunar" ? "Lặp lại theo Âm lịch" : "Lặp lại theo Dương lịch"}
                </Text>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  dayNav: { padding: 10, width: 40, alignItems: "center" },
  dayNavText: { fontSize: 22, color: "#2f6690" },
  dayTitle: { fontSize: 16, fontWeight: "700", color: "#1c2b39", textTransform: "capitalize" },
  lunarLine: { fontSize: 12, color: "#5c6b77", marginTop: 2 },
  holidayLine: { fontSize: 12, color: "#c0392b", marginTop: 2, fontWeight: "600" },
  createButton: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#2f6690",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  createButtonText: { color: "#fff", fontWeight: "600" },
  errorText: { color: "#c0392b", textAlign: "center", marginTop: 12 },
  emptyText: { textAlign: "center", color: "#8a8f98", marginTop: 24 },
  eventCard: {
    backgroundColor: "#f4f6f8",
    borderRadius: 10,
    padding: 14,
  },
  eventTitle: { fontSize: 15, fontWeight: "600", color: "#1c2b39" },
  eventMeta: { fontSize: 13, color: "#5c6b77", marginTop: 4 },
  recurrenceBadge: { fontSize: 11, color: "#2f6690", marginTop: 6, fontWeight: "600" },
});
