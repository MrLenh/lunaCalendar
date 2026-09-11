import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";

export interface SegmentOption<T extends string> {
  label: string;
  value: T;
}

interface Props<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** A small pill-button chooser, used for recurrence mode/frequency/end-mode pickers. */
export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c7ccd1",
    backgroundColor: "#fff",
  },
  segmentSelected: { backgroundColor: "#2f6690", borderColor: "#2f6690" },
  segmentText: { color: "#333", fontSize: 13 },
  segmentTextSelected: { color: "#fff", fontWeight: "600" },
});
