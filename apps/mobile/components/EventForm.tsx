import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Switch,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import dayjs from "dayjs";
import type { CalendarEvent, RecurrenceRule, SolarRecurrenceFreq } from "@luna/shared-types";
import {
  expandLunarRecurrence,
  type LeapMonthPolicy,
  type LunarRecurrenceFreq,
  type LunarRecurrenceRule,
  type SolarDate,
} from "@luna/lunar-calendar";
import type { NewEventInput } from "../lib/api";
import { SegmentedControl } from "./SegmentedControl";
import { DateTimeField } from "./DateTimeField";

type RecurrenceMode = "none" | "solar" | "lunar";
type EndMode = "never" | "count" | "until";

interface Props {
  initialEvent?: CalendarEvent;
  /** YYYY-MM-DD default start date, used only for a brand new event. */
  defaultDate?: string;
  submitLabel: string;
  onSubmit: (input: NewEventInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}

function toSolarDate(d: Date): SolarDate {
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

function solarDateToJsDate(d: SolarDate): Date {
  return new Date(d.year, d.month - 1, d.day);
}

function intervalUnitLabel(freq: SolarRecurrenceFreq): string {
  switch (freq) {
    case "daily":
      return "ngày";
    case "weekly":
      return "tuần";
    case "monthly":
      return "tháng";
    case "yearly":
      return "năm";
    default:
      return "";
  }
}

export function EventForm({ initialEvent, defaultDate, submitLabel, onSubmit, onDelete }: Props) {
  const baseDate = defaultDate ? dayjs(defaultDate) : dayjs();
  const initialRecurrence = initialEvent?.recurrence;

  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [location, setLocation] = useState(initialEvent?.location ?? "");
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const [allDay, setAllDay] = useState(initialEvent?.allDay ?? false);
  const [startDate, setStartDate] = useState<Date>(
    initialEvent ? new Date(initialEvent.startAt) : baseDate.hour(9).minute(0).second(0).toDate()
  );
  const [endDate, setEndDate] = useState<Date>(
    initialEvent ? new Date(initialEvent.endAt) : baseDate.hour(10).minute(0).second(0).toDate()
  );

  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>(
    initialRecurrence ? initialRecurrence.type : "none"
  );

  // ---- Solar (Duong lich) recurrence fields ----
  const [solarFreq, setSolarFreq] = useState<SolarRecurrenceFreq>(
    initialRecurrence?.type === "solar" ? initialRecurrence.freq : "weekly"
  );
  const [solarInterval, setSolarInterval] = useState(
    String(initialRecurrence?.type === "solar" ? initialRecurrence.interval ?? 1 : 1)
  );
  const [solarEndMode, setSolarEndMode] = useState<EndMode>(
    initialRecurrence?.type === "solar" && initialRecurrence.count
      ? "count"
      : initialRecurrence?.type === "solar" && initialRecurrence.until
        ? "until"
        : "never"
  );
  const [solarCount, setSolarCount] = useState(
    String(initialRecurrence?.type === "solar" ? initialRecurrence.count ?? 5 : 5)
  );
  const [solarUntil, setSolarUntil] = useState<Date>(
    initialRecurrence?.type === "solar" && initialRecurrence.until
      ? new Date(initialRecurrence.until)
      : dayjs(startDate).add(3, "month").toDate()
  );

  // ---- Lunar (Am lich) recurrence fields ----
  const [lunarFreq, setLunarFreq] = useState<LunarRecurrenceFreq>(
    initialRecurrence?.type === "lunar" ? initialRecurrence.freq : "yearly"
  );
  const [lunarInterval, setLunarInterval] = useState(
    String(initialRecurrence?.type === "lunar" ? initialRecurrence.interval ?? 1 : 1)
  );
  const [leapMonthPolicy, setLeapMonthPolicy] = useState<LeapMonthPolicy>(
    initialRecurrence?.type === "lunar" ? initialRecurrence.leapMonthPolicy ?? "same-month" : "same-month"
  );
  const [lunarEndMode, setLunarEndMode] = useState<EndMode>(
    initialRecurrence?.type === "lunar" && initialRecurrence.count
      ? "count"
      : initialRecurrence?.type === "lunar" && initialRecurrence.until
        ? "until"
        : "never"
  );
  const [lunarCount, setLunarCount] = useState(
    String(initialRecurrence?.type === "lunar" ? initialRecurrence.count ?? 5 : 5)
  );
  const [lunarUntil, setLunarUntil] = useState<Date>(
    initialRecurrence?.type === "lunar" && initialRecurrence.until
      ? solarDateToJsDate(initialRecurrence.until)
      : dayjs(startDate).add(5, "year").toDate()
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const lunarRule: LunarRecurrenceRule | null = useMemo(() => {
    if (recurrenceMode !== "lunar") return null;
    return {
      type: "lunar",
      freq: lunarFreq,
      interval: Math.max(1, parseInt(lunarInterval, 10) || 1),
      anchor: toSolarDate(startDate),
      leapMonthPolicy,
      count: lunarEndMode === "count" ? Math.max(1, parseInt(lunarCount, 10) || 1) : undefined,
      until: lunarEndMode === "until" ? toSolarDate(lunarUntil) : undefined,
    };
  }, [recurrenceMode, lunarFreq, lunarInterval, startDate, leapMonthPolicy, lunarEndMode, lunarCount, lunarUntil]);

  // Live preview of the next few lunar occurrences - the headline feature of
  // this app, so it must visibly reflect whatever the user is configuring.
  const lunarPreview = useMemo(() => {
    if (!lunarRule) return [];
    const rangeStart = toSolarDate(startDate);
    const rangeEnd = toSolarDate(dayjs(startDate).add(30, "year").toDate());
    try {
      return expandLunarRecurrence(lunarRule, rangeStart, rangeEnd).slice(0, 5);
    } catch {
      return [];
    }
  }, [lunarRule, startDate]);

  const buildRecurrence = (): RecurrenceRule | undefined => {
    if (recurrenceMode === "none") return undefined;
    if (recurrenceMode === "lunar") return lunarRule ?? undefined;
    return {
      type: "solar",
      freq: solarFreq,
      interval: Math.max(1, parseInt(solarInterval, 10) || 1),
      count: solarEndMode === "count" ? Math.max(1, parseInt(solarCount, 10) || 1) : undefined,
      until: solarEndMode === "until" ? dayjs(solarUntil).format("YYYY-MM-DD") : undefined,
    };
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Thiếu tiêu đề", "Vui lòng nhập tiêu đề sự kiện.");
      return;
    }
    if (dayjs(endDate).isBefore(dayjs(startDate))) {
      Alert.alert("Thời gian không hợp lệ", "Thời gian kết thúc phải sau thời gian bắt đầu.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        startAt: allDay ? dayjs(startDate).format("YYYY-MM-DD") : dayjs(startDate).toISOString(),
        endAt: allDay ? dayjs(endDate).format("YYYY-MM-DD") : dayjs(endDate).toISOString(),
        allDay,
        timeZone: "Asia/Ho_Chi_Minh",
        recurrence: buildRecurrence(),
        provider: initialEvent?.provider ?? "local",
        providerEventId: initialEvent?.providerEventId,
        providerCalendarId: initialEvent?.providerCalendarId,
      });
    } catch (err) {
      Alert.alert("Lỗi", err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Tiêu đề</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Tiêu đề sự kiện" />

      <Text style={styles.label}>Địa điểm</Text>
      <TextInput
        style={styles.input}
        value={location}
        onChangeText={setLocation}
        placeholder="Địa điểm (tùy chọn)"
      />

      <Text style={styles.label}>Mô tả</Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        value={description}
        onChangeText={setDescription}
        placeholder="Mô tả (tùy chọn)"
        multiline
      />

      <View style={styles.rowBetween}>
        <Text style={styles.label}>Cả ngày</Text>
        <Switch value={allDay} onValueChange={setAllDay} />
      </View>

      <DateTimeField label="Ngày bắt đầu" mode="date" value={startDate} onChange={setStartDate} />
      {!allDay && <DateTimeField label="Giờ bắt đầu" mode="time" value={startDate} onChange={setStartDate} />}
      <DateTimeField label="Ngày kết thúc" mode="date" value={endDate} onChange={setEndDate} />
      {!allDay && <DateTimeField label="Giờ kết thúc" mode="time" value={endDate} onChange={setEndDate} />}

      <Text style={styles.sectionTitle}>Lặp lại</Text>
      <SegmentedControl<RecurrenceMode>
        value={recurrenceMode}
        onChange={setRecurrenceMode}
        options={[
          { label: "Không lặp lại", value: "none" },
          { label: "Lặp theo Dương lịch", value: "solar" },
          { label: "Lặp theo Âm lịch", value: "lunar" },
        ]}
      />

      {recurrenceMode === "solar" && (
        <View style={styles.recurrenceBox}>
          <Text style={styles.label}>Tần suất</Text>
          <SegmentedControl<SolarRecurrenceFreq>
            value={solarFreq}
            onChange={setSolarFreq}
            options={[
              { label: "Hàng ngày", value: "daily" },
              { label: "Hàng tuần", value: "weekly" },
              { label: "Hàng tháng", value: "monthly" },
              { label: "Hàng năm", value: "yearly" },
            ]}
          />
          <Text style={styles.label}>Lặp lại mỗi</Text>
          <View style={styles.intervalRow}>
            <TextInput
              style={[styles.input, styles.intervalInput]}
              keyboardType="number-pad"
              value={solarInterval}
              onChangeText={setSolarInterval}
            />
            <Text>{intervalUnitLabel(solarFreq)}</Text>
          </View>
          <Text style={styles.label}>Kết thúc</Text>
          <SegmentedControl<EndMode>
            value={solarEndMode}
            onChange={setSolarEndMode}
            options={[
              { label: "Không bao giờ", value: "never" },
              { label: "Sau N lần", value: "count" },
              { label: "Vào ngày", value: "until" },
            ]}
          />
          {solarEndMode === "count" && (
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={solarCount}
              onChangeText={setSolarCount}
              placeholder="Số lần lặp lại"
            />
          )}
          {solarEndMode === "until" && (
            <DateTimeField label="Đến ngày" mode="date" value={solarUntil} onChange={setSolarUntil} />
          )}
        </View>
      )}

      {recurrenceMode === "lunar" && (
        <View style={styles.recurrenceBox}>
          <Text style={styles.label}>Tần suất</Text>
          <SegmentedControl<LunarRecurrenceFreq>
            value={lunarFreq}
            onChange={setLunarFreq}
            options={[
              { label: "Hàng tháng (âm lịch)", value: "monthly" },
              { label: "Hàng năm (âm lịch)", value: "yearly" },
            ]}
          />
          <Text style={styles.label}>Lặp lại mỗi</Text>
          <View style={styles.intervalRow}>
            <TextInput
              style={[styles.input, styles.intervalInput]}
              keyboardType="number-pad"
              value={lunarInterval}
              onChangeText={setLunarInterval}
            />
            <Text>{lunarFreq === "yearly" ? "năm âm lịch" : "tháng âm lịch"}</Text>
          </View>

          {lunarFreq === "yearly" && (
            <>
              <Text style={styles.label}>Nếu năm đó không có tháng nhuận tương ứng</Text>
              <SegmentedControl<LeapMonthPolicy>
                value={leapMonthPolicy}
                onChange={setLeapMonthPolicy}
                options={[
                  { label: "Dùng tháng thường", value: "same-month" },
                  { label: "Bỏ qua năm đó", value: "skip" },
                ]}
              />
            </>
          )}

          <Text style={styles.label}>Kết thúc</Text>
          <SegmentedControl<EndMode>
            value={lunarEndMode}
            onChange={setLunarEndMode}
            options={[
              { label: "Không bao giờ", value: "never" },
              { label: "Sau N lần", value: "count" },
              { label: "Vào ngày", value: "until" },
            ]}
          />
          {lunarEndMode === "count" && (
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={lunarCount}
              onChangeText={setLunarCount}
              placeholder="Số lần lặp lại"
            />
          )}
          {lunarEndMode === "until" && (
            <DateTimeField label="Đến ngày (dương lịch)" mode="date" value={lunarUntil} onChange={setLunarUntil} />
          )}

          <Text style={styles.previewTitle}>Xem trước các lần lặp lại tiếp theo</Text>
          {lunarPreview.length === 0 ? (
            <Text style={styles.previewEmpty}>Chưa tìm thấy ngày phù hợp trong phạm vi xem trước.</Text>
          ) : (
            lunarPreview.map((d, i) => (
              <Text key={i} style={styles.previewItem}>
                {i + 1}. {dayjs(solarDateToJsDate(d)).format("dddd, DD/MM/YYYY")}
              </Text>
            ))
          )}
        </View>
      )}

      <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>{submitLabel}</Text>
        )}
      </Pressable>

      {onDelete && (
        <Pressable
          style={styles.deleteButton}
          onPress={() =>
            Alert.alert("Xóa sự kiện", "Bạn có chắc muốn xóa sự kiện này?", [
              { text: "Hủy", style: "cancel" },
              { text: "Xóa", style: "destructive", onPress: onDelete },
            ])
          }
        >
          <Text style={styles.deleteButtonText}>Xóa sự kiện</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 60 },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginBottom: 4, marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1c2b39", marginTop: 20, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#c7ccd1",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginBottom: 4,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  intervalRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  intervalInput: { width: 70, marginBottom: 0 },
  recurrenceBox: {
    backgroundColor: "#f4f6f8",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  previewTitle: { fontSize: 13, fontWeight: "700", color: "#1c2b39", marginTop: 14, marginBottom: 6 },
  previewEmpty: { fontSize: 13, color: "#8a8f98" },
  previewItem: { fontSize: 13, color: "#2f6690", marginBottom: 2, textTransform: "capitalize" },
  submitButton: {
    backgroundColor: "#2f6690",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 24,
  },
  submitButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  deleteButton: {
    borderWidth: 1,
    borderColor: "#c0392b",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  deleteButtonText: { color: "#c0392b", fontWeight: "700" },
});
