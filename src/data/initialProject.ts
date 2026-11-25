import { ProjectState, QuizQuestion, VisualStyle } from '../types/storyboard';

export const STYLE_OPTIONS: Array<{
  id: VisualStyle;
  labelKo: string;
  labelEn: string;
  descKo: string;
  promptStyle: string;
}> = [
  {
    id: '2d-animation',
    labelKo: '2D 애니메이션',
    labelEn: '2D Animation',
    descKo: '부드러운 파스텔 톤의 손그림 셀 애니메이션',
    promptStyle: 'Soft pastel 2D hand-drawn slice-of-life animation, clean warm linework, cozy colors',
  },
  {
    id: 'clay',
    labelKo: '클레이',
    labelEn: 'Claymation',
    descKo: '아기자기한 스톱모션 점토 미니어처 질감',
    promptStyle: 'Charming pastel claymation stop-motion animation, tactile handmade clay textures, soft studio lighting',
  },
  {
    id: 'watercolor',
    labelKo: '수채화',
    labelEn: 'Watercolor',
    descKo: '따뜻하고 투명하게 번지는 수채 일러스트',
    promptStyle: 'Warm pastel watercolor storybook illustration, gentle brush textures on textured paper',
  },
  {
    id: 'live-action',
    labelKo: '실사 스타일',
    labelEn: 'Live-Action',
    descKo: '캠퍼스 청춘 드라마 같은 자연스러운 영화 톤',
    promptStyle: 'Warm cinematic live-action Korean campus indie film still, natural daylight, soft pastel color grading',
  },
];

export const INITIAL_PROJECT: ProjectState = {
  title: 'Soup Saves the Day',
  setting:
    'A campus festival soup stand outdoors, then an indoor festival area in the adjacent student center.',
  characters:
    'Two original fictional university students, A wearing an orange apron and B wearing a green hoodie. Keep faces, outfits, props, and colors consistent. No real people, celebrities, movie characters, logos, copyrighted songs, or recreated movie scenes.',
  situation:
    'During a quiet campus festival, sudden rain clouds threaten the outdoor soup stall, so the two students move inside the student center and sell every bowl.',
  style: '2d-animation',
  authorName: '김세희',
  expressions: [
    {
      id: 'exp-1',
      expression: "I'm a bit on edge today.",
      meaning: '오늘 좀 예민하고 긴장돼.',
      movie: 'Inside Out 2',
    },
    {
      id: 'exp-2',
      expression: 'It looks like rain.',
      meaning: '비가 올 것 같아.',
      movie: 'Minari',
    },
    {
      id: 'exp-3',
      expression: 'I was going to sell everything',
      meaning: '전부 팔려고 했어.',
      movie: 'Notting Hill; course pattern: was/were going to + verb',
    },
    {
      id: 'exp-4',
      expression: 'On second thoughts',
      meaning: '다시 생각해 보니',
      movie: 'Notting Hill',
    },
    {
      id: 'exp-5',
      expression: 'Here, let me help.',
      meaning: '자, 내가 도와줄게.',
      movie: 'Notting Hill',
    },
    {
      id: 'exp-6',
      expression: "You've worked so hard today.",
      meaning: '오늘 정말 고생했어.',
      movie: 'Minari',
    },
    {
      id: 'exp-7',
      expression: 'That made my whole day.',
      meaning: '그 덕분에 하루 종일 기분 좋았어.',
      movie: 'Inside Out 2',
    },
  ],
  beats: [
    {
      id: 'beat-1',
      label: 'Hook',
      labelKo: '도입 (Hook)',
      startSec: 0,
      endSec: 7,
      durationSec: 7,
      sceneDescription: 'A nervously watches the quiet outdoor stand.',
      sceneDescriptionKo: '주황색 앞치마를 입은 A가 한산한 야외 부스를 초조하게 바라보고 있다.',
      dialogue: [
        {
          id: 'line-1-1',
          speaker: 'A',
          text: "I'm a bit on edge today. What if nobody visits our campus soup stand at the festival?",
          ko: '오늘 좀 예민하고 긴장돼. 축제에서 아무도 우리 캠퍼스 수프 부스에 안 오면 어떡하지?',
        },
      ],
      expressions: ["I'm a bit on edge today."],
      sourceFilms: ['Inside Out 2'],
      imageUrl: '/src/assets/images/beat_1_hook_1795578094381.jpg',
    },
    {
      id: 'beat-2',
      label: 'Problem',
      labelKo: '위기 (Problem)',
      startSec: 7,
      endSec: 15,
      durationSec: 8,
      sceneDescription: 'Clouds gather and visitors head indoors.',
      sceneDescriptionKo: '먹구름이 몰려오고 구경하던 학생들이 학생회관 실내로 들어가기 시작한다.',
      dialogue: [
        {
          id: 'line-2-1',
          speaker: 'B',
          text: 'It looks like rain.',
          ko: '비가 올 것 같아.',
        },
        {
          id: 'line-2-2',
          speaker: 'A',
          text: "Everyone's leaving! I was going to sell everything, but look at those clouds.",
          ko: '다들 가고 있어! 전부 팔려고 했는데, 저 먹구름 좀 봐.',
        },
      ],
      expressions: ['It looks like rain.', 'I was going to sell everything'],
      sourceFilms: ['Minari', 'Notting Hill'],
      imageUrl: '/src/assets/images/beat_2_problem_v2_1795579751164.jpg',
    },
    {
      id: 'beat-3',
      label: 'Turn',
      labelKo: '전환 (Turn)',
      startSec: 15,
      endSec: 23,
      durationSec: 8,
      sceneDescription:
        'A points to the adjacent indoor festival space. They carry sealed soup containers safely inside.',
      sceneDescriptionKo:
        'A가 바로 옆 실내 축제 공간을 가리키고, 둘은 뚜껑을 닫은 수프 용기와 쟁반을 안전하게 안으로 옮긴다.',
      dialogue: [
        {
          id: 'line-3-1',
          speaker: 'A',
          text: "On second thoughts, let's take the soup inside.",
          ko: '다시 생각해 보니, 수프를 안으로 옮기자.',
        },
        {
          id: 'line-3-2',
          speaker: 'B',
          text: 'Here, let me help. Grab that tray!',
          ko: '자, 내가 도와줄게. 저 쟁반 잡아!',
        },
      ],
      expressions: ['On second thoughts', 'Here, let me help.'],
      sourceFilms: ['Notting Hill'],
      imageUrl: '/src/assets/images/beat_3_turn_v2_1795579752953.jpg',
    },
    {
      id: 'beat-4',
      label: 'Close',
      labelKo: '결말 (Close)',
      startSec: 23,
      endSec: 30,
      durationSec: 7,
      sceneDescription: 'Show a brief queue and then an empty pot.',
      sceneDescriptionKo:
        '실내 부스 앞에 손님들이 줄을 서서 수프를 사 가고, 마침내 커다란 냄비가 깨끗이 비워진다.',
      dialogue: [
        {
          id: 'line-4-1',
          speaker: 'B',
          text: "We sold every bowl! You've worked so hard today.",
          ko: '한 그릇도 남김없이 다 팔았어! 오늘 정말 고생했어.',
        },
        {
          id: 'line-4-2',
          speaker: 'A',
          text: 'That made my whole day.',
          ko: '그 덕분에 하루 종일 기분 좋았어.',
        },
      ],
      expressions: ["You've worked so hard today.", 'That made my whole day.'],
      sourceFilms: ['Minari', 'Inside Out 2'],
      imageUrl: '/src/assets/images/beat_4_close_v2_1795579753250.jpg',
    },
  ],
};

