/**
 * 한국어 숫자 포맷: 12억 3,400만 스타일
 */
export function formatKRW(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_0000_0000) {
    const eok = Math.floor(abs / 1_0000_0000);
    const man = Math.floor((abs % 1_0000_0000) / 1_0000);
    if (man > 0) {
      return `${sign}${eok.toLocaleString()}억 ${man.toLocaleString()}만`;
    }
    return `${sign}${eok.toLocaleString()}억`;
  }

  if (abs >= 1_0000) {
    const man = Math.floor(abs / 1_0000);
    return `${sign}${man.toLocaleString()}만`;
  }

  return `${sign}${abs.toLocaleString()}`;
}

/**
 * 변동률 포맷: +2.3% or -1.5%
 */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * 변동 금액 포맷: +1,200만 or -500만
 */
export function formatChange(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatKRW(value)}`;
}
