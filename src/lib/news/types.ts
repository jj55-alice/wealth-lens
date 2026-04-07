export interface NewsItem {
  ticker: string;
  title: string;
  url: string;
  source: string; // 'naver' | 'yahoo' | publisher name
  publishedAt: string | null; // ISO date
  summary?: string | null;
}
