export function getYesterdayKSTRange() {
  const now = new Date();
  const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
  const kstNow = new Date(utc.getTime() + 9 * 60 * 60000);

  const start = new Date(kstNow); start.setDate(kstNow.getDate() - 1); start.setHours(0,0,0,0);
  const end   = new Date(kstNow); end.setHours(0,0,0,0);

  const pad = (n:number)=>String(n).padStart(2,'0');
  const toIsoKst = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+09:00`;

  return { dateFrom: toIsoKst(start), dateTo: toIsoKst(end) };
}