export const INITIAL_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    promptKo: '먹구름 때문에 계획을 바꿔야 할 때, "전부 팔려고 했었는데…"라는 과거의 의도를 나타내는 표현으로 빈칸에 알맞은 것은?',
    contextEn: '"Everyone\'s leaving! I ____________ everything, but look at those clouds."',
    options: [
      'was going to sell',
      'am on edge to sell',
      'made my whole day',
      'on second thoughts sold',
    ],
    correctIndex: 0,
    explanationKo:
      '노팅힐(Notting Hill) 패턴인 "was/were going to + 동사원형"은 과거에 ~하려고 했지만 상황이 달라졌을 때 자연스럽게 쓰입니다.',
    movie: 'Notting Hill',
  },
  {
    id: 'q2',
    promptKo: '야외 부스 앞에서 손님이 안 올까 봐 초조해하는 A가 "오늘 좀 예민하고 긴장돼."라고 말할 때 쓴 표현은?',
    contextEn: '"____________ What if nobody visits our campus soup stand?"',
    options: [
      'It looks like rain.',
      "I'm a bit on edge today.",
      'Here, let me help.',
      "You've worked so hard today.",
    ],
    correctIndex: 1,
    explanationKo:
      '인사이드 아웃 2(Inside Out 2)의 "be on edge"는 신경이 날카롭거나 긴장·불안한 상태를 나타냅니다.',
    movie: 'Inside Out 2',
  },
  {
    id: 'q3',
    promptKo: 'B의 따뜻한 격려("오늘 정말 고생했어.")를 들은 A가 크게 기뻐하며 대답한 말로 알맞은 것은?',
    contextEn: 'B: "You\'ve worked so hard today."  A: "____________"',
    options: [
      'On second thoughts.',
      'It looks like rain.',
      'That made my whole day.',
      'Grab that tray!',
    ],
    correctIndex: 2,
    explanationKo:
      '"That made my whole day."는 어떤 말이나 일 덕분에 하루 전체가 보람차고 행복해졌을 때 쓰는 최고의 리액션입니다.',
    movie: 'Inside Out 2',
  },
];
