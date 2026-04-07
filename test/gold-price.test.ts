import { describe, it, expect } from 'vitest';
import { parseNaverGoldPrice } from '@/lib/prices/gold';

// Regression: ISSUE-GOLD-PARSER — 금 시세 추출이 돈 단위 표(3,368,623원 = 4돈)의
// 일부분 "368,623"을 그램당 가격으로 잘못 매칭해서 잔고가 1.6배 부풀려졌음.
// 새 파서는 "고객출금" 라벨 다음 숫자를 잡아서 진짜 g당 매도가를 가져온다.
// Found by /qa on 2026-04-07. Report: ~/.gstack/projects/wealth-lens/

describe('parseNaverGoldPrice', () => {
  // 네이버 금 페이지의 실제 구조를 모방한 fixture
  // 첫 부분에 돈 단위 가격 표 (jin 단위, 0.01% 차이로 1g × 3.75 = 1돈)
  // 그 다음에 "계좌/실물" 매수가/매도가 표
  const fixtureHtml = `
    <html><body>
    <div class="goldPrice">
      <table>
        <tr><th>중량 기준</th><th>3.75g (1돈)</th><th>7.5g (2돈)</th><th>11.25g (3돈)</th><th>15g (4돈)</th><th>18.75g (5돈)</th><th>37.5g (10돈)</th></tr>
        <tr>
          <td></td>
          <td>842,155.91 원</td>
          <td>1,684,311.82 원</td>
          <td>2,526,467.73 원</td>
          <td>3,368,623.65 원</td>
          <td>4,210,779.56 원</td>
          <td>8,421,559.12 원</td>
        </tr>
      </table>
    </div>
    <div class="quote">
      <h3>고시가격</h3>
      <table>
        <tr><th>구분</th><th>현재가</th></tr>
        <tr><td>계좌 (고객입금 시)</td><td>226,820.65 원</td></tr>
        <tr><td>계좌 (고객출금 시)</td><td>222,329.17 원</td></tr>
        <tr><td>실물 (고객이 살 때)</td><td>235,803.65 원</td></tr>
        <tr><td>실물 (고객이팔 때)</td><td>213,346.17 원</td></tr>
      </table>
    </div>
    </body></html>
  `;

  it('계좌 고객출금 가격(g당 매도가)을 추출한다 (regression)', () => {
    const price = parseNaverGoldPrice(fixtureHtml);
    expect(price).toBe(222329);
  });

  it('돈 단위 표의 큰 숫자를 g당 가격으로 잘못 매칭하지 않는다', () => {
    const price = parseNaverGoldPrice(fixtureHtml);
    // 4돈 가격(3,368,623)의 일부분 "368,623"을 잡으면 안 됨
    expect(price).not.toBe(368623);
    // 1돈 가격(842,155)의 일부분 "842,155"도 잡으면 안 됨
    expect(price).not.toBe(842155);
    // 100k-500k 합리적 범위
    expect(price).toBeGreaterThan(100000);
    expect(price).toBeLessThan(500000);
  });

  it('고객출금 라벨이 없으면 고객입금으로 폴백한다', () => {
    const onlyBuyHtml = `
      <table>
        <tr><td>계좌 (고객입금 시)</td><td>226,820.65 원</td></tr>
      </table>
    `;
    expect(parseNaverGoldPrice(onlyBuyHtml)).toBe(226820);
  });

  it('아무 라벨도 없으면 null 반환', () => {
    expect(parseNaverGoldPrice('<html>no gold data here</html>')).toBeNull();
  });

  it('비합리적 범위(< 100k 또는 > 500k)는 거부', () => {
    const garbageHtml = `<table><tr><td>고객출금</td><td>50,000 원</td></tr></table>`;
    expect(parseNaverGoldPrice(garbageHtml)).toBeNull();
  });
});
