export type SeasonTemplate = {
  content: string;
  category: string;
};

export const SEASON_TEMPLATES: Record<string, SeasonTemplate[]> = {
  seollal: [
    {
      category: '시즌 안부',
      content: '기다리던 설 연휴, 걱정은 내려놓고 맛있는 음식 가득 드시며 포근하게 충전하세요. 새해 복 많이 받으세요!',
    },
    {
      category: '시즌 안부',
      content: '설 연휴 잘 보내고 계신가요? 새해에도 건강하고 행복한 일들만 가득하시길 바랍니다!',
    },
  ],
  chuseok: [
    {
      category: '시즌 안부',
      content: '선선한 바람과 함께 찾아온 추석입니다. 보름달처럼 마음 넉넉하고 여유로운 명절 보내세요.',
    },
    {
      category: '시즌 안부',
      content: '추석 연휴 잘 보내고 계신가요? 가족들과 따뜻한 시간 보내시고 풍성한 한가위 되세요!',
    },
  ],
  may: [
    {
      category: '시즌 안부',
      content: '늘 아낌없는 사랑을 주셔서 감사합니다. 부모님의 자식이라 행복해요. 오래오래 건강하세요!',
    },
    {
      category: '시즌 안부',
      content: '따뜻한 가르침으로 길잡이가 되어주신 선생님, 은혜에 늘 감사드리며 항상 건강하시길 바랍니다.',
    },
  ],
  suneung: [
    {
      category: '시즌 안부',
      content: '지금까지 노력한 시간들을 믿어봐. 너의 페이스대로 후회 없이 쏟아내고 오길, 화이팅!',
    },
    {
      category: '시즌 안부',
      content: '수능 날이 드디어 왔구나! 긴장하지 말고 평소처럼만 해. 응원할게, 잘 다녀와!',
    },
  ],
  christmas: [
    {
      category: '시즌 안부',
      content: '반짝이는 조명처럼 설렘 가득한 성탄절 보내세요. 소중한 사람들과 가장 행복한 하루 되길!',
    },
    {
      category: '시즌 안부',
      content: '메리 크리스마스! 🎄 올 한 해도 함께해줘서 고마워. 따뜻하고 행복한 크리스마스 보내!',
    },
  ],
};
