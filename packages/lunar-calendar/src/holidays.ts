/** Well-known Vietnamese lunar (âm lịch) holidays, keyed as "month-day". */
const LUNAR_HOLIDAYS: Record<string, string> = {
  "1-1": "Tết Nguyên Đán",
  "1-15": "Tết Nguyên Tiêu (Rằm tháng Giêng)",
  "3-3": "Tết Hàn Thực",
  "3-10": "Giỗ Tổ Hùng Vương",
  "5-5": "Tết Đoan Ngọ",
  "7-15": "Lễ Vu Lan",
  "8-15": "Tết Trung Thu",
  "10-15": "Tết Hạ Nguyên",
  "12-23": "Ông Công Ông Táo",
};

/** Common fixed solar (dương lịch) holidays observed in Vietnam, "month-day". */
const SOLAR_HOLIDAYS: Record<string, string> = {
  "1-1": "Tết Dương Lịch",
  "2-14": "Lễ Tình Nhân",
  "3-8": "Quốc Tế Phụ Nữ",
  "4-30": "Ngày Giải Phóng Miền Nam",
  "5-1": "Quốc Tế Lao Động",
  "6-1": "Quốc Tế Thiếu Nhi",
  "9-2": "Quốc Khánh",
  "10-20": "Ngày Phụ Nữ Việt Nam",
  "12-24": "Lễ Giáng Sinh (đêm)",
  "12-25": "Lễ Giáng Sinh",
};

export function getLunarHolidayName(month: number, day: number): string | undefined {
  return LUNAR_HOLIDAYS[`${month}-${day}`];
}

export function getSolarHolidayName(month: number, day: number): string | undefined {
  return SOLAR_HOLIDAYS[`${month}-${day}`];
}
