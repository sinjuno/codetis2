'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import type { Profile } from '@/lib/types';

const menuItems = [
  {
    id: 'follows',
    label: '팔로우 관리',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D6536D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    href: '/mypage/follows',
  },
  {
    id: 'account',
    label: '계정 관리',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D6536D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
    href: '/mypage/account',
  },
  {
    id: 'notifications',
    label: '알림 설정',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D6536D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
    href: '/notifications/settings',
  },
  {
    id: 'templates',
    label: '메시지 템플릿 관리',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D6536D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    href: '/mypage/templates',
  },
];

export default function MyPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [connectionCount, setConnectionCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/onboarding');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setDataLoading(true);
      const [{ data: profileData }, { data: connections }, { data: followerRows }, { data: followingRows }] =
        await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('connections').select('id').eq('user_id', user.id),
          supabase.from('follows').select('id').eq('following_id', user.id),
          supabase.from('follows').select('id').eq('follower_id', user.id),
        ]);
      setProfile(profileData as Profile ?? null);
      setConnectionCount((connections ?? []).length);
      setFollowerCount((followerRows ?? []).length);
      setFollowingCount((followingRows ?? []).length);
      setDataLoading(false);
    };
    fetchData();
  }, [user]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2000); };

  const handleCopyProfileLink = () => {
    if (!user) return;
    const url = `${window.location.origin}/profile/${user.id}`;
    navigator.clipboard.writeText(url).then(() => showToast('프로필 링크가 복사됐어요!'));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/onboarding');
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-picks-bg">
        <div className="w-6 h-6 border-2 border-picks-rose border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const displayName = profile?.name || user?.user_metadata?.name || '사용자';
  const displayEmail = user?.email ?? '';

  return (
    <div className="flex flex-col min-h-screen bg-picks-bg page-fade">
      <TopBar />

      <div className="flex-1 overflow-y-auto pb-24" style={{ paddingTop: '64px' }}>
        {/* Profile Card */}
        <div className="px-7 pt-6 pb-4">
          <div
            className="relative rounded-3xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #D6536D 0%, #E43D12 100%)' }}
          >
            {/* 배경 장식 */}
            <div
              className="absolute -top-8 -right-8 w-40 h-40 rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            />
            <div
              className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            />

            <div className="relative p-6">
              {/* 상단: 아바타 + 이름/이메일 */}
              <div className="flex items-center gap-4 mb-5">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}
                >
                  {displayName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-[20px] font-bold text-white leading-tight">{displayName}</h2>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
                    >
                      일반 회원
                    </span>
                  </div>
                  <p className="text-[13px] text-white/70 mt-1 truncate">{displayEmail}</p>
                </div>
              </div>

              {/* 구분선 */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginBottom: '16px' }} />

              {/* 하단: 연락처 연동 수 통계 */}
              {dataLoading ? (
                <div className="flex justify-center py-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-0">
                  {[
                    { value: String(connectionCount), label: '연락처' },
                    { value: String(followerCount), label: '팔로워' },
                    { value: String(followingCount), label: '팔로잉' },
                  ].map((stat, idx) => (
                    <div
                      key={stat.label}
                      className="flex flex-col items-center py-1"
                      style={{
                        borderRight: idx < 2 ? '1px solid rgba(255,255,255,0.15)' : 'none',
                      }}
                    >
                      <p className="text-[22px] font-bold text-white leading-tight">{stat.value}</p>
                      <p className="text-[11px] text-white/60 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Premium banner */}
        <div className="px-7 mb-4">
          <Link href="/mypage/premium">
          <div
            className="relative rounded-2xl p-5 overflow-hidden active:scale-95 transition-transform cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #E43D12 0%, #D6536D 100%)' }}
          >
            {/* Background decoration circles for depth */}
            <div
              className="absolute right-0 top-0 w-36 h-36 rounded-full"
              style={{ background: 'rgba(255,255,255,0.10)', transform: 'translate(35%, -35%)' }}
            />
            <div
              className="absolute left-0 bottom-0 w-24 h-24 rounded-full"
              style={{ background: 'rgba(255,255,255,0.07)', transform: 'translate(-30%, 30%)' }}
            />
            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[18px]">👑</span>
                    <span className="text-[15px] font-bold text-white tracking-wide">PICKS 프리미엄</span>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    무제한 관계 관리, AI 메시지 추천,
                    <br />
                    고급 분석 기능을 사용해보세요
                  </p>
                </div>
                <div
                  className="px-3 py-1.5 rounded-full text-[12px] font-bold flex-shrink-0 ml-3"
                  style={{ background: 'rgba(255,255,255,0.22)', color: 'white', border: '1px solid rgba(255,255,255,0.35)' }}
                >
                  구독하기
                </div>
              </div>
              <div className="flex gap-4 mt-4">
                {['무제한 관계', 'AI 추천', '통계 분석'].map((feat) => (
                  <span key={feat} className="text-[11px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    <span style={{ color: '#FFA2B6' }}>✓</span> {feat}
                  </span>
                ))}
              </div>
            </div>
          </div>
          </Link>
        </div>

        {/* Menu items */}
        <div className="px-7 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="picks-card p-4 flex items-center gap-3 block active:scale-95 transition-transform"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#fdf0f2' }}
              >
                {item.icon}
              </div>
              <span className="text-[15px] font-medium text-picks-dark flex-1">{item.label}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          ))}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="picks-card p-4 flex items-center gap-3 w-full mt-2 active:scale-95 transition-transform"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#fdf0f2' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E43D12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <span className="text-[15px] font-medium flex-1 text-left" style={{ color: '#E43D12' }}>로그아웃</span>
          </button>
        </div>

        <div className="px-7 mt-8 mb-4 flex flex-col items-center">
          <p className="text-[11px] text-gray-300">PICKS v1.0.0</p>
          <p className="text-[11px] text-gray-300 mt-1">© 2026 PICKS. All rights reserved.</p>
        </div>
      </div>

      <BottomNav />

      {toast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 toast-enter">
          <div className="bg-picks-dark text-white px-5 py-3 rounded-2xl shadow-lg text-[14px] font-medium whitespace-nowrap">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
