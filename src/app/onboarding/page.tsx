'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { mockImportContacts } from '@/lib/mockData';
import { formatPhone } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface PhoneContact {
  id: string;
  name: string;
  phone: string;
}

const BASE_CATEGORIES = ['친구', '가족', '비즈니스'];
const AVATAR_COLORS = ['#D6536D', '#EFB11D', '#E43D12', '#FFA2B6', '#4CAF50', '#2196F3'];

async function fetchPhoneContacts(): Promise<PhoneContact[] | null> {
  if (typeof navigator !== 'undefined' && 'contacts' in navigator) {
    try {
      // @ts-expect-error contacts API is experimental
      const raw = await navigator.contacts.select(['name', 'tel'], { multiple: true });
      return (raw as Array<{ name?: string[]; tel?: string[] }>).map((c, i) => ({
        id: `phone-${i}`,
        name: c.name?.[0] ?? '이름 없음',
        phone: formatPhone(c.tel?.[0] ?? ''),
      }));
    } catch {
      return null;
    }
  }
  return undefined as unknown as null;
}

export default function OnboardingPage() {
  const router = useRouter();

  const [showSyncPopup, setShowSyncPopup] = useState(false);
  const [step, setStep] = useState<'list' | 'category'>('list');
  const [contactList, setContactList] = useState<PhoneContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState('');

  const [categories, setCategories] = useState<string[]>(BASE_CATEGORIES);
  const [pickedCategory, setPickedCategory] = useState('친구');
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleAutoSync = async () => {
    setSyncing(true);
    const real = await fetchPhoneContacts();
    setSyncing(false);

    if (real === null) return;
    const list = real ?? mockImportContacts;

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const userId = session.user.id;
      const defaultCategory = '친구';
      for (let i = 0; i < list.length; i++) {
        const contact = list[i];
        await supabase.from('connections').insert({
          user_id: userId,
          name: contact.name,
          phone: contact.phone,
          category: defaultCategory,
          avatar_color: AVATAR_COLORS[i % AVATAR_COLORS.length],
          last_contact: new Date().toISOString().split('T')[0],
        });
      }
      await supabase
        .from('user_categories')
        .upsert({ user_id: userId, name: defaultCategory }, { onConflict: 'user_id,name' });
    } else {
      const guestContacts = list.map((c, i) => ({
        id: `guest-${i}`,
        user_id: 'guest',
        name: c.name,
        phone: c.phone,
        category: '친구',
        avatar_color: AVATAR_COLORS[i % AVATAR_COLORS.length],
        last_contact: new Date().toISOString().split('T')[0],
      }));
      localStorage.setItem('picks_guest_contacts', JSON.stringify(guestContacts));
      localStorage.setItem('picks_is_guest', 'true');
    }

    showToast(`${list.length}명의 연락처가 연동되었습니다!`);
    setTimeout(() => router.push('/home'), 2000);
  };

  const handleOpenManual = async () => {
    setLoading(true);
    const real = await fetchPhoneContacts();
    setLoading(false);

    if (real === null) return;

    const list: PhoneContact[] = real ?? mockImportContacts;
    setContactList(list);
    setSelected(new Set());
    setStep('list');
  };

  const toggleContact = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  const handleGoCategory = () => {
    if (selected.size === 0) return;
    setStep('category');
  };

  const confirmNewCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    if (!categories.includes(name)) {
      setCategories((prev) => [...prev, name]);
    }
    setPickedCategory(name);
    setNewCatName('');
    setShowNewCatInput(false);
  };

  const handleSave = async () => {
    const count = selected.size;
    const selectedContacts = contactList.filter((c) => selected.has(c.id));

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const userId = session.user.id;
      for (let i = 0; i < selectedContacts.length; i++) {
        const contact = selectedContacts[i];
        await supabase.from('connections').insert({
          user_id: userId,
          name: contact.name,
          phone: contact.phone,
          category: pickedCategory,
          avatar_color: AVATAR_COLORS[i % AVATAR_COLORS.length],
          last_contact: new Date().toISOString().split('T')[0],
        });
      }
      await supabase
        .from('user_categories')
        .upsert({ user_id: userId, name: pickedCategory }, { onConflict: 'user_id,name' });
    } else {
      const guestContacts = selectedContacts.map((c, i) => ({
        id: `guest-${i}`,
        user_id: 'guest',
        name: c.name,
        phone: c.phone,
        category: pickedCategory,
        avatar_color: AVATAR_COLORS[i % AVATAR_COLORS.length],
        last_contact: new Date().toISOString().split('T')[0],
      }));
      localStorage.setItem('picks_guest_contacts', JSON.stringify(guestContacts));
      localStorage.setItem('picks_is_guest', 'true');
    }

    setShowSyncPopup(false);
    showToast(`${count}명이 [${pickedCategory}] 카테고리로 저장되었습니다!`);
    setTimeout(() => router.push('/home'), 2000);
  };

  const selectedContacts = contactList.filter((c) => selected.has(c.id));

  return (
    <div className="flex flex-col min-h-screen bg-picks-bg page-fade">

      {/* 메인 화면 */}
      <div className="flex-1 flex flex-col items-center justify-center px-7 pt-16">
        <div className="mb-8">
          <Image
            src="/icon.png"
            alt="PICKS 로고"
            width={112}
            height={112}
            className="rounded-3xl shadow-card-md"
            style={{ objectFit: 'contain' }}
          />
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-3" style={{ color: '#D6536D', fontFamily: "'Bricolage Grotesk', sans-serif" }}>PICKS</h1>
        <p className="text-[13px] font-medium tracking-widest text-gray-400 uppercase mb-2">픽스</p>
        <p className="text-center text-[18px] font-semibold text-picks-dark mt-4 leading-relaxed">소중한 관계를<br />픽스하세요</p>
        <p className="text-center text-[14px] text-gray-400 mt-3 leading-relaxed">생일, 기념일, 안부 — 모든 순간을<br />놓치지 않도록 도와드려요</p>
        <div className="flex gap-3 mt-10 mb-8">
          <div className="w-2 h-2 rounded-full bg-picks-rose" />
          <div className="w-2 h-2 rounded-full bg-picks-pink" />
          <div className="w-2 h-2 rounded-full bg-picks-yellow" />
        </div>
      </div>

      <div className="px-7 mb-8">
        <div className="grid grid-cols-3 gap-3">
          {[{ icon: '🎂', label: '생일 알림' }, { icon: '💌', label: '일괄 메시지' }, { icon: '📅', label: '관계 캘린더' }].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-2 p-3 bg-white rounded-2xl shadow-card">
              <span className="text-2xl">{item.icon}</span>
              <span className="text-[12px] font-medium text-gray-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 버튼: 회원가입 / 로그인 */}
      <div className="px-7 pb-12 flex flex-col gap-3">
        <Link
          href="/signup"
          className="w-full py-4 rounded-2xl text-center font-semibold text-[16px] text-white active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(135deg, #D6536D 0%, #E43D12 100%)' }}
        >
          회원가입
        </Link>
        <Link
          href="/login"
          className="w-full py-4 rounded-2xl text-center font-semibold text-[16px] border-2 active:scale-95 transition-transform"
          style={{ borderColor: '#D6536D', color: '#D6536D' }}
        >
          로그인
        </Link>
      </div>

      {/* 연동 방식 선택 팝업 */}
      {showSyncPopup && contactList.length === 0 && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-[393px] bg-white rounded-t-3xl p-6 bottom-sheet">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#fdf0f2' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D6536D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              </div>
              <h3 className="text-[20px] font-bold text-picks-dark">연락처 연동</h3>
              <p className="text-[14px] text-gray-400 text-center mt-2 leading-relaxed">
                기기의 연락처를 PICKS에 연동하면<br />소중한 관계를 더 쉽게 관리할 수 있어요
              </p>
              <p className="text-[12px] text-gray-300 mt-1">자동 또는 수동으로 연동할 수 있습니다</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleAutoSync}
                disabled={syncing}
                className="w-full py-4 rounded-2xl font-semibold text-[15px] text-white active:scale-95 transition-transform disabled:opacity-70"
                style={{ background: 'linear-gradient(135deg, #D6536D 0%, #E43D12 100%)' }}
              >
                {syncing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />연동 중...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                    </svg>
                    자동으로 전체 연동하기
                  </span>
                )}
              </button>
              <button
                onClick={handleOpenManual}
                disabled={loading}
                className="w-full py-4 rounded-2xl font-semibold text-[15px] border-2 active:scale-95 transition-transform disabled:opacity-60"
                style={{ borderColor: '#D6536D', color: '#D6536D' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#D6536D', borderTopColor: 'transparent' }} />
                    불러오는 중...
                  </span>
                ) : '수동으로 선택해서 연동하기'}
              </button>
              <button onClick={() => setShowSyncPopup(false)} className="w-full py-3 text-[14px] text-gray-400 font-medium">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 1: 연락처 선택 */}
      {showSyncPopup && contactList.length > 0 && step === 'list' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-[393px] bg-white rounded-t-3xl bottom-sheet flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <button onClick={() => setContactList([])} className="text-gray-400">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
              </button>
              <div className="text-center">
                <h3 className="text-[17px] font-bold text-picks-dark">연락처 선택</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">{contactList.length}명 중 {selected.size}명 선택</p>
              </div>
              <button
                onClick={() => {
                  if (selected.size === contactList.length) setSelected(new Set());
                  else setSelected(new Set(contactList.map((c) => c.id)));
                }}
                className="text-[13px] font-semibold"
                style={{ color: '#D6536D' }}
              >
                {selected.size === contactList.length ? '전체 해제' : '전체 선택'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-2">
              {contactList.map((c, idx) => (
                <button
                  key={c.id}
                  onClick={() => toggleContact(c.id)}
                  className="w-full flex items-center gap-3 py-3 rounded-xl px-2 active:bg-gray-50 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: selected.has(c.id) ? '#D6536D' : AVATAR_COLORS[idx % AVATAR_COLORS.length] }}
                  >
                    {selected.has(c.id) ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : c.name.charAt(0)}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[15px] font-semibold text-picks-dark">{c.name}</p>
                    <p className="text-[12px] text-gray-400">{c.phone || '번호 없음'}</p>
                  </div>
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ borderColor: selected.has(c.id) ? '#D6536D' : '#ddd', background: selected.has(c.id) ? '#D6536D' : 'white' }}
                  >
                    {selected.has(c.id) && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={handleGoCategory}
                disabled={selected.size === 0}
                className="w-full py-4 rounded-2xl font-semibold text-[15px] text-white active:scale-95 transition-transform disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #D6536D 0%, #E43D12 100%)' }}
              >
                다음 — {selected.size}명 선택됨
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: 카테고리 지정 후 관계 상세 페이지로 이동 */}
      {showSyncPopup && step === 'category' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-[393px] bg-white rounded-t-3xl bottom-sheet flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <button onClick={() => setStep('list')} className="text-gray-400">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
              </button>
              <h3 className="text-[17px] font-bold text-picks-dark">카테고리 지정</h3>
              <div className="w-8" />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="mb-5">
                <p className="text-[13px] font-semibold text-gray-400 mb-3">선택한 연락처 ({selectedContacts.length}명)</p>
                <div className="flex flex-wrap gap-2">
                  {selectedContacts.slice(0, 6).map((c, idx) => (
                    <div key={c.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-card">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}
                      >
                        {c.name.charAt(0)}
                      </div>
                      <span className="text-[12px] font-medium text-picks-dark">{c.name}</span>
                    </div>
                  ))}
                  {selectedContacts.length > 6 && (
                    <div className="px-3 py-1.5 rounded-full bg-gray-100">
                      <span className="text-[12px] text-gray-500">+{selectedContacts.length - 6}명</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[13px] font-semibold text-gray-400 mb-1">카테고리를 선택하거나 새로 만드세요</p>
                <p className="text-[11px] text-gray-300 mb-3">저장 후 개별 상세 페이지에서 메모와 정보를 추가할 수 있어요</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setPickedCategory(cat); setShowNewCatInput(false); }}
                      className="px-4 py-2 rounded-full text-[13px] font-semibold transition-all active:scale-95"
                      style={{
                        background: pickedCategory === cat ? '#D6536D' : 'white',
                        color: pickedCategory === cat ? 'white' : '#666',
                        border: pickedCategory === cat ? 'none' : '1.5px solid #e5e5e5',
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                  {!showNewCatInput && (
                    <button
                      onClick={() => setShowNewCatInput(true)}
                      className="px-4 py-2 rounded-full text-[13px] font-semibold flex items-center gap-1 transition-all active:scale-95"
                      style={{ border: '1.5px dashed #D6536D', color: '#D6536D' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      새 카테고리
                    </button>
                  )}
                </div>

                {showNewCatInput && (
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      autoFocus
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && confirmNewCategory()}
                      placeholder="카테고리 이름 입력"
                      maxLength={12}
                      className="flex-1 px-4 py-2.5 rounded-xl border text-[14px] text-picks-dark bg-white"
                      style={{ borderColor: '#D6536D', outline: 'none' }}
                    />
                    <button
                      onClick={confirmNewCategory}
                      disabled={!newCatName.trim()}
                      className="px-4 py-2.5 rounded-xl font-semibold text-[13px] text-white disabled:opacity-40"
                      style={{ background: '#D6536D' }}
                    >
                      추가
                    </button>
                    <button
                      onClick={() => { setShowNewCatInput(false); setNewCatName(''); }}
                      className="px-3 py-2.5 rounded-xl text-[13px] text-gray-400 bg-gray-100"
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>

              {pickedCategory && (
                <div className="mt-5 p-4 rounded-2xl" style={{ background: '#fdf0f2' }}>
                  <p className="text-[13px] text-gray-500">
                    <span className="font-semibold text-picks-dark">{selectedContacts.length}명</span>이{' '}
                    <span className="font-bold" style={{ color: '#D6536D' }}>[{pickedCategory}]</span> 카테고리로 저장됩니다
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">저장 후 관계 리스트에서 개별 상세 정보를 입력할 수 있어요</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={handleSave}
                disabled={!pickedCategory}
                className="w-full py-4 rounded-2xl font-semibold text-[15px] text-white active:scale-95 transition-transform disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #D6536D 0%, #E43D12 100%)' }}
              >
                저장하고 관계 리스트로 이동
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] toast-enter">
          <div className="bg-picks-dark text-white px-5 py-3 rounded-2xl shadow-lg text-[14px] font-medium max-w-[320px] text-center">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
