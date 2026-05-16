'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import { getDaysUntilBirthday, formatBirthday } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import type { Connection, CalendarEvent } from '@/lib/types';

function parseVCard(text: string): { name: string; phone: string }[] {
  const results: { name: string; phone: string }[] = [];
  const cards = text.split(/END:VCARD/i);
  for (const card of cards) {
    if (!card.includes('BEGIN:VCARD')) continue;
    let name = '';
    let phone = '';
    let cellPhone = '';
    for (const raw of card.split(/\r?\n/)) {
      const line = raw.trim();
      if (/^FN:/i.test(line)) {
        name = line.replace(/^FN:/i, '').trim();
      } else if (!name && /^N:/i.test(line)) {
        const parts = line.replace(/^N:/i, '').split(';');
        name = [parts[1], parts[0]].filter(Boolean).join(' ').trim();
      }
      if (/^TEL[^:]*:/i.test(line)) {
        const val = line.split(':').slice(1).join(':').trim().replace(/[\s\-().]/g, '');
        let num = val.startsWith('+82') ? '0' + val.slice(3) : val.startsWith('82') && val.length >= 11 ? '0' + val.slice(2) : val;
        num = num.replace(/[^\d]/g, '');
        const fmt = num.length === 11 ? `${num.slice(0,3)}-${num.slice(3,7)}-${num.slice(7)}` : num.length === 10 ? `${num.slice(0,3)}-${num.slice(3,6)}-${num.slice(6)}` : num;
        if (/CELL|MOBILE|IPHONE/i.test(line)) { cellPhone = fmt; }
        else if (!phone) { phone = fmt; }
      }
    }
    const finalPhone = cellPhone || phone;
    if (name) results.push({ name, phone: finalPhone });
  }
  return results;
}

const todayBase = new Date();
todayBase.setHours(0, 0, 0, 0);
const todayTs = todayBase.getTime();

type BannerItem = {
  id: string;
  type: 'birthday' | 'appointment';
  name: string;
  phone: string;
  label: string;
  sub: string;
  color: string;
  daysUntil: number;
  gradient: string;
};

