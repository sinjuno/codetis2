'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatPhone } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';

const AVATAR_COLORS = ['#D6536D', '#EFB11D', '#E43D12', '#FFA2B6', '#4CAF50', '#2196F3'];
const BASE_CATEGORIES = ['친구', '가족', '비즈니스'];

async function fetchOneContact(): Promise<{ name: string; phone: string } | null> {
  if (typeof navigator !== 'undefined' && 'contacts' in navigator) {
    try {
      // @ts-expect-error contacts API is experimental
      const raw = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (!raw.length) return null;
      return {
        name: raw[0].name?.[0] ?? '',
        phone: formatPhone(raw[0].tel?.[0] ?? ''),
      };
    } catch {
      return null;
    }
  }
  return null;
}

export default function NewContactPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', birthday: '', category: '친구', memo: '' });
  const [categories, setCategories] = useState<string[]>(BASE_CATEGORIES);
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/onboarding');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    // Load existing categories
    supabase.from('user_categories').select('name').eq('user_id', user.id).then(({ data }) => {
      if (data && data.length > 0) {
        const customCats = data.map((c: { name: string }) => c.name);
        const allCats = [...BASE_CATEGORIES, ...customCats.filter((c: string) => !BASE_CATEGORIES.includes(c))];
        setCategories(allCats);
      }
    });
  }, [user]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2000); };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, phone: formatPhone(e.target.value) }));

  const handleImport = async () => {
    setImporting(true);
    const contact = await fetchOneContact();
    setImporting(false);
    if (!contact) {
      showToast('이 기기에서는 연락처 불러오기를 지원하지 않아요.');
      return;
    }
    setForm((p) => ({ ...p, name: contact.name, phone: contact.phone }));
    showToast('연락처를 불러왔습니다.');
  };

  const confirmNewCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    if (!categories.includes(name)) setCategories((prev) => [...prev, name]);
    setForm((p) => ({ ...p, category: name }));
    setNewCatName('');
    setShowNewCatInput(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !user) return;
    setLoading(true);

    const colorIndex = Math.floor(Math.random() * AVATAR_COLORS.length);
    const avatarColor = AVATAR_COLORS[colorIndex];

    const { error } = await supabase.from('connections').insert({
      user_id: user.id,
      name: form.name,
      phone: form.phone,
      birthday: form.birthday || null,
      category: form.category,
      memo: form.memo,
      avatar_color: avatarColor,
      last_contact: new Date().toISOString().split('T')[0],
    });

    if (!error) {
      // Upsert category if custom
      await supabase
        .from('user_categories')
        .upsert({ user_id: user.id, name: form.category }, { onConflict: 'user_id,name' });
    }

    setLoading(false);

    if (error) {
      showToast('저장 중 오류가 발생했습니다.');
      return;
    }

    showToast('연락처가 저장되었습니다!');
    setTimeout(() => router.push('/contacts'), 1200);
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
        <span className="text-[17px] font-bold text-picks-dark">관계 추가</span>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto pb-16" style={{ paddingTop: '72px' }}>

        {/* 연락처에서 불러오기 */}
        <div className="px-7 mb-6">
          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full py-3 rounded-xl border-2 border-dashed text-[14px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
            style={{ borderColor: '#D6536D', color: '#D6536D' }}
          >
            {importing ? (
              <>
                <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#D6536D', borderTopColor: 'transparent' }} />
                불러오는 중...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" />
                  <polyline points="17 11 19 13 23 9" />
                </svg>
                핸드폰 연락처에서 불러오기
              </>
            )}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 flex flex-col gap-5">

          {/* 이름 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600 mb-1.5">이름 <span className="text-picks-red">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="이름을 입력하세요"
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-[15px] text-picks-dark focus:border-picks-rose transition-colors"
            />
          </div>

          {/* 연락처 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600 mb-1.5">연락처 <span className="text-picks-red">*</span></label>
            <input
              type="tel"
              value={form.phone}
              onChange={handlePhoneChange}
              placeholder="010-0000-0000"
              maxLength={13}
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-[15px] text-picks-dark focus:border-picks-rose transition-colors"
            />
          </div>

          {/* 생일 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600 mb-1.5">생일</label>
            <div className="flex gap-2">
              <select
                value={form.birthday ? form.birthday.split('-')[0] : ''}
                onChange={(e) => {
                  const parts = form.birthday ? form.birthday.split('-') : ['', '01', '01'];
                  const val = e.target.value ? `${e.target.value}-${parts[1] || '01'}-${parts[2] || '01'}` : '';
                  setForm((p) => ({ ...p, birthday: val }));
                }}
                className="flex-1 px-3 py-3.5 rounded-xl border border-gray-200 bg-white text-[15px] text-picks-dark focus:border-picks-rose transition-colors appearance-none"
              >
                <option value="">년</option>
                {Array.from({ length: 80 }, (_, i) => 2010 - i).map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <select
                value={form.birthday ? form.birthday.split('-')[1] : ''}
                onChange={(e) => {
                  const parts = form.birthday ? form.birthday.split('-') : ['2000', '', '01'];
                  setForm((p) => ({ ...p, birthday: `${parts[0] || '2000'}-${e.target.value}-${parts[2] || '01'}` }));
                }}
                className="w-[78px] px-3 py-3.5 rounded-xl border border-gray-200 bg-white text-[15px] text-picks-dark focus:border-picks-rose transition-colors appearance-none"
              >
                <option value="">월</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={String(m).padStart(2, '0')}>{m}월</option>
                ))}
              </select>
              <select
                value={form.birthday ? form.birthday.split('-')[2] : ''}
                onChange={(e) => {
                  const parts = form.birthday ? form.birthday.split('-') : ['2000', '01', ''];
                  setForm((p) => ({ ...p, birthday: `${parts[0] || '2000'}-${parts[1] || '01'}-${e.target.value}` }));
                }}
                className="w-[78px] px-3 py-3.5 rounded-xl border border-gray-200 bg-white text-[15px] text-picks-dark focus:border-picks-rose transition-colors appearance-none"
              >
                <option value="">일</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d).padStart(2, '0')}>{d}일</option>
                ))}
              </select>
            </div>
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600 mb-2">카테고리</label>

            <div className="flex flex-wrap gap-2 mb-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { setForm((p) => ({ ...p, category: cat })); setShowNewCatInput(false); }}
                  className="px-4 py-2 rounded-full text-[13px] font-semibold transition-all active:scale-95"
                  style={{
                    background: form.category === cat ? '#D6536D' : 'white',
                    color: form.category === cat ? 'white' : '#666',
                    border: form.category === cat ? 'none' : '1.5px solid #e5e5e5',
                  }}
                >
                  {cat}
                </button>
              ))}

              {!showNewCatInput && (
                <button
                  type="button"
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
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), confirmNewCategory())}
                  placeholder="카테고리 이름 (예: 동호회)"
                  maxLength={12}
                  className="flex-1 px-4 py-2.5 rounded-xl text-[14px] text-picks-dark bg-white"
                  style={{ border: '1.5px solid #D6536D', outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={confirmNewCategory}
                  disabled={!newCatName.trim()}
                  className="px-4 py-2.5 rounded-xl font-semibold text-[13px] text-white disabled:opacity-40"
                  style={{ background: '#D6536D' }}
                >
                  추가
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewCatInput(false); setNewCatName(''); }}
                  className="px-3 py-2.5 rounded-xl text-[13px] text-gray-400 bg-gray-100"
                >
                  취소
                </button>
              </div>
            )}

            {form.category && (
              <p className="text-[12px] mt-2" style={{ color: '#D6536D' }}>
                ✓ <span className="font-semibold">{form.category}</span> 카테고리로 저장됩니다
              </p>
            )}
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600 mb-1.5">메모</label>
            <textarea
              value={form.memo}
              onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
              placeholder="이 사람에 대해 기억하고 싶은 것을 메모하세요"
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-[15px] text-picks-dark focus:border-picks-rose transition-colors resize-none"
              rows={4}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !form.name || !form.phone}
            className="w-full py-4 rounded-2xl font-semibold text-[16px] text-white transition-all active:scale-95 disabled:opacity-50 mt-2"
            style={{ background: 'linear-gradient(135deg, #D6536D 0%, #E43D12 100%)' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                저장 중...
              </span>
            ) : '저장하기'}
          </button>
        </form>
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 toast-enter">
          <div className="bg-picks-dark text-white px-5 py-3 rounded-2xl shadow-lg text-[14px] font-medium">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
