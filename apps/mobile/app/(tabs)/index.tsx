import { useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, useWindowDimensions } from "react-native";
import dayjs, { type Dayjs } from "dayjs";
import { useRouter } from "expo-router";
import { buildMonthGrid, lunarMonthSpanLabel, WEEKDAY_LABELS, type DayCell } from "../../lib/calendarGrid";
import { useCalendarDisplay } from "../../context/CalendarDisplayContext";

export default function CalendarScreen() {
  const [monthAnchor, setMonthAnchor] = useState<Dayjs>(() => dayjs().startOf("month"));
  const { displayMode } = useCalendarDisplay();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const weeks = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);
  const lunarSpan = useMemo(() => lunarMonthSpanLabel(monthAnchor), [monthAnchor]);
  // Cap the grid width so cells stay a sane size on wide desktop-browser windows.
  const gridWidth = Math.min(width, 560);
  const cellSize = gridWidth / 7;

  const goToDay = (cell: DayCell) => {
    router.push({ pathname: "/(tabs)/events", params: { date: cell.date.format("YYYY-MM-DD") } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.navButton}
          onPress={() => setMonthAnchor((m) => m.subtract(1, "month"))}
        >
          <Text style={styles.navButtonText}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setMonthAnchor(dayjs().startOf("month"))} style={styles.headerCenter}>
          <Text style={styles.monthTitle}>
            Tháng {monthAnchor.month() + 1}, {monthAnchor.year()}
          </Text>
          <Text style={styles.lunarSpan}>{lunarSpan}</Text>
        </Pressable>
        <Pressable
          style={styles.navButton}
          onPress={() => setMonthAnchor((m) => m.add(1, "month"))}
        >
          <Text style={styles.navButtonText}>›</Text>
        </Pressable>
      </View>

      <View style={[styles.weekdayRow, { width: gridWidth, alignSelf: "center" }]}>
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} style={{ width: cellSize, alignItems: "center" }}>
            <Text style={styles.weekdayLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <FlatList
        style={{ alignSelf: "center", width: gridWidth }}
        data={weeks}
        keyExtractor={(week) => week[0].date.format("YYYY-MM-DD")}
        renderItem={({ item: week }) => (
          <View style={styles.weekRow}>
            {week.map((cell) => (
              <DayCellView
                key={cell.date.format("YYYY-MM-DD")}
                cell={cell}
                size={cellSize}
                displayMode={displayMode}
                onPress={() => goToDay(cell)}
              />
            ))}
          </View>
        )}
      />
    </View>
  );
}

function DayCellView({
  cell,
  size,
  displayMode,
  onPress,
}: {
  cell: DayCell;
  size: number;
  displayMode: "lunar" | "solar" | "both";
  onPress: () => void;
}) {
  const showLunar = displayMode !== "solar";
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.dayCell,
        { width: size, height: size * 1.05 },
        cell.isWeekend && styles.weekendCell,
        cell.isToday && styles.todayCell,
      ]}
    >
      <Text
        style={[
          styles.solarDay,
          !cell.isCurrentMonth && styles.mutedText,
          cell.isToday && styles.todayText,
        ]}
      >
        {cell.date.date()}
      </Text>
      {showLunar && (
        <Text style={[styles.lunarDay, !cell.isCurrentMonth && styles.mutedText]}>
          {cell.isLunarMonthStart
            ? `${cell.lunar.isLeapMonth ? "N" : ""}${cell.lunar.day}/${cell.lunar.month}`
            : cell.lunar.day}
        </Text>
      )}
      {cell.holidayName && (
        <Text numberOfLines={1} style={styles.holidayCaption}>
          {cell.holidayName}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerCenter: { alignItems: "center", flex: 1 },
  navButton: { padding: 10, width: 44, alignItems: "center" },
  navButtonText: { fontSize: 24, color: "#2f6690" },
  monthTitle: { fontSize: 18, fontWeight: "700", color: "#1c2b39" },
  lunarSpan: { fontSize: 12, color: "#5c6b77", marginTop: 2 },
  weekdayRow: { flexDirection: "row", paddingBottom: 4 },
  weekdayLabel: { fontSize: 12, fontWeight: "600", color: "#8a8f98" },
  weekRow: { flexDirection: "row" },
  dayCell: {
    borderWidth: 0.5,
    borderColor: "#eceff1",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 4,
  },
  weekendCell: { backgroundColor: "#fbf6f0" },
  todayCell: { backgroundColor: "#e3f0f9" },
  solarDay: { fontSize: 16, fontWeight: "600", color: "#1c2b39" },
  todayText: { color: "#2f6690" },
  mutedText: { color: "#c2c8ce" },
  lunarDay: { fontSize: 10, color: "#8a8f98", marginTop: 1 },
  holidayCaption: { fontSize: 8, color: "#c0392b", marginTop: 1, maxWidth: "100%" },
});
