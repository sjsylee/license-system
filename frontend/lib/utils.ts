export function formatKST(dateStr: string, showTime = false): string {
  const date = new Date(dateStr)
  return date.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(showTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}

export function isToday(dateStr: string): boolean {
  const nowKST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
  const dKST = new Date(new Date(dateStr).toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
  return nowKST.toDateString() === dKST.toDateString()
}

export function daysUntil(dateStr: string): number {
  const now = new Date()
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}
