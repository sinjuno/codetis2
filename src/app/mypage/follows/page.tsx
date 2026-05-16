'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';

type FollowUser = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

const AVATAR_COLORS = ['#D6536D', '#E43D12', '#EFB11D', '#4CAF50', '#2196F3', '#9C27B0'];
const randColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

export default function FollowsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<'followers' | 'following'>('followers');
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [pendingFollowers, setPendingFollowers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Search popup
  const [showSearch, setShowSearch] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<FollowUser | 'not_found' | null>(null);
  const [followSent, setFollowSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/onboarding');
  }, [user, authLoading, router]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: followerRows }, { data: followingRows }, { data: pendingRows }] = await Promise.all([
      supabase.from('follows').select('follower_id')
        .eq('following_id', user.id)
        .or('status.is.null,status.eq.accepted'),
      supabase.from('follows').select('following_id')
        .eq('follower_id', user.id)
        .or('status.is.null,status.eq.accepted'),
      supabase.from('follows').select('follower_id')
        .eq('following_id', user.id)
        .eq('status', 'pending'),
    ]);

    const followerIds = (followerRows ?? []).map((r: any) => r.follower_id);
    const followingIds = (followingRows ?? []).map((r: any) => r.following_id);
    const pendingIds = (pendingRows ?? []).map((r: any) => r.follower_id);

    const [{ data: fp }, { data: fnp }, { data: pp }] = await Promise.all([
      followerIds.length > 0
        ? supabase.from('profiles').select('id, name, email, phone').in('id', followerIds)
        : Promise.resolve({ data: [] }),
      followingIds.length > 0
        ? supabase.from('profiles').select('id, name, email, phone').in('id', followingIds)
        : Promise.resolve({ data: [] }),
      pendingIds.length > 0
        ? supabase.from('profiles').select('id, name, email, phone').in('id', pendingIds)
        : Promise.resolve({ data: [] }),
    ]);

    setFollowers((fp ?? []) as FollowUser[]);
    setFollowing((fnp ?? []) as FollowUser[]);
    setPendingFollowers((pp ?? []) as FollowUser[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const handleSearch = async () => {
    if (!searchEmail.trim() || !user) return;
    setSearchLoading(true);
    setSearchResult(null);
    setFollowSent(false);

    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, phone')
      .eq('email', searchEmail.trim().toLowerCase())
      .single();

    if (!data || data.id === user.id) {
      setSearchResult('not_found');
    } else {
      setSearchResult(data as FollowUser);
      // 이미 팔로우 중인지 확인
      const { data: existing } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', data.id)
        .maybeSingle();
      if (existing) setFollowSent(true);
    }
    setSearchLoading(false);
  };

  const handleFollow = async (target: FollowUser) => {
    if (!user) return;
    await supabase.from('follows').insert({
      follower_id: user.id,
      following_id: target.id,
      status: 'pending',
    });
    setFollowSent(true);
    showToast(`${target.name}님에게 팔로우 요청을 보냈어요`);
  };

  const handleAccept = async (follower: FollowUser) => {
    if (!user) return;

    // pending → accepted
    await supabase.from('follows')
      .update({ status: 'accepted' })
      .eq('follower_id', follower.id)
      .eq('following_id', user.id);

    // 역방향 팔로우 추가 (내가 상대를 팔로우)
    await supabase.from('follows').upsert({
      follower_id: user.id,
      following_id: follower.id,
      status: 'accepted',
    }, { onConflict: 'follower_id,following_id' });

    // 서로 contacts에 추가
    const { data: myProfile } = await supabase
      .from('profiles').select('name, phone, birthday').eq('id', user.id).single();

    await Promise.all([
      supabase.from('connections').insert({
        user_id: user.id,
        name: follower.name,
        phone: follower.phone ?? '',
        avatar_color: randColor(),
        last_contact: new Date().toISOString().split('T')[0],
      }),
      supabase.from('connections').insert({
        user_id: follower.id,
        name: myProfile?.name ?? '',
        phone: myProfile?.phone ?? '',
        avatar_color: randColor(),
        last_contact: new Date().toISOString().split('T')[0],
      }),
    ]);

    setPendingFollowers((prev) => prev.filter((u) => u.id !== follower.id));
    setFollowers((prev) => [...prev, follower]);
    setFollowing((prev) => [...prev, follower]);
    showToast('맞팔로우! 서로의 연락처가 추가됐어요 🎉');
  };

  const handleReject = async (followerId: string) => {
    await supabase.from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', user!.id);
    setPendingFollowers((prev) => prev.filter((u) => u.id !== followerId));
    showToast('팔로우 요청을 거절했어요');
  };

  const handleUnfollow = async (targetId: string) => {
    if (!user) return;
    await supabase.from('follows').delete()
      .eq('follower_id', user.id).eq('following_id', targetId);
    setFollowing((prev) => prev.filter((u) => u.id !== targetId));
    showToast('팔로우를 취소했어요');
  };

  const openSearch = () => {
    setShowSearch(true);
    setSearchEmail('');
    setSearchResult(null);
    setFollowSent(false);
    setTimeout(() => inputRef.current?.focus(), 100);
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
      {/* 헤더 */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] z-40 flex items-center justify-between px-7 bg-picks-bg"
        style={{ height: '56px', paddingTop: 'env(safe-area-inset-top)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}
      >
        <button onClick={() => router.back()} className="p-1 -ml-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="text-[17px] font-bold text-picks-dark">팔로우 관리</span>
        <button
          onClick={openSearch}
          className="w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-90"
          style={{ background: '#fdf0f2' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D6536D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ paddingTop: '56px' }}>
        {/* 탭 */}
        <div className="flex border-b border-gray-100 bg-white">
          {(['followers', 'following'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-3.5 text-[14px] font-semibold transition-colors relative"
              style={{ color: tab === t ? '#D6536D' : '#9e9e9e' }}
            >
              {t === 'followers'
                ? `팔로워 ${followers.length + pendingFollowers.length}`
                : `팔로잉 ${following.length}`}
              {tab === t && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: '#D6536D' }} />
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-picks-rose border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* 팔로워 탭 */}
            {tab === 'followers' && (
              <div className="px-7 py-4 space-y-3">
                {/* 수락 대기 중인 팔로우 요청 */}
                {pendingFollowers.length > 0 && (
                  <div>
                    <p className="text-[12px] font-semibold text-gray-400 mb-2 uppercase tracking-wide">수락 대기 {pendingFollowers.length}</p>
                    {pendingFollowers.map((u) => (
                      <div key={u.id} className="picks-card p-4 flex items-center gap-3 mb-2">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #9C27B0, #2196F3)' }}
                        >
                          {u.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-picks-dark truncate">{u.name}</p>
                          <p className="text-[12px] text-gray-400 truncate">{u.email ?? ''}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleAccept(u)}
                            className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold text-white active:scale-95 transition-transform"
                            style={{ background: 'linear-gradient(135deg, #D6536D, #E43D12)' }}
                          >
                            수락
                          </button>
                          <button
                            onClick={() => handleReject(u.id)}
                            className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold bg-gray-100 text-gray-500 active:scale-95 transition-transform"
                          >
                            거절
                          </button>
                        </div>
                      </div>
                    ))}
                    {followers.length > 0 && (
                      <p className="text-[12px] font-semibold text-gray-400 mt-4 mb-2 uppercase tracking-wide">팔로워 {followers.length}</p>
                    )}
                  </div>
                )}

                {/* 수락된 팔로워 */}
                {followers.length === 0 && pendingFollowers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-7">
                    <span className="text-5xl mb-4">👥</span>
                    <p className="text-[15px] font-semibold text-picks-dark mb-1">아직 팔로워가 없어요</p>
                    <p className="text-[13px] text-gray-400 text-center">
                      + 버튼을 눌러 지인을 이메일로 찾아보세요
                    </p>
                  </div>
                ) : (
                  followers.map((u) => (
                    <div key={u.id} className="picks-card p-4 flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #D6536D, #E43D12)' }}
                      >
                        {u.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-picks-dark truncate">{u.name}</p>
                        {following.some((f) => f.id === u.id) && (
                          <p className="text-[12px]" style={{ color: '#D6536D' }}>서로 팔로우 중</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 팔로잉 탭 */}
            {tab === 'following' && (
              <div className="px-7 py-4 space-y-3">
                {following.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-7">
                    <span className="text-5xl mb-4">🔍</span>
                    <p className="text-[15px] font-semibold text-picks-dark mb-1">팔로잉 중인 사람이 없어요</p>
                    <p className="text-[13px] text-gray-400 text-center">
                      + 버튼을 눌러 이메일로 지인을 검색해보세요
                    </p>
                  </div>
                ) : (
                  following.map((u) => (
                    <div key={u.id} className="picks-card p-4 flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #D6536D, #E43D12)' }}
                      >
                        {u.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-picks-dark truncate">{u.name}</p>
                        {followers.some((f) => f.id === u.id) && (
                          <p className="text-[12px]" style={{ color: '#D6536D' }}>서로 팔로우 중</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleUnfollow(u.id)}
                        className="px-4 py-1.5 rounded-full text-[13px] font-semibold bg-gray-100 text-gray-500 active:scale-95 transition-transform flex-shrink-0"
                      >
                        언팔로우
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 이메일 검색 팝업 */}
      {showSearch && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSearch(false); }}
        >
          <div className="w-full max-w-[393px] bg-white rounded-t-3xl pt-6 pb-10 px-7">
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
            <h3 className="text-[18px] font-bold text-picks-dark mb-1">지인 검색</h3>
            <p className="text-[13px] text-gray-400 mb-5">이메일 주소로 지인을 찾아보세요</p>

            {/* 검색 입력 */}
            <div className="flex gap-2 mb-5">
              <input
                ref={inputRef}
                type="email"
                value={searchEmail}
                onChange={(e) => { setSearchEmail(e.target.value); setSearchResult(null); setFollowSent(false); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="example@email.com"
                className="flex-1 px-4 py-3 rounded-xl border text-[14px] text-picks-dark focus:outline-none transition-colors"
                style={{ borderColor: '#e5e5e5' }}
                onFocus={(e) => (e.target.style.borderColor = '#D6536D')}
                onBlur={(e) => (e.target.style.borderColor = '#e5e5e5')}
              />
              <button
                onClick={handleSearch}
                disabled={!searchEmail.trim() || searchLoading}
                className="px-5 py-3 rounded-xl font-semibold text-[14px] text-white disabled:opacity-50 active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #D6536D, #E43D12)' }}
              >
                {searchLoading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                ) : '검색'}
              </button>
            </div>

            {/* 검색 결과 */}
            {searchResult === 'not_found' && (
              <div className="flex flex-col items-center py-6 text-center">
                <span className="text-3xl mb-2">🔍</span>
                <p className="text-[14px] font-semibold text-picks-dark">사용자를 찾을 수 없어요</p>
                <p className="text-[12px] text-gray-400 mt-1">이메일 주소를 다시 확인해주세요</p>
              </div>
            )}

            {searchResult && searchResult !== 'not_found' && (
              <div className="picks-card p-4 flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #D6536D, #E43D12)' }}
                >
                  {searchResult.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-picks-dark truncate">{searchResult.name}</p>
                  <p className="text-[12px] text-gray-400 truncate">{searchResult.email}</p>
                </div>
                <button
                  onClick={() => !followSent && handleFollow(searchResult as FollowUser)}
                  disabled={followSent}
                  className="px-4 py-1.5 rounded-full text-[13px] font-semibold flex-shrink-0 active:scale-95 transition-all"
                  style={{
                    background: followSent ? '#f5f5f5' : 'linear-gradient(135deg, #D6536D, #E43D12)',
                    color: followSent ? '#999' : 'white',
                  }}
                >
                  {followSent ? '팔로잉' : '팔로우'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] toast-enter">
          <div className="bg-picks-dark text-white px-5 py-3 rounded-2xl shadow-lg text-[14px] font-medium whitespace-nowrap">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
