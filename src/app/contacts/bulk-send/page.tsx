'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import type { Connection } from '@/lib/types';

const SEASON_TEMPLATES: { label: string; text: string }[] = [
  { label: '설날', text: '기다리던 설 연휴, 걱정은 내려놓고 맛있는 음식 가득 드시며 포근하게 충전하세요. 새해 복 많이 받으세요!' },
  { label: '추석', text: '선선한 바람과 함께 찾아온 추석입니다. 보름달처럼 마음 넉넉하고 여유로운 명절 보내세요.' },
  { label: '어버이날', text: '늘 아낌없는 사랑을 주셔서 감사합니다. 부모님의 자식이라 행복해요. 오래오래 건강하세요!' },
  { label: '스승의날', text: '따뜻한 가르침으로 길잡이가 되어주신 선생님, 은혜에 늘 감사드리며 항상 건강하시길 바랍니다.' },
  { label: '수능', text: '지금까지 노력한 시간들을 믿어봐. 너의 페이스대로 후회 없이 쏟아내고 오길, 화이팅!' },
  { label: '크리스마스', text: '반짝이는 조명처럼 설렘 가득한 성탄절 보내세요. 소중한 사람들과 가장 행복한 하루 되길!' },
];

const TEMPLATE_DATA: Record<string, string[]> = {
  '시즌 안부': SEASON_TEMPLATES.map((s) => s.text),
  '기본 안부': [
    '안녕하세요! 잘 지내고 계신가요? 요즘 바쁘신 것 같아 연락 못 드렸는데 문득 생각이 나서 연락드립니다 😊',
    '오랜만에 연락드려요! 요즘 어떻게 지내세요? 별일 없으시죠? 생각나서 인사 드리고 싶었어요.',
    '안녕하세요 :) 오랜만이에요! 잘 지내고 계신지 궁금해서 연락드렸어요. 편한 시간에 한번 연락 주세요~',
    '안녕하세요~ 오랜만에 인사드려요. 요즘 어떻게 지내고 계세요? 좋은 하루 보내고 계시길 바랍니다!',
  ],
  '친한 친구용': [
    '야 잘 지내?? ㅋㅋ 요즘 뭐해~ 갑자기 생각나서 연락했어. 오랜만에 한번 만나자!',
    'ㅋㅋㅋ 갑자기 생각났어ㅎ 뭐해 요즘? 바쁜 거 알지만 한번 보고 싶다~',
    '헤이~ 잘 지내지?? 오랜만이다 ㅎㅎ 요즘 어떻게 지내? 밥 한번 먹자!',
    '야 오랜만이야!! 어떻게 지내고 있어? 연락한 지 너무 됐다ㅋㅋ 언제 시간 돼?',
  ],
  '어색한 관계용': [
    '안녕하세요, 오랜만에 연락드립니다. 잘 지내고 계신지 궁금해서 여쭤보고 싶었어요.',
    '안녕하세요! 오랜만이에요. 문득 생각이 나서 연락드렸어요. 요즘 어떻게 지내세요?',
    '반갑습니다. 오랜만에 인사드려요. 혹시 요즘 잘 지내고 계신지요? 연락이 뜸해서 안부 여쭤봅니다.',
    '안녕하세요~ 오랜만에 인사드리고 싶어 연락드렸어요. 요즘 어떻게 지내시는지 궁금했습니다.',
  ],
  '대학생 시즌': [
    '개강했다!! 이번 학기 같은 강의 혹시 있어? 바쁘겠지만 밥 한번 먹자ㅎ',
    '종강 축하해!! 🎉 방학 때 뭐 할 거야? 오랜만에 한번 보자~ 할 말도 많은데!',
    '오랜만이야! 학기 시작하고 정신없지? ㅋㅋ 그래도 한번 보고 싶은데 시간 돼?',
    '시험 기간이라 고생 많지? 😂 끝나면 꼭 보자! 맛있는 거 먹으러 가자~',
  ],
  '생일 축하': [
    '생일 축하해!! 🎂 오늘 하루 정말 특별하게 보내길 바라~ 올해도 건강하고 행복하자!',
    '생일 축하드립니다! 🎉 항상 건강하고 행복하시길 바랍니다. 좋은 일만 가득하세요~',
    '생일 축하해요~! 🎁 행복한 하루 보내고 올해도 좋은 일 많이 생기길 바랄게요!',
    '오늘 생일이죠?? 🎂 축하해!! 오래오래 건강하고 원하는 거 다 이루길 바랄게~',
  ],
};

const BASE_CATEGORIES = Object.keys(TEMPLATE_DATA);

