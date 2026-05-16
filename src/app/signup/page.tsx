'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { formatPhone, validateEmail } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

function validateSimplePassword(password: string) {
  const hasLength = password.length >= 8 && password.length <= 16;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const typeCount = [hasUpper, hasLower, hasNumber].filter(Boolean).length;
  return { hasLength, hasUpper, hasLower, hasNumber, isValid: hasLength && typeCount >= 2 };
}

type EmailStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid';

const EyeIcon = ({ open }: { open: boolean }) => open ? (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
) : (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', birthday: '', phone: '', email: '', password: '', passwordConfirm: '' });
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle');
  const [showPass, setShowPass] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);
  const [toast, setToast] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const passValidation = validateSimplePassword(form.password);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm((p) => ({ ...p, email: val }));
    setEmailStatus('idle');
    setErrorMsg('');

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val) return;

    // 이메일 형식 아니면 바로 invalid
    if (!validateEmail(val)) {
      setEmailStatus('invalid');
      return;
    }

    // 형식 맞으면 중복 검사
    debounceRef.current = setTimeout(async () => {
      setEmailStatus('checking');
      try {
        const { data, error } = await supabase.rpc('check_email_exists', { check_email: val });
        if (error) {
          setEmailStatus('available');
          return;
        }
        setEmailStatus(data === true ? 'unavailable' : 'available');
      } catch {
        setEmailStatus('available');
      }
    }, 600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.name || !form.birthday || !form.phone || !form.email || !form.password || !form.passwordConfirm) {
      setErrorMsg('모든 항목을 입력해주세요.');
      return;
    }
    if (emailStatus === 'unavailable' || emailStatus === 'invalid') return;
    if (!passValidation.isValid) {
      setErrorMsg('비밀번호 조건을 확인해주세요.');
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setErrorMsg('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { name: form.name } },
    });
    setLoading(false);

    if (error) {
      console.error('[PICKS] signUp error:', error);
      const msg = error.message.toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        setErrorMsg('이미 가입된 이메일입니다. 로그인 페이지에서 로그인해주세요.');
      } else if (msg.includes('password')) {
        setErrorMsg('비밀번호가 조건에 맞지 않습니다. 다시 확인해주세요.');
      } else if (msg.includes('rate')) {
        setErrorMsg('잠시 후 다시 시도해주세요.');
      } else if (msg.includes('disabled') || msg.includes('not allowed')) {
        setErrorMsg('회원가입이 현재 비활성화되어 있습니다. Supabase 설정을 확인해주세요.');
      } else if (msg.includes('captcha')) {
        setErrorMsg('보안 인증이 필요합니다. (captcha)');
      } else {
        setErrorMsg(`[DEBUG] ${error.message}`);
      }
      return;
    }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        name: form.name,
        phone: form.phone,
        birthday: form.birthday,
        email: data.user.email,
      });
    }

    setToast(true);
    setTimeout(() => router.push('/login'), 2500);
  };

  return (
    <div className="flex flex-col min-h-screen bg-picks-bg page-fade">
      <div className="flex items-center px-7 pt-14" style={{ height: '64px' }}>
        <button onClick={() => router.back()} className="p-1 -ml-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
      </div>

      <div className="flex-1 px-7 pt-4 pb-20 overflow-y-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: '#D6536D', fontFamily: "'Bricolage Grotesk', sans-serif" }}>
          PICKS
        </h1>
        <p className="text-[15px] text-gray-500 mb-8">새로운 계정을 만들어보세요</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* 이름 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600 mb-1.5">이름 또는 닉네임 <span className="text-picks-red">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="이름 또는 닉네임"
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-[15px] text-picks-dark focus:border-picks-rose transition-colors"
            />
          </div>

          {/* 생년월일 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600 mb-1.5">생년월일 <span className="text-picks-red">*</span></label>
            <div className="flex gap-2">
              <select
                value={form.birthday ? form.birthday.split('-')[0] : ''}
                onChange={(e) => {
                  const parts = form.birthday ? form.birthday.split('-') : ['', '01', '01'];
                  setForm((p) => ({ ...p, birthday: `${e.target.value}-${parts[1] || '01'}-${parts[2] || '01'}` }));
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

          {/* 연락처 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600 mb-1.5">연락처 <span className="text-picks-red">*</span></label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
              placeholder="숫자만 입력하면 자동으로 형식이 맞춰집니다"
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-[15px] text-picks-dark focus:border-picks-rose transition-colors"
              maxLength={13}
              inputMode="numeric"
            />
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600 mb-1.5">아이디(이메일 형식) <span className="text-picks-red">*</span></label>
            <div className="relative">
              <input
                type="text"
                value={form.email}
                onChange={handleEmailChange}
                placeholder="example@email.com"
                autoComplete="email"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
                inputMode="email"
                className={`w-full px-4 py-3.5 rounded-xl border bg-white text-[15px] text-picks-dark focus:border-picks-rose transition-colors pr-10 ${
                  emailStatus === 'unavailable' || emailStatus === 'invalid' ? 'border-picks-red' :
                  emailStatus === 'available' ? 'border-green-400' : 'border-gray-200'
                }`}
              />
              {emailStatus === 'checking' && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <span className="w-4 h-4 border-2 rounded-full animate-spin block" style={{ borderColor: '#D6536D', borderTopColor: 'transparent' }} />
                </div>
              )}
              {emailStatus === 'available' && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-green-500">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
              {(emailStatus === 'unavailable' || emailStatus === 'invalid') && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-picks-red">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
              )}
            </div>
            {emailStatus === 'available' && (
              <p className="text-[12px] text-green-500 mt-1">사용 가능합니다!</p>
            )}
            {emailStatus === 'unavailable' && (
              <p className="text-[12px] text-picks-red mt-1">사용 불가능합니다.</p>
            )}
            {emailStatus === 'invalid' && (
              <p className="text-[12px] text-picks-red mt-1">올바른 이메일 형식이 아닙니다.</p>
            )}
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600 mb-1">비밀번호 <span className="text-picks-red">*</span></label>
            <p className="text-[11px] text-gray-400 mb-1.5">8~16자, 영문 대/소문자·숫자 중 2종류 이상 혼용</p>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-[15px] text-picks-dark focus:border-picks-rose transition-colors pr-12"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                <EyeIcon open={showPass} />
              </button>
            </div>
            {form.password.length > 0 && (
              <div className="mt-2 flex gap-3">
                {[
                  { label: '8~16자', ok: passValidation.hasLength },
                  { label: '대/소문자', ok: passValidation.hasUpper || passValidation.hasLower },
                  { label: '숫자 포함', ok: passValidation.hasNumber },
                ].map((req) => (
                  <span key={req.label} className={`text-[11px] flex items-center gap-1 ${req.ok ? 'text-green-500' : 'text-gray-400'}`}>
                    {req.ok ? '✓' : '○'} {req.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-600 mb-1.5">비밀번호 확인 <span className="text-picks-red">*</span></label>
            <div className="relative">
              <input
                type={showPassConfirm ? 'text' : 'password'}
                value={form.passwordConfirm}
                onChange={(e) => setForm((p) => ({ ...p, passwordConfirm: e.target.value }))}
                placeholder="비밀번호를 다시 입력하세요"
                className={`w-full px-4 py-3.5 rounded-xl border bg-white text-[15px] text-picks-dark focus:border-picks-rose transition-colors pr-12 ${
                  form.passwordConfirm.length > 0
                    ? form.password === form.passwordConfirm ? 'border-green-400' : 'border-picks-red'
                    : 'border-gray-200'
                }`}
              />
              <button type="button" onClick={() => setShowPassConfirm(!showPassConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                <EyeIcon open={showPassConfirm} />
              </button>
            </div>
            {form.passwordConfirm.length > 0 && form.password === form.passwordConfirm && (
              <p className="text-[12px] text-green-500 mt-1">비밀번호가 일치합니다!</p>
            )}
            {form.passwordConfirm.length > 0 && form.password !== form.passwordConfirm && (
              <p className="text-[12px] text-picks-red mt-1">비밀번호가 일치하지 않습니다.</p>
            )}
          </div>

          {errorMsg && (
            <div className="px-4 py-3 rounded-xl text-[13px] text-picks-red text-center" style={{ background: '#fdf0f2' }}>
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !passValidation.isValid || form.password !== form.passwordConfirm || emailStatus === 'unavailable' || emailStatus === 'invalid' || emailStatus === 'checking' || emailStatus === 'idle'}
            className="w-full py-4 rounded-2xl font-semibold text-[16px] text-white mt-2 transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #D6536D 0%, #E43D12 100%)' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                처리 중...
              </span>
            ) : '회원가입'}
          </button>

          <p className="text-center text-[13px] text-gray-400">
            이미 계정이 있으신가요?{' '}
            <button type="button" onClick={() => router.push('/login')} className="font-semibold" style={{ color: '#D6536D' }}>
              로그인
            </button>
          </p>
        </form>
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 toast-enter">
          <div className="bg-picks-dark text-white px-5 py-3.5 rounded-2xl shadow-lg text-[14px] font-medium max-w-[320px] text-center">
            가입을 환영해요! 이메일을 확인해주세요 🎉
          </div>
        </div>
      )}
    </div>
  );
}
