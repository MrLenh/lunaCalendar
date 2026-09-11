import React, { useState } from "react";
import { Platform, View, Text, Pressable, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";

interface Props {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  mode: "date" | "time";
}

/**
 * A cross-platform date/time input.
 *
 * @react-native-community/datetimepicker has no web implementation, and its
 * combined "datetime" mode isn't available on Android, so this component:
 * - uses the native picker (mode "date" or "time") on iOS/Android, and
 * - falls back to a plain HTML <input> on web (react-native-web renders to
 *   real DOM, so a raw intrinsic element works fine here).
 */
export function DateTimeField({ label, value, onChange, mode }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  if (Platform.OS === "web") {
    const inputType = mode === "date" ? "date" : "time";
    const inputValue =
      mode === "date" ? dayjs(value).format("YYYY-MM-DD") : dayjs(value).format("HH:mm");

    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        {React.createElement("input", {
          type: inputType,
          value: inputValue,
          onChange: (e: { target: { value: string } }) => {
            const raw = e.target.value;
            if (!raw) return;
            const next =
              mode === "date"
                ? dayjs(value).set("year", Number(raw.slice(0, 4))).set("month", Number(raw.slice(5, 7)) - 1).set("date", Number(raw.slice(8, 10)))
                : dayjs(value).set("hour", Number(raw.slice(0, 2))).set("minute", Number(raw.slice(3, 5)));
            onChange(next.toDate());
          },
          style: {
            padding: 10,
            fontSize: 14,
            borderRadius: 8,
            border: "1px solid #c7ccd1",
            fontFamily: "inherit",
          },
        })}
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.button} onPress={() => setShowPicker(true)}>
        <Text style={styles.buttonText}>
          {dayjs(value).format(mode === "date" ? "DD/MM/YYYY" : "HH:mm")}
        </Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={value}
          mode={mode}
          display="default"
          onChange={(_event, selected) => {
            setShowPicker(Platform.OS === "ios"); // iOS inline picker stays open until dismissed
            if (selected) onChange(selected);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 12 },
  label: { marginBottom: 4, fontWeight: "600", fontSize: 13, color: "#333" },
  button: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c7ccd1",
    backgroundColor: "#fff",
  },
  buttonText: { fontSize: 14, color: "#111" },
});