function buildBannerItems(connections: Connection[], events: CalendarEvent[]): BannerItem[] {
  const birthdayItems: BannerItem[] = connections
    .filter((c) => c.birthday)
    .map((c) => {
      const daysUntil = getDaysUntilBirthday(c.birthday!);
      return {
        id: `bday-${c.id}`,
        type: 'birthday' as const,
        name: c.name,
        phone: c.phone ?? '',
        label: daysUntil === 0 ? '오늘 생일 🎂' : `생일 D-${daysUntil}`,
        sub: formatBirthday(c.birthday!),
        color: c.avatar_color,
        daysUntil,
        gradient: `linear-gradient(135deg, ${c.avatar_color} 0%, #E43D12 100%)`,
      };
    })
    .filter((b) => b.daysUntil <= 14)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const appointmentItems: BannerItem[] = events
    .map((ev) => {
      const evDate = new Date(ev.date);
      const diff = Math.ceil((evDate.getTime() - todayTs) / 86400000);
      return {
        id: `ev-${ev.id}`,
        type: 'appointment' as const,
        name: ev.title,
        phone: '',
        label: diff === 0 ? '오늘 약속 📅' : diff === 1 ? '내일 약속 📅' : `약속 D-${diff}`,
        sub: ev.memo ?? '',
        color: ev.color,
        daysUntil: diff,
        gradient: `linear-gradient(135deg, ${ev.color} 0%, #1a1a1a 60%)`,
      };
    })
    .filter((ev) => ev.daysUntil >= 0 && ev.daysUntil <= 14)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return [...birthdayItems, ...appointmentItems]
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);
}

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [current, setCurrent] = useState(0);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ count: number } | null>(null);
  const [vcfContacts, setVcfContacts] = useState<{ name: string; phone: string }[]>([]);
  const [selectedVcf, setSelectedVcf] = useState<Set<number>>(new Set());
  const [vcfSaving, setVcfSaving] = useState(false);
  const [showContactPickerGuide, setShowContactPickerGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (user) return;
    const guest = typeof window !== 'undefined' && localStorage.getItem('picks_is_guest') === 'true';
    if (guest) {
      setIsGuest(true);
      try {
        const saved = localStorage.getItem('picks_guest_contacts');
        if (saved) setConnections(JSON.parse(saved));
      } catch { /* ignore */ }
      setDataLoading(false);
    } else {
      router.replace('/onboarding');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    if (user.user_metadata?.contact_synced) return;
    const supportsContactPicker =
      typeof navigator !== 'undefined' &&
      'contacts' in navigator &&
      'select' in (navigator as any).contacts;
    if (supportsContactPicker) {
      setShowSyncModal(true);
    } else {
      setShowContactPickerGuide(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setDataLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const twoWeeksLater = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

      const [{ data: conns }, { data: evs }] = await Promise.all([
        supabase.from('connections').select('*').eq('user_id', user.id),
        supabase
          .from('calendar_events')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', today)
          .lte('date', twoWeeksLater),
      ]);
      setConnections((conns as Connection[]) ?? []);
      setEvents((evs as CalendarEvent[]) ?? []);
      setDataLoading(false);
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (!syncResult) return;
    const t = setTimeout(() => setSyncResult(null), 3000);
    return () => clearTimeout(t);
  }, [syncResult]);

  const bannerItems = buildBannerItems(connections, events);

  useEffect(() => {
    if (bannerItems.length === 0) return;
    const t = setInterval(() => setCurrent((p) => (p + 1) % bannerItems.length), 3000);
    return () => clearInterval(t);
  }, [bannerItems.length]);

  const now = new Date();
  const thisMonthContacts = connections.filter((c) => {
    if (!c.last_contact) return false;
    const last = new Date(c.last_contact);
    return last.getMonth() === now.getMonth() && last.getFullYear() === now.getFullYear();
  }).length;

  const noContactCount = connections.filter((c) => {
    if (!c.last_contact) return false;
    const days = Math.floor((Date.now() - new Date(c.last_contact).getTime()) / 86400000);
    return days > 30;
  }).length;

  const handleContactSync = async () => {
    if (!user) return;

    const supportsContactPicker =
      typeof navigator !== 'undefined' &&
      'contacts' in navigator &&
      'select' in (navigator as any).contacts;

    if (!supportsContactPicker) {
      setShowContactPickerGuide(true);
      return;
    }

    try {
      setSyncLoading(true);
      const selected = await (navigator as any).contacts.select(['name', 'tel'], { multiple: true });

      if (!selected || selected.length === 0) {
        setSyncLoading(false);
        return;
      }

      const colors = ['#D6536D', '#E43D12', '#EFB11D', '#4CAF50', '#2196F3', '#9C27B0', '#FF5722', '#00BCD4'];
      const rows = selected
        .map((c: any) => ({
          user_id: user.id,
          name: (c.name?.[0] || '').trim() || '이름 없음',
          phone: (c.tel?.[0] || '').replace(/\s/g, ''),
          avatar_color: colors[Math.floor(Math.random() * colors.length)],
        }))
        .filter((r: any) => r.name !== '이름 없음' || r.phone);

      if (rows.length > 0) {
        await supabase.from('connections').insert(rows);
        const { data } = await supabase.from('connections').select('*').eq('user_id', user.id);
        setConnections((data as Connection[]) ?? []);
        setSyncResult({ count: rows.length });
        await supabase.auth.updateUser({ data: { contact_synced: true } });
      }

      setSyncLoading(false);
      setShowSyncModal(false);
    } catch {
      setSyncLoading(false);
    }
  };

  const handleVcfFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseVCard(text);
      if (parsed.length === 0) return;
      setVcfContacts(parsed);
      setSelectedVcf(new Set(parsed.map((_, i) => i)));
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const toggleVcfSelect = (i: number) => {
    setSelectedVcf((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleVcfSubmit = async () => {
    if (!user || selectedVcf.size === 0) return;
    setVcfSaving(true);
    const colors = ['#D6536D', '#E43D12', '#EFB11D', '#4CAF50', '#2196F3', '#9C27B0'];
    const rows = [...selectedVcf].map((i) => ({
      user_id: user.id,
      name: vcfContacts[i].name,
      phone: vcfContacts[i].phone,
      avatar_color: colors[Math.floor(Math.random() * colors.length)],
    }));
    await supabase.from('connections').insert(rows);
    const { data } = await supabase.from('connections').select('*').eq('user_id', user.id);
    setConnections((data as Connection[]) ?? []);
    setSyncResult({ count: rows.length });
    setVcfSaving(false);
    setVcfContacts([]);
    setSelectedVcf(new Set());
    setShowSyncModal(false);
  };

  const showCall = (phone: string) => {
    if (phone) window.location.href = `tel:${phone.replace(/-/g, '')}`;
  };
  const showSms = (phone: string) => {
    if (phone) window.location.href = `sms:${phone.replace(/-/g, '')}`;
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-picks-bg">
        <div className="w-6 h-6 border-2 border-picks-rose border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-picks-bg page-fade">
      <TopBar />

      <div className="flex-1 overflow-y-auto pb-24" style={{ paddingTop: '64px' }}>

        {/* 비회원 안내 배너 */}
        {isGuest && (
          <div className="mx-7 mt-4 px-4 py-3 rounded-2xl flex items-center justify-between" style={{ background: '#fdf0f2' }}>
            <p className="text-[12px] text-gray-500">비회원 모드 — 데이터가 저장되지 않아요</p>
            <button
              onClick={() => router.push('/signup')}
              className="text-[12px] font-bold px-3 py-1 rounded-full text-white"
              style={{ background: '#D6536D' }}
            >
              가입하기
            </button>
          </div>
        )}

        {/* ── 이번 주 일정 배너 (edge-to-edge) ── */}
        <div className="mt-4">
          <div className="px-7 mb-3 flex items-center justify-between">
            <h3 className="text-[16px] font-bold text-picks-dark">이번 주 일정</h3>
            <Link href="/calendar" className="text-[13px] font-medium" style={{ color: '#D6536D' }}>
              전체 보기
            </Link>
          </div>

          {dataLoading ? (
            <div
              className="flex items-center justify-center"
              style={{
                height: '180px',
                background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
              }}
            >
              <div className="w-5 h-5 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : bannerItems.length > 0 ? (
            <div className="relative" style={{ height: '180px' }}>
              {bannerItems.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => router.push('/contacts/bulk-send')}
                  className="absolute inset-0 transition-opacity duration-500 flex flex-col justify-between cursor-pointer"
                  style={{
                    background: item.gradient,
                    opacity: idx === current ? 1 : 0,
                    pointerEvents: idx === current ? 'auto' : 'none',
                    padding: '20px 28px',
                  }}
                >
                  {/* 상단: 라벨 */}
                  <div>
                    <span
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.22)', color: 'white' }}
                    >
                      {item.label}
                    </span>
                  </div>

                  {/* 하단: 이름 + 버튼 */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-white text-[24px] font-bold leading-tight">{item.name}</p>
                      <p className="text-white/70 text-[13px] mt-1">{item.sub}</p>
                    </div>

                    {/* 전화 & 메시지 버튼 */}
                    {item.phone && (
                      <div className="flex gap-2 mb-1">
                        <button
                          onClick={() => showCall(item.phone)}
                          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                          style={{ background: 'rgba(255,255,255,0.25)' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.07 11.5a19.79 19.79 0 01-3.07-8.67A2 2 0 013 .84h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => showSms(item.phone)}
                          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                          style={{ background: 'rgba(255,255,255,0.25)' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* 인디케이터 도트 (배너 안 하단) */}
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                {bannerItems.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrent(idx)}
                    style={{
                      width: idx === current ? '20px' : '6px',
                      height: '6px',
                      borderRadius: '3px',
                      background: idx === current ? 'white' : 'rgba(255,255,255,0.4)',
                      transition: 'all 0.3s',
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center"
              style={{
                height: '180px',
                background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
              }}
            >
              <p className="text-white/50 text-[14px] mb-2">이번 주 예정된 일정이 없습니다</p>
              <Link
                href="/calendar/new"
                className="text-[13px] font-semibold px-4 py-1.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
              >
                + 일정 추가하기
              </Link>
            </div>
          )}
        </div>

        {/* ── 빠른 실행 ── */}
        <div className="px-7 mt-6">
          <h3 className="text-[16px] font-bold text-picks-dark mb-3">빠른 실행</h3>
          <div className="flex flex-col gap-3">
            <Link href="/contacts/new" className="picks-card p-4 flex items-center gap-3 active:scale-95 transition-transform">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fdf0f2' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D6536D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </div>
              <span className="text-[13px] font-semibold text-picks-dark">관계 추가</span>
            </Link>
            <Link href="/contacts/bulk-send" className="picks-card p-4 flex items-center gap-3 active:scale-95 transition-transform">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fdf0f2' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D6536D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </div>
              <span className="text-[13px] font-semibold text-picks-dark">일괄 전송</span>
            </Link>
            <Link href="/calendar/new" className="picks-card p-4 flex items-center gap-3 active:scale-95 transition-transform">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fdf0f2' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D6536D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="12" y1="14" x2="12" y2="18" /><line x1="10" y1="16" x2="14" y2="16" />
                </svg>
              </div>
              <span className="text-[13px] font-semibold text-picks-dark">일정 추가</span>
            </Link>
          </div>
        </div>

        {/* ── 관계 현황 대시보드 ── */}
        <div className="px-7 mt-6 mb-4">
          <h3 className="text-[16px] font-bold text-picks-dark mb-3">관계 현황</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="picks-card p-4 text-center">
              <p className="text-[26px] font-bold" style={{ color: '#D6536D' }}>{thisMonthContacts}</p>
              <p className="text-[11px] text-gray-400 mt-1 leading-snug">이번 달<br />연락</p>
            </div>
            <div className="picks-card p-4 text-center">
              <p className="text-[26px] font-bold" style={{ color: '#E43D12' }}>{noContactCount}</p>
              <p className="text-[11px] text-gray-400 mt-1 leading-snug">오래 연락<br />안 한 사람</p>
            </div>
            <div className="picks-card p-4 text-center">
              <p className="text-[16px] font-bold" style={{ color: '#EFB11D' }}>활발</p>
              <p className="text-[11px] text-gray-400 mt-1 leading-snug">최근<br />활동</p>
            </div>
          </div>
        </div>

      </div>

      <BottomNav />

      {/* 연락처 연동 성공 토스트 */}
      {syncResult && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 toast-enter">
          <div className="bg-picks-dark text-white px-5 py-3.5 rounded-2xl shadow-lg text-[14px] font-medium text-center whitespace-nowrap">
            {syncResult.count}명의 연락처가 추가됐어요 🎉
          </div>
        </div>
      )}

      {/* Contact Picker API 미지원 안내 팝업 */}
      {showContactPickerGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-[340px] bg-white rounded-3xl p-7">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl mx-auto mb-4" style={{ background: '#fdf0f2' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D6536D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="text-[17px] font-bold text-picks-dark text-center mb-2">연락처 접근 권한 필요</h3>
            <p className="text-[13px] text-gray-500 text-center leading-relaxed mb-5">
              Safari에서 연락처 불러오기를 사용하려면<br />아래 설정을 켜주세요.
            </p>
            <div className="bg-gray-50 rounded-2xl px-4 py-4 mb-5">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-[13px] font-bold text-picks-rose flex-shrink-0">1.</span>
                <span className="text-[13px] text-picks-dark"><span className="font-semibold">설정</span> 앱 열기</span>
              </div>
              <div className="flex items-start gap-2 mb-2">
                <span className="text-[13px] font-bold text-picks-rose flex-shrink-0">2.</span>
                <span className="text-[13px] text-picks-dark"><span className="font-semibold">Safari</span> → <span className="font-semibold">고급</span> → <span className="font-semibold">기능 플래그</span></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[13px] font-bold text-picks-rose flex-shrink-0">3.</span>
                <span className="text-[13px] text-picks-dark"><span className="font-semibold">Contact Picker API</span> 켜기</span>
              </div>
            </div>
            <button
              onClick={() => setShowContactPickerGuide(false)}
              className="w-full py-3.5 rounded-2xl font-semibold text-[15px] text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #D6536D 0%, #E43D12 100%)' }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 연락처 연동 모달 */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-[393px] bg-white rounded-t-3xl pt-7 pb-10" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-6 flex-shrink-0" />

            {vcfContacts.length === 0 ? (
              /* ── 방법 선택 화면 ── */
              <div className="px-7">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl mx-auto mb-4" style={{ background: '#fdf0f2' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D6536D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <polyline points="17 11 19 13 23 9" />
                  </svg>
                </div>
                <h2 className="text-[20px] font-bold text-picks-dark text-center mb-2">연락처 연동하기</h2>
                <p className="text-[14px] text-gray-400 text-center leading-relaxed mb-6">
                  핸드폰 연락처를 연동하면<br />소중한 관계를 더 쉽게 관리할 수 있어요
                </p>
                <button
                  onClick={handleContactSync}
                  disabled={syncLoading}
                  className="w-full py-4 rounded-2xl font-semibold text-[16px] text-white mb-3 transition-all active:scale-95 disabled:opacity-70"
                  style={{ background: 'linear-gradient(135deg, #D6536D 0%, #E43D12 100%)' }}
                >
                  {syncLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      불러오는 중...
                    </span>
                  ) : '연락처 앱에서 불러오기'}
                </button>
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="w-full py-3.5 rounded-2xl font-semibold text-[15px] text-gray-400 bg-gray-100 transition-all active:scale-95"
                >
                  다음에 할게요
                </button>
              </div>
            ) : (
              /* ── 연락처 선택 화면 ── */
              <>
                <div className="px-7 flex-shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-[18px] font-bold text-picks-dark">연락처 선택</h2>
                    <span className="text-[13px] font-medium" style={{ color: '#D6536D' }}>{selectedVcf.size}명 선택됨</span>
                  </div>
                  <p className="text-[13px] text-gray-400 mb-3">추가할 연락처를 선택해주세요 ({vcfContacts.length}명 인식됨)</p>
                  <button
                    onClick={() => setSelectedVcf(selectedVcf.size === vcfContacts.length ? new Set() : new Set(vcfContacts.map((_, i) => i)))}
                    className="text-[13px] font-semibold mb-3"
                    style={{ color: '#D6536D' }}
                  >
                    {selectedVcf.size === vcfContacts.length ? '전체 해제' : '전체 선택'}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-7 min-h-0">
                  {vcfContacts.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => toggleVcfSelect(i)}
                      className="w-full flex items-center gap-3 py-3 border-b border-gray-50 active:bg-gray-50 text-left"
                    >
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{ background: selectedVcf.has(i) ? '#D6536D' : 'transparent', borderColor: selectedVcf.has(i) ? '#D6536D' : '#ddd' }}
                      >
                        {selectedVcf.has(i) && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-picks-dark truncate">{c.name}</p>
                        <p className="text-[12px] text-gray-400">{c.phone || '번호 없음'}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="px-7 pt-4 flex-shrink-0">
                  <button
                    onClick={handleVcfSubmit}
                    disabled={vcfSaving || selectedVcf.size === 0}
                    className="w-full py-4 rounded-2xl font-semibold text-[16px] text-white mb-3 transition-all active:scale-95 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #D6536D 0%, #E43D12 100%)' }}
                  >
                    {vcfSaving ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        저장 중...
                      </span>
                    ) : `${selectedVcf.size}명 추가하기`}
                  </button>
                  <button
                    onClick={() => { setVcfContacts([]); setSelectedVcf(new Set()); }}
                    className="w-full py-3.5 rounded-2xl font-semibold text-[15px] text-gray-400 bg-gray-100 transition-all active:scale-95"
                  >
                    취소
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
