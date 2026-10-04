import type { CalendarEvent } from "../types.js";

/**
 * 経済指標カレンダー。
 *
 * 注意: ここでは外部 API キー不要で動くよう、「毎月の定例指標」を
 * ルールベースで生成した *目安* の予定を返します（正式な発表日時では
 * ありません）。実運用では getEvents() を Trading Economics / Finnhub /
 * Investing.com などの実データプロバイダに差し替えてください。
 */

interface MonthlyRule {
  title: string;
  country: string;
  importance: CalendarEvent["importance"];
  affectedCurrencies: string[];
  /** 発表時刻 (UTC, "HH:MM") */
  timeUtc: string;
  /** 毎月の発生日を決める関数 (year, monthIndex0) => day-of-month */
  dayOf: (year: number, month0: number) => number;
}

/** その月の第 n 曜日(0=日..6=土)の日付(1始まり)を返す */
function nthWeekdayOfMonth(
  year: number,
  month0: number,
  weekday: number,
  n: number,
): number {
  const first = new Date(Date.UTC(year, month0, 1));
  const firstWeekday = first.getUTCDay();
  let day = 1 + ((weekday - firstWeekday + 7) % 7);
  day += (n - 1) * 7;
  return day;
}

const MONTHLY_RULES: MonthlyRule[] = [
  {
    title: "米 雇用統計 (Nonfarm Payrolls)",
    country: "US",
    importance: "high",
    affectedCurrencies: ["USD", "JPY", "EUR"],
    timeUtc: "12:30",
    // 原則として第1金曜日
    dayOf: (y, m) => nthWeekdayOfMonth(y, m, 5, 1),
  },
  {
    title: "米 消費者物価指数 (CPI)",
    country: "US",
    importance: "high",
    affectedCurrencies: ["USD"],
    timeUtc: "12:30",
    dayOf: () => 13,
  },
  {
    title: "米 小売売上高 (Retail Sales)",
    country: "US",
    importance: "medium",
    affectedCurrencies: ["USD"],
    timeUtc: "12:30",
    dayOf: () => 16,
  },
  {
    title: "ユーロ圏 消費者物価指数 (HICP 速報)",
    country: "EU",
    importance: "medium",
    affectedCurrencies: ["EUR"],
    timeUtc: "09:00",
    // 月末付近
    dayOf: (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
  },
  {
    title: "日 全国消費者物価指数 (CPI)",
    country: "JP",
    importance: "medium",
    affectedCurrencies: ["JPY"],
    timeUtc: "23:30",
    dayOf: () => 19,
  },
  {
    title: "英 消費者物価指数 (CPI)",
    country: "GB",
    importance: "medium",
    affectedCurrencies: ["GBP"],
    timeUtc: "06:00",
    dayOf: () => 17,
  },
];

export interface CalendarQuery {
  /** 開始日 (ISO, 既定: 今日) */
  from?: string;
  /** 終了日 (ISO, 既定: from + 14日) */
  to?: string;
  /** 重要度でフィルタ */
  importance?: CalendarEvent["importance"];
  /** 通貨でフィルタ (例: "JPY") */
  currency?: string;
}

export interface CalendarResponse {
  from: string;
  to: string;
  note: string;
  events: CalendarEvent[];
}

const NOTE =
  "これは毎月の定例指標から生成した目安の予定です（正式な発表日時ではありません）。" +
  "正確な日時は各国統計機関の公式カレンダー、または実データプロバイダをご確認ください。";

/** 指定期間内の（目安の）経済指標イベントを返す */
export function getEvents(query: CalendarQuery = {}): CalendarResponse {
  const from = query.from ? new Date(query.from) : new Date();
  const to = query.to
    ? new Date(query.to)
    : new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("from / to は YYYY-MM-DD 形式で指定してください。");
  }

  const events: CalendarEvent[] = [];

  // from〜to にまたがる各月についてルールを展開
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));

  while (cursor <= end) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    for (const rule of MONTHLY_RULES) {
      const day = rule.dayOf(y, m);
      const [hh, mm] = rule.timeUtc.split(":").map(Number);
      const dt = new Date(Date.UTC(y, m, day, hh, mm));
      if (dt >= from && dt <= to) {
        events.push({
          datetime: dt.toISOString(),
          country: rule.country,
          title: rule.title,
          importance: rule.importance,
          affectedCurrencies: rule.affectedCurrencies,
        });
      }
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  let filtered = events;
  if (query.importance) {
    filtered = filtered.filter((e) => e.importance === query.importance);
  }
  if (query.currency) {
    const cur = query.currency.toUpperCase();
    filtered = filtered.filter((e) =>
      e.affectedCurrencies?.includes(cur),
    );
  }
  filtered.sort((a, b) => a.datetime.localeCompare(b.datetime));

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    note: NOTE,
    events: filtered,
  };
}
