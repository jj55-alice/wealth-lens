'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface KbComplex {
  complexId: string;
  complexName: string;
  address: string;
  totalHousehold: number;
}

interface KbArea {
  areaId: string;
  exclusiveArea: number;
  supplyArea: number;
}

interface KbPriceInfo {
  dealPrice: number;
  jeonsePrice: number;
  priceDate: string;
}

interface Props {
  onPriceFound: (price: number, complexId: string, name: string, address: string) => void;
  onManualFallback: () => void;
  realEstateType: string;
}

function formatManwon(manwon: number): string {
  const uk = Math.floor(manwon / 10000);
  const remainder = manwon % 10000;
  if (uk > 0 && remainder > 0) return `${uk}억 ${remainder.toLocaleString('ko-KR')}만원`;
  if (uk > 0) return `${uk}억`;
  return `${manwon.toLocaleString('ko-KR')}만원`;
}

export function KbSearch({ onPriceFound, onManualFallback, realEstateType }: Props) {
  const [query, setQuery] = useState('');
  const [complexes, setComplexes] = useState<KbComplex[]>([]);
  const [selectedComplex, setSelectedComplex] = useState<KbComplex | null>(null);
  const [areas, setAreas] = useState<KbArea[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [priceInfo, setPriceInfo] = useState<KbPriceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search complexes
  useEffect(() => {
    if (!query || query.length < 2 || selectedComplex) {
      setComplexes([]);
      setOpen(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/kb-search?action=search&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setComplexes(data);
          setOpen(data.length > 0);
          setNotFound(data.length === 0 && query.length >= 2);
        }
      } catch {
        setComplexes([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [query, selectedComplex]);

  // Load areas when complex selected
  useEffect(() => {
    if (!selectedComplex) {
      setAreas([]);
      return;
    }
    async function loadAreas() {
      const res = await fetch(`/api/kb-search?action=areas&complexId=${selectedComplex!.complexId}`);
      const data = await res.json();
      if (Array.isArray(data)) setAreas(data);
    }
    loadAreas();
  }, [selectedComplex]);

  // Load price when area selected
  useEffect(() => {
    if (!selectedComplex) return;
    async function loadPrice() {
      setLoading(true);
      let url = `/api/kb-search?action=price&complexId=${selectedComplex!.complexId}`;
      if (selectedAreaId) url += `&areaId=${selectedAreaId}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data && (data.dealPrice || data.jeonsePrice)) {
        setPriceInfo(data);
        const price = realEstateType === 'jeonse' ? data.jeonsePrice : data.dealPrice;
        if (price > 0) {
          onPriceFound(
            price * 10000, // 만원 → 원
            selectedComplex!.complexId,
            selectedComplex!.complexName,
            selectedComplex!.address
          );
        }
      } else {
        setPriceInfo(null);
      }
      setLoading(false);
    }
    loadPrice();
  }, [selectedComplex, selectedAreaId, realEstateType, onPriceFound]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelectComplex(complex: KbComplex) {
    setSelectedComplex(complex);
    setQuery(complex.complexName);
    setOpen(false);
    setNotFound(false);
  }

  function handleReset() {
    setSelectedComplex(null);
    setQuery('');
    setAreas([]);
    setPriceInfo(null);
    setSelectedAreaId('');
    setNotFound(false);
  }

  return (
    <div ref={containerRef} className="space-y-3">
      {/* 단지 검색 */}
      <div className="space-y-1.5">
        <Label>아파트 단지 검색</Label>
        <div className="relative">
          <Input
            aria-label="아파트 검색"
            placeholder="아파트명 검색 (예: 래미안, 자이)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selectedComplex) handleReset();
            }}
            maxLength={100}
          />
          {selectedComplex && (
            <button
              type="button"
              onClick={handleReset}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
            >
              ✕
            </button>
          )}
          {loading && !selectedComplex && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          )}
        </div>

        {/* 검색 결과 */}
        {open && complexes.length > 0 && (
          <div className="rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
            {complexes.map((c) => (
              <button
                key={c.complexId}
                type="button"
                onClick={() => handleSelectComplex(c)}
                className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm font-medium">{c.complexName}</p>
                <p className="text-xs text-muted-foreground">{c.address} · {c.totalHousehold}세대</p>
              </button>
            ))}
          </div>
        )}

        {/* 검색 결과 없음 */}
        {notFound && !selectedComplex && (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
            <p className="text-muted-foreground">
              KB시세 검색 결과가 없습니다.
            </p>
            <button
              type="button"
              onClick={onManualFallback}
              className="text-primary text-xs mt-1 hover:underline"
            >
              직접 입력하기 →
            </button>
          </div>
        )}
      </div>

      {/* 면적 선택 */}
      {selectedComplex && areas.length > 0 && (
        <div className="space-y-1.5">
          <Label>전용면적</Label>
          <Select value={selectedAreaId} onValueChange={(v) => v && setSelectedAreaId(v)}>
            <SelectTrigger><SelectValue placeholder="면적 선택" /></SelectTrigger>
            <SelectContent>
              {areas.map((a) => (
                <SelectItem key={a.areaId} value={a.areaId}>
                  {a.exclusiveArea}㎡ (공급 {a.supplyArea}㎡)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* KB시세 표시 */}
      {priceInfo && (
        <div className="rounded-lg bg-muted/30 border border-border px-4 py-3 space-y-1">
          <p className="text-xs text-muted-foreground">KB시세 ({priceInfo.priceDate})</p>
          <div className="flex gap-4">
            <div>
              <p className="text-xs text-muted-foreground">매매</p>
              <p className={`text-base font-bold ${realEstateType !== 'jeonse' ? 'text-primary' : ''}`}>
                {priceInfo.dealPrice > 0 ? formatManwon(priceInfo.dealPrice) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">전세</p>
              <p className={`text-base font-bold ${realEstateType === 'jeonse' ? 'text-primary' : ''}`}>
                {priceInfo.jeonsePrice > 0 ? formatManwon(priceInfo.jeonsePrice) : '-'}
              </p>
            </div>
          </div>
          {loading && (
            <p className="text-xs text-muted-foreground">시세 조회 중...</p>
          )}
        </div>
      )}
    </div>
  );
}
