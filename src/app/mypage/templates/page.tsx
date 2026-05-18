'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import type { MessageTemplate } from '@/lib/types';

export default function TemplatesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ category: '기본 안부', content: '' });
  const [toast, setToast] = useState('');
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/onboarding');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchTemplates = async () => {
      setDataLoading(true);
      const { data } = await supabase
        .from('message_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at');
      setTemplates((data as MessageTemplate[]) ?? []);
      setDataLoading(false);
    };
    fetchTemplates();
  }, [user]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const startEdit = (t: MessageTemplate) => {
    setEditingId(t.id);
    setEditContent(t.content);
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase
      .from('message_templates')
      .update({ content: editContent })
      .eq('id', id);

    if (error) {
      showToast('저장 중 오류가 발생했습니다.');
      return;
    }
    setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, content: editContent } : t));
    setEditingId(null);
    showToast('템플릿이 저장되었습니다.');
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', id);

    if (error) {
      showToast('삭제 중 오류가 발생했습니다.');
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    showToast('템플릿이 삭제되었습니다.');
  };

  const addTemplate = async () => {
    if (!newTemplate.content || !user) return;
    const { data, error } = await supabase
      .from('message_templates')
      .insert({ user_id: user.id, category: newTemplate.category, content: newTemplate.content })
      .select()
      .single();

    if (error) {
      showToast('추가 중 오류가 발생했습니다.');
      return;
    }
    setTemplates((prev) => [...prev, data as MessageTemplate]);
    setNewTemplate({ category: '기본 안부', content: '' });
    setShowAdd(false);
    showToast('새 템플릿이 추가되었습니다!');
  };

  const categoryColors: Record<string, string> = {
    '기본 안부': '#D6536D',
    '친한 친구용': '#EFB11D',
    '어색 관계용': '#4CAF50',
    '대학생용': '#2196F3',
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
      {/* Header */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] z-40 flex items-center justify-between px-7 bg-picks-bg"
        style={{ height: '56px', paddingTop: 'env(safe-area-inset-top)' }}
      >
        <button onClick={() => router.back()} className="p-1 -ml-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="text-[17px] font-bold text-picks-dark">메시지 템플릿</span>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto pb-24" style={{ paddingTop: '72px' }}>
        {/* Add new button */}
        <div className="px-7 mb-4">
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="w-full py-3.5 rounded-2xl border-2 border-dashed text-[14px] font-semibold flex items-center justify-center gap-2 transition-colors"
            style={{ borderColor: '#D6536D', color: '#D6536D' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            새 템플릿 추가
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="px-7 mb-4">
            <div className="picks-card p-4">
              <h3 className="text-[14px] font-bold text-picks-dark mb-3">새 템플릿</h3>
              <div className="mb-3">
                <label className="block text-[12px] font-medium text-gray-500 mb-1">카테고리</label>
                <div className="flex gap-2 flex-wrap">
                  {['시즌 안부', '기본 안부', '친한 친구용', '어색 관계용', '대학생용'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewTemplate((p) => ({ ...p, category: cat }))}
                      className="px-3 py-1 rounded-full text-[12px] font-medium transition-all"
                      style={{
                        background: newTemplate.category === cat ? '#D6536D' : '#f5f5f5',
                        color: newTemplate.category === cat ? 'white' : '#666',
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={newTemplate.content}
                onChange={(e) => setNewTemplate((p) => ({ ...p, content: e.target.value }))}
                placeholder="메시지 내용을 입력하세요..."
                className="w-full px-3 py-3 rounded-xl border border-gray-200 bg-gray-50 text-[14px] text-picks-dark focus:border-picks-rose transition-colors resize-none"
                rows={3}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-medium text-gray-500 bg-gray-100"
                >
                  취소
                </button>
                <button
                  onClick={addTemplate}
                  disabled={!newTemplate.content}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-medium text-white disabled:opacity-50"
                  style={{ background: '#D6536D' }}
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Template list */}
        <div className="px-7 space-y-3">
          {dataLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-picks-rose border-t-transparent rounded-full animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <div className="picks-card p-8 text-center">
              <p className="text-gray-400 text-[14px]">템플릿이 없습니다</p>
              <button
                onClick={() => setShowAdd(true)}
                className="text-[13px] font-semibold mt-2 block w-full"
                style={{ color: '#D6536D' }}
              >
                + 템플릿 추가하기
              </button>
            </div>
          ) : (
            templates.map((template) => (
              <div key={template.id} className="picks-card p-4">
                <div className="flex items-start justify-between mb-2">
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={{
                      background: (categoryColors[template.category] || '#D6536D') + '20',
                      color: categoryColors[template.category] || '#D6536D',
                    }}
                  >
                    {template.category}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(template)}
                      className="p-1.5 rounded-lg"
                      style={{ background: '#fdf0f2' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D6536D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="p-1.5 rounded-lg"
                      style={{ background: '#fff0f0' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E43D12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                </div>
                {editingId === template.id ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-picks-rose bg-gray-50 text-[14px] text-picks-dark resize-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 py-2 rounded-xl text-[13px] font-medium text-gray-500 bg-gray-100"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => saveEdit(template.id)}
                        className="flex-1 py-2 rounded-xl text-[13px] font-medium text-white"
                        style={{ background: '#D6536D' }}
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[14px] text-picks-dark leading-relaxed">{template.content}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <BottomNav />

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 toast-enter">
          <div className="bg-picks-dark text-white px-5 py-3 rounded-2xl shadow-lg text-[14px] font-medium whitespace-nowrap">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