export default function BulkSendPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [mergedTemplateData, setMergedTemplateData] = useState<Record<string, string[]>>(TEMPLATE_DATA);
  const [templateCategories, setTemplateCategories] = useState<string[]>(BASE_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState(BASE_CATEGORIES[0]);
  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState(0);
  const [customText, setCustomText] = useState(TEMPLATE_DATA[BASE_CATEGORIES[0]][0]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [dataLoading, setDataLoading] = useState(true);
  const [activeContactCategory, setActiveContactCategory] = useState('전체');
  const [contactCategories, setContactCategories] = useState<string[]>(['전체', '친구', '가족', '비즈니스']);

  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const templateScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/onboarding');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setDataLoading(true);
      const [{ data: conns }, { data: cats }, { data: userTpls }] = await Promise.all([
        supabase.from('connections').select('*').eq('user_id', user.id).order('name'),
        supabase.from('user_categories').select('name').eq('user_id', user.id),
        supabase.from('message_templates').select('category, content').eq('user_id', user.id).order('created_at'),
      ]);
      setConnections((conns as Connection[]) ?? []);
      const customCats = (cats ?? []).map((c: { name: string }) => c.name);
      const baseCats = ['전체', '친구', '가족', '비즈니스'];
      setContactCategories([...baseCats, ...customCats.filter((c: string) => !baseCats.slice(1).includes(c))]);

      if (userTpls && userTpls.length > 0) {
        const userByCategory: Record<string, string[]> = {};
        for (const tpl of userTpls as { category: string; content: string }[]) {
          if (!userByCategory[tpl.category]) userByCategory[tpl.category] = [];
          userByCategory[tpl.category].push(tpl.content);
        }
        const merged: Record<string, string[]> = {};
        for (const key of BASE_CATEGORIES) {
          merged[key] = [...(userByCategory[key] ?? []), ...TEMPLATE_DATA[key]];
        }
        for (const cat of Object.keys(userByCategory)) {
          if (!merged[cat]) merged[cat] = userByCategory[cat];
        }
        setMergedTemplateData(merged);
        setTemplateCategories(Object.keys(merged));
        const firstCat = Object.keys(merged)[0];
        setSelectedCategory(firstCat);
        setCustomText(merged[firstCat][0] ?? '');
        setSelectedTemplateIdx(0);
      }

      setDataLoading(false);
    };
    fetchData();
  }, [user]);

  const currentTemplates = mergedTemplateData[selectedCategory] ?? [];

  const filteredConnections = activeContactCategory === '전체'
    ? connections
    : connections.filter((c) => c.category === activeContactCategory);

  const allFilteredSelected = filteredConnections.length > 0 && filteredConnections.every((c) => selectedContacts.has(c.id));

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setSelectedTemplateIdx(0);
    setCustomText((mergedTemplateData[cat] ?? [])[0] ?? '');
    templateScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  };

  const handleTemplateSelect = (idx: number) => {
    setSelectedTemplateIdx(idx);
    setCustomText(currentTemplates[idx]);
  };

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedContacts((prev) => {
        const next = new Set(prev);
        filteredConnections.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedContacts((prev) => {
        const next = new Set(prev);
        filteredConnections.forEach((c) => next.add(c.id));
        return next;
      });
    }
  };

  const handleSend = async () => {
    if (selectedContacts.size === 0 || !user) return;
    const sentContacts = connections.filter((c) => selectedContacts.has(c.id));
    const failedContacts = connections.filter((c) => !selectedContacts.has(c.id));

    await supabase.from('message_send_logs').insert({
      user_id: user.id,
      template_content: customText,
      sent_to: sentContacts.map((c) => ({ name: c.name, phone: c.phone })),
      failed: failedContacts.map((c) => ({ name: c.name, phone: c.phone })),
    });

    sessionStorage.setItem('bulkSendResult', JSON.stringify({
      sent: sentContacts.map((c) => c.name),
      failed: failedContacts.map((c) => c.name),
      total: selectedContacts.size,
    }));
    router.push('/contacts/bulk-send/result');
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
        <span className="text-[17px] font-bold text-picks-dark">일괄 전송</span>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto pb-28" style={{ paddingTop: '72px' }}>
        {/* Template section */}
        <div className="px-7">
          <h3 className="text-[15px] font-bold text-picks-dark mb-3">템플릿 선택</h3>

          {/* Category scroll */}
          <div
            ref={categoryScrollRef}
            className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-4"
          >
            {templateCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                style={{
                  background: selectedCategory === cat ? '#D6536D' : 'white',
                  color: selectedCategory === cat ? 'white' : '#666',
                  border: selectedCategory === cat ? 'none' : '1.5px solid #e5e5e5',
                  boxShadow: selectedCategory === cat ? '0 2px 8px rgba(214,83,109,0.3)' : 'none',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Template example cards - horizontal scroll */}
          <div
            ref={templateScrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide pb-3 mb-4"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {currentTemplates.map((text, idx) => (
              <button
                key={idx}
                onClick={() => handleTemplateSelect(idx)}
                className="flex-shrink-0 w-52 p-4 rounded-2xl text-left transition-all"
                style={{
                  scrollSnapAlign: 'start',
                  background: selectedTemplateIdx === idx ? '#D6536D' : 'white',
                  border: selectedTemplateIdx === idx ? 'none' : '1.5px solid #e5e5e5',
                  boxShadow: selectedTemplateIdx === idx
                    ? '0 4px 12px rgba(214,83,109,0.3)'
                    : '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                {selectedCategory === '시즌 안부' && (
                  <p
                    className="text-[10px] font-bold mb-1.5"
                    style={{ color: selectedTemplateIdx === idx ? 'rgba(255,255,255,0.75)' : '#D6536D' }}
                  >
                    {SEASON_TEMPLATES[idx].label}
                  </p>
                )}
                <p
                  className="text-[12px] leading-relaxed line-clamp-4"
                  style={{ color: selectedTemplateIdx === idx ? 'white' : '#444' }}
                >
                  {text}
                </p>
                {selectedTemplateIdx === idx && (
                  <div className="flex items-center gap-1 mt-2">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
                      <polyline points="2,6 5,9 10,3" />
                    </svg>
                    <span className="text-[10px] text-white font-medium">선택됨</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Scroll indicator dots */}
          <div className="flex justify-center gap-1.5 mb-4">
            {currentTemplates.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  handleTemplateSelect(idx);
                  const card = templateScrollRef.current?.children[idx] as HTMLElement;
                  card?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
                }}
                className="rounded-full transition-all"
                style={{
                  width: selectedTemplateIdx === idx ? '16px' : '6px',
                  height: '6px',
                  background: selectedTemplateIdx === idx ? '#D6536D' : '#e0e0e0',
                }}
              />
            ))}
          </div>

          {/* Editable text */}
          <div>
            <p className="text-[13px] font-medium text-gray-500 mb-2">메시지 내용 수정</p>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-[14px] text-picks-dark focus:border-picks-rose transition-colors resize-none"
              rows={4}
              placeholder="메시지 내용을 입력하세요..."
            />
            <p className="text-[11px] text-gray-400 mt-1 text-right">{customText.length}자</p>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-2 bg-gray-50 my-5" />

        {/* Recipients section */}
        <div className="px-7">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-bold text-picks-dark">전송 대상 선택</h3>
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-[13px] font-medium"
              style={{ color: '#D6536D' }}
            >
              <div
                className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
                style={{
                  background: allFilteredSelected ? '#D6536D' : 'transparent',
                  borderColor: allFilteredSelected ? '#D6536D' : '#d1d5db',
                }}
              >
                {allFilteredSelected && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2">
                    <polyline points="1,5 4,8 9,2" />
                  </svg>
                )}
              </div>
              전체 선택
            </button>
          </div>

          {/* 카테고리 필터 */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-3">
            {contactCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveContactCategory(cat)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                style={{
                  background: activeContactCategory === cat ? '#D6536D' : 'white',
                  color: activeContactCategory === cat ? 'white' : '#666',
                  border: activeContactCategory === cat ? 'none' : '1.5px solid #e5e5e5',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {dataLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-picks-rose border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              filteredConnections.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => toggleContact(contact.id)}
                  className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-white shadow-card hover:shadow-card-md transition-shadow"
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                      selectedContacts.has(contact.id) ? 'bg-picks-rose border-picks-rose' : 'border-gray-300'
                    }`}
                  >
                    {selectedContacts.has(contact.id) && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
                        <polyline points="2,6 5,9 10,3" />
                      </svg>
                    )}
                  </div>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                    style={{ background: contact.avatar_color }}
                  >
                    {contact.name.charAt(0)}
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-[14px] font-semibold text-picks-dark">{contact.name}</p>
                    <p className="text-[12px] text-gray-400">{contact.phone}</p>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0"
                    style={{ background: '#fdf0f2', color: '#D6536D' }}
                  >
                    {contact.category}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Fixed send button */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] px-7 pb-8 pt-4 z-30 bg-picks-bg">
        <button
          onClick={handleSend}
          disabled={selectedContacts.size === 0 || !customText}
          className="w-full py-4 rounded-2xl font-semibold text-[16px] text-white transition-all active:scale-95 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #D6536D 0%, #E43D12 100%)' }}
        >
          {selectedContacts.size > 0 ? `${selectedContacts.size}명에게 전송하기` : '전송 대상을 선택하세요'}
        </button>
      </div>
    </div>
  );
}
