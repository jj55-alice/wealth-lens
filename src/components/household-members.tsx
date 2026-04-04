'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface Member {
  user_id: string;
  role: string;
  email: string;
  nickname: string | null;
  created_at: string;
}

interface Invitation {
  id: string;
  invitee_email: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export function HouseholdMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/invite');
        const data = await res.json();
        setMembers(data.members ?? []);
        setInvitations(data.invitations ?? []);
      } catch {
        // ignore
      }
    }
    load();
  }, []);

  async function handleInvite() {
    setSending(true);
    setError('');
    setInviteLink('');

    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '초대 실패');
        setSending(false);
        return;
      }

      const link = `${window.location.origin}/invite/${data.token}`;
      setInviteLink(link);
      setSending(false);
    } catch {
      setError('네트워크 오류');
      setSending(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            가구 구성원
          </h3>
          {members.length < 2 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setShowInvite(true)}
            >
              + 초대
            </Button>
          )}
        </div>

        {members.map((m) => (
          <div
            key={m.user_id}
            className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30"
          >
            <div>
              <p className="text-sm">{m.nickname || m.email}</p>
              {m.nickname && <p className="text-xs text-muted-foreground">{m.email}</p>}
            </div>
            <Badge variant="outline" className="text-[10px]">
              {m.role === 'owner' ? '관리자' : '구성원'}
            </Badge>
          </div>
        ))}

        {invitations.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground mt-2">대기 중인 초대</p>
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg border border-dashed border-border"
              >
                <p className="text-sm text-muted-foreground">{inv.invitee_email}</p>
                <Badge variant="outline" className="text-[10px] text-amber-500">
                  대기 중
                </Badge>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 초대 다이얼로그 */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>가족 초대</DialogTitle>
            <DialogDescription>
              배우자/파트너를 초대하면 자산을 함께 관리할 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          {!inviteLink ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>이메일</Label>
                <Input
                  type="email"
                  placeholder="partner@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInvite(false)}>
                  취소
                </Button>
                <Button onClick={handleInvite} disabled={!email || sending}>
                  {sending ? '보내는 중...' : '초대하기'}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-emerald-500">초대가 생성되었습니다.</p>
              <div className="space-y-1.5">
                <Label>초대 링크</Label>
                <div className="flex gap-2">
                  <Input value={inviteLink} readOnly className="text-xs" />
                  <Button variant="outline" size="sm" onClick={copyLink}>
                    복사
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  이 링크를 상대방에게 보내주세요. 7일 후 만료됩니다.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={() => { setShowInvite(false); setInviteLink(''); setEmail(''); window.location.reload(); }}>
                  확인
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
