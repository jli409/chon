export type QuestionType = 'multiple-choice' | 'text-input' | 'scale-question';
export type QuestionnaireType = 'mother' | 'corporate' | 'other' | 'both';

export interface Option {
  id: string;
  textEn: string;
  textZh: string;
}

export interface ScaleLabels {
  minEn: string;
  minZh: string;
  maxEn: string;
  maxZh: string;
}

export interface Question {
  id: number;
  type: QuestionType;
  textEn: string;
  textZh: string;
  options?: Option[];
  scaleLabels?: ScaleLabels;
  tags?: string[];
}

export interface PrivacyStatement {
  titleEn: string;
  titleZh: string;
  contentEn: string;
  contentZh: string;
}

export interface QuestionnaireContext {
  type: QuestionnaireType;
  totalQuestions: number;
  questions: Question[];
  privacyStatement?: PrivacyStatement;
  uniqueIdMapping?: Record<string, number>;
}

export const questionnaires: Record<QuestionnaireType, QuestionnaireContext> = {
  mother: {
    type: 'mother',
    totalQuestions: 50,
    questions: [
      {
        id: 1,
        type: 'multiple-choice',
        textEn: 'What is your age range?',
        textZh: '您的年龄是？',
        options: [
          { id: 'A', textEn: 'Under 18', textZh: '18岁以下' },
          { id: 'B', textEn: '18 - 24', textZh: '18 - 24' },
          { id: 'C', textEn: '25 - 34', textZh: '25 - 34' },
          { id: 'D', textEn: '35 - 44', textZh: '35 - 44' },
          { id: 'E', textEn: '45 - 54', textZh: '45 - 54' },
          { id: 'F', textEn: '55 - 64', textZh: '55 - 64' },
          { id: 'G', textEn: '65 or above', textZh: '65岁及以上' }
        ]
      },
      {
        id: 2,
        type: 'multiple-choice',
        textEn: 'Where are you currently based?',
        textZh: '您目前所在的地区是？',
        options: [
          { id: 'A', textEn: 'Asia', textZh: '亚洲' },
          { id: 'B', textEn: 'North America', textZh: '北美' },
          { id: 'C', textEn: 'South America', textZh: '南美' },
          { id: 'D', textEn: 'Europe', textZh: '欧洲' },
          { id: 'E', textEn: 'Africa', textZh: '非洲' },
          { id: 'F', textEn: 'Australia/Oceania', textZh: '澳大利亚/大洋洲' }
        ]
      },
      {
        id: 3,
        type: 'multiple-choice',
        textEn: 'Have you worked in a for-profit corporate setting, currently or in the past?',
        textZh: '您目前或过去是否在营利性企业环境中工作过？',
        options: [
          { id: 'A', textEn: 'Yes', textZh: '是' },
          { id: 'B', textEn: 'No', textZh: '否' }
        ]
      },
      {
        id: 4,
        type: 'multiple-choice',
        textEn: 'How many children do you have or are expecting to have?',
        textZh: '您有或预计有多少个孩子？',
        options: [
          { id: 'A', textEn: '1', textZh: '1 个' },
          { id: 'B', textEn: '2', textZh: '2 个' },
          { id: 'C', textEn: '3', textZh: '3 个' },
          { id: 'D', textEn: '4 or more', textZh: '4 个或更多' }
        ]
      },
      {
        id: 5,
        type: 'multiple-choice',
        textEn: 'How many weeks did you experience noticeable morning sickness?',
        textZh: '您经历了几个妊娠期有明显的孕吐反应？',
        options: [
          { id: 'A', textEn: 'None', textZh: '无' },
          { id: 'B', textEn: '1 trimester', textZh: '1个妊娠期' },
          { id: 'C', textEn: '2 trimesters', textZh: '2个妊娠期' },
          { id: 'D', textEn: 'Entire pregnancy', textZh: '整个孕期' }
        ]
      },
      {
        id: 6,
        type: 'text-input',
        textEn: "What was your youngest child's birth weight?",
        textZh: '您第一胎宝宝的出生体重是多少？'
      },
      {
        id: 7,
        type: 'multiple-choice',
        textEn: 'How long was your maternity leave?',
        textZh: '您的产假有多长时间？',
        options: [
          { id: 'A', textEn: '<8 weeks', textZh: '少于8周' },
          { id: 'B', textEn: '8-14 weeks', textZh: '8-14周' },
          { id: 'C', textEn: '15-26 weeks', textZh: '15-26周' },
          { id: 'D', textEn: '27-52 weeks', textZh: '27-52周' },
          { id: 'E', textEn: '>1 year', textZh: '超过1年' }
        ]
      },
      {
        id: 8,
        type: 'multiple-choice',
        textEn: 'Did you receive any postpartum care services?',
        textZh: '您是否接受了产后护理或入住了月子中心？',
        options: [
          { id: 'A', textEn: 'Yes', textZh: '是' },
          { id: 'B', textEn: 'No', textZh: '否' }
        ]
      },
      {
        id: 9,
        type: 'text-input',
        textEn: 'Your postpartum emotions in one word',
        textZh: '一个词形容您的产后状态'
      },
      {
        id: 10,
        type: 'text-input',
        textEn: 'Motherhood experience in ten words',
        textZh: '十词形容您作为母亲的经历'
      },
      {
        id: 11,
        type: 'scale-question',
        textEn: 'How involved are you with previous social life from work after pregnancy?',
        textZh: '您觉得怀孕后自己与以往工作的社交联系程度如何？',
        scaleLabels: {
          minEn: 'Not involved at all',
          minZh: '完全未参与',
          maxEn: 'Very involved',
          maxZh: '非常投入'
        },
        tags: ['社交情商']
      },
      {
        id: 12,
        type: 'scale-question',
        textEn: 'How well does your work arrangement support your needs?',
        textZh: '您怀孕后的工作安排对您有多大支持作用？',
        scaleLabels: {
          minEn: 'Not supportive at all',
          minZh: '完全不支持',
          maxEn: 'Extremely supportive',
          maxZh: '非常支持'
        }
      },
      {
        id: 13,
        type: 'scale-question',
        textEn: 'How connected do you feel to your professional identity?',
        textZh: '您对自己的职业身份感有多强？',
        scaleLabels: {
          minEn: 'Not connected - motherhood is full priority',
          minZh: '完全不强 - 母亲角色优先',
          maxEn: 'Very connected - profession is important',
          maxZh: '非常强 - 职业身份很重要'
        },
        tags: ['自我意识']
      },
      {
        id: 14,
        type: 'scale-question',
        textEn: 'How has motherhood impacted your career progression or promotion opportunities?',
        textZh: '母亲身份对您的职业发展机会有何影响？',
        scaleLabels: {
          minEn: 'Very negative - significantly hindered',
          minZh: '非常负面 - 明显阻碍',
          maxEn: 'Very positive - enhanced opportunities',
          maxZh: '非常积极 - 提升机会'
        }
      },
      {
        id: 15,
        type: 'scale-question',
        textEn: 'How capable are you with the current support your employer provides?',
        textZh: '您运用公司提供的支持的能力如何？',
        scaleLabels: {
          minEn: 'Not capable of being supported',
          minZh: '完全不能运用',
          maxEn: 'Extremely supported',
          maxZh: '非常能运用'
        },
        tags: ['自我意识']
      },
      {
        id: 16,
        type: 'scale-question',
        textEn: 'How has motherhood influenced your leadership or management style at work?',
        textZh: '母亲身份如何影响了您在工作中的领导或管理风格？',
        scaleLabels: {
          minEn: 'Negative - worse at communication',
          minZh: '消极影响 - 降低沟通能力',
          maxEn: 'Positive - better at communication',
          maxZh: '积极影响 - 提升沟通能力'
        },
        tags: ['情绪调节']
      },
      {
        id: 17,
        type: 'scale-question',
        textEn: 'How effective are you at managing work-related stress since becoming a mother?',
        textZh: '自成为母亲后，您应对工作压力的能力如何？',
        scaleLabels: {
          minEn: 'Much less - harder to manage stress now',
          minZh: '更低效 - 更难应对压力',
          maxEn: 'Much more - strengthened my resilience',
          maxZh: '更有效 - 增强了韧性'
        },
        tags: ['核心耐力', '情绪调节']
      },
      {
        id: 18,
        type: 'scale-question',
        textEn: 'How motivated do you feel to pursue career growth since becoming a mother?',
        textZh: '自成为母亲后，您在职业发展方面的动力有多强？',
        scaleLabels: {
          minEn: 'Not motivated at all',
          minZh: '完全没有',
          maxEn: 'Very motivated',
          maxZh: '非常强'
        },
        tags: ['核心耐力']
      },
      {
        id: 19,
        type: 'scale-question',
        textEn: 'How satisfy are you with your ability to maintain work-life balance?',
        textZh: '您对您目前工作与生活平衡的能力感到满意吗？',
        scaleLabels: {
          minEn: 'Very dissatisfied',
          minZh: '非常不满意',
          maxEn: 'Very satisfied',
          maxZh: '非常满意'
        },
        tags: ['自我意识']
      },
      {
        id: 20,
        type: 'scale-question',
        textEn: 'How often do you feel your needs as a mother are taken into account during important workplace decisions?',
        textZh: '在重要的职场决策中，您觉得作为职场母亲的需求被考虑的频率如何？',
        scaleLabels: {
          minEn: 'Never - completely overlooked',
          minZh: '从未 - 完全未被考虑',
          maxEn: 'Always - consistently considered',
          maxZh: '总是 - 经常被考虑'
        },
        tags: ['自我意识']
      },
      {
        id: 21,
        type: 'scale-question',
        textEn: 'How connected do you feel with other mothers through your work?',
        textZh: '您在工作中与其他母亲的联系如何？',
        scaleLabels: {
          minEn: 'Very disconnected - no connection',
          minZh: '非常弱 - 没有联系',
          maxEn: 'Very connected - strong networks',
          maxZh: '非常强 - 紧密网络'
        },
        tags: ['社交情商']
      },
      {
        id: 22,
        type: 'scale-question',
        textEn: 'Do you seek more opportunities to connect with other mothers through your profession?',
        textZh: '您是否寻求更多与其他职场母亲建立联系的机会？',
        scaleLabels: {
          minEn: 'Never',
          minZh: '从不',
          maxEn: 'Always',
          maxZh: '经常'
        },
        tags: ['社交情商']
      },
      {
        id: 23,
        type: 'multiple-choice',
        textEn: 'If you were the god or goddess of the business world and could change or create one thing from the following, what would it be?',
        textZh: '如果您是商业世界的创造神，并且可以创造或改变以下任何一件事，您会改变什么？',
        options: [
          { id: 'A', textEn: 'Redistribute corporate shares so that every individual owns a piece of every business', textZh: '重新分配公司股份，让每个人都能在每家企业中分一杯羹' },
          { id: 'B', textEn: 'Create 72 versions of yourself, each mastering a different industry', textZh: '创造72个化身，每个精通一个不同的行业' },
          { id: 'C', textEn: 'Transform into an omnipotent prophet that oversees and predicts moves of everyone in the business world', textZh: '化身为全知预言家，精准观测并预测商业世界中每个人的行动' },
          { id: 'D', textEn: 'Imbue every product of my organization with divine allure, making it irresistible to all', textZh: '赋予我的企业所有产品神圣吸引力，让所有人都无法抗拒' },
          { id: 'E', textEn: 'Reconstruct the entire economic system to achieve absolute perfection and sustainability', textZh: '重塑所有经济体系，实现绝对完美与可持续发展' },
          { id: 'F', textEn: 'Ensure that no matter what happens, my organization always stays ahead and outmaneuvers my competitors', textZh: '确保无论发生什么，我的企业始终超越我的竞争对手' }
        ]
      },
      {
        id: 24,
        type: 'scale-question',
        textEn: 'How well do you think logical thinking would address emotional and life concerns?',
        textZh: '您认为加强抽象逻辑思维对解决情感和生活问题有多大帮助？',
        scaleLabels: {
          minEn: 'Not well - No link with emotions',
          minZh: '完全不行 - 毫无关系',
          maxEn: 'Extremely well - Very effective',
          maxZh: '非常好 - 极其有效'
        },
        tags: ['客观能力', '情绪调节']
      },
      {
        id: 25,
        type: 'scale-question',
        textEn: 'Do you believe that self-love and the ability to care for others require strong logic to navigate challenges in life?',
        textZh: '你认为自爱和关爱他人的能力在多大程度上需要逻辑思维来解决生活中的挑战？',
        scaleLabels: {
          minEn: 'Strongly disagree',
          minZh: '非常不同意',
          maxEn: 'Strongly agree',
          maxZh: '非常同意'
        }
      },
      {
        id: 26,
        type: 'scale-question',
        textEn: 'How valuable do you find having a professional page within our app to showcase your previous work?',
        textZh: '您觉得在应用内拥有一个用于展示以往工作的职业页面有多大价值？',
        scaleLabels: {
          minEn: 'Not valuable at all',
          minZh: '完全没有价值',
          maxEn: 'Extremely valuable',
          maxZh: '非常有价值'
        },
        tags: ['自我意识']
      },
      {
        id: 27,
        type: 'scale-question',
        textEn: 'How likely are you to use our app to share completed projects or achievements for deal sourcing or client acquisition?',
        textZh: '您有多大可能使用该应用分享完成的商业项目或工作成就，以寻找合作机会或获取客户？',
        scaleLabels: {
          minEn: 'Very unlikely',
          minZh: '完全不可能',
          maxEn: 'Very likely',
          maxZh: '非常可能'
        },
        tags: ['客观能力']
      },
      {
        id: 28,
        type: 'scale-question',
        textEn: 'How valuable would you find a feature to stay updated with trends in your professional field?',
        textZh: '您认为一个帮助了解其行业领域最新动态的功能有多大用处？',
        scaleLabels: {
          minEn: 'Not valuable',
          minZh: '毫无价值 - 毫无益处',
          maxEn: 'Extremely valuable',
          maxZh: '极具价值 - 职业发展必备'
        },
        tags: ['奉献精神']
      },
      {
        id: 29,
        type: 'scale-question',
        textEn: 'How likely are you to use a forum to connect with medical resources for health support?',
        textZh: '您有多大可能使用与医疗资源联系的论坛以获得医疗支持？',
        scaleLabels: {
          minEn: 'Very unlikely',
          minZh: '完全不可能',
          maxEn: 'Very likely',
          maxZh: '非常可能'
        },
        tags: ['社交情商']
      },
      {
        id: 30,
        type: 'scale-question',
        textEn: 'How valuable do you think a forum would be in helping you feel less isolated as a working mother?',
        textZh: '您认为论坛在帮助您增进作为职场母亲与别的职场母亲连接方面有多大价值？',
        scaleLabels: {
          minEn: 'Not valuable at all',
          minZh: '完全没有价值',
          maxEn: 'Extremely valuable',
          maxZh: '非常有价值'
        },
        tags: ['自我意识', '社交情商']
      },
      {
        id: 31,
        type: 'scale-question',
        textEn: 'How motivated are you to use visuospatial training modules within our app to strengthen logical thinking?',
        textZh: '您有多大动力使用应用内的视觉空间和逻辑训练模块？',
        scaleLabels: {
          minEn: 'Not motivated at all',
          minZh: '完全没有动力',
          maxEn: 'Very motivated',
          maxZh: '非常有动力'
        },
        tags: ['客观能力']
      },
      {
        id: 32,
        type: 'scale-question',
        textEn: 'How helpful do you think the training would be in enhancing your problem-solving abilities?',
        textZh: '您认为此训练对提升您解决问题的能力有多大帮助？',
        scaleLabels: {
          minEn: 'Not helpful at all',
          minZh: '完全无帮助',
          maxEn: 'Extremely helpful',
          maxZh: '非常有帮助'
        },
        tags: ['客观能力']
      },
      {
        id: 33,
        type: 'scale-question',
        textEn: 'How engaging do you think it would be to create and interact with an electronic child avatar in your personal profile?',
        textZh: '您觉得在个人主页中创建并与自定义的"电子小孩"虚拟形象互动的这个功能有多大吸引力？',
        scaleLabels: {
          minEn: 'Not engaging at all',
          minZh: '完全无吸引力',
          maxEn: 'Very engaging',
          maxZh: '非常有吸引力'
        },
        tags: ['社交情商']
      },
      {
        id: 34,
        type: 'scale-question',
        textEn: 'How would you like a company-specific AI model offering work-related productivity features for you and other mothers?',
        textZh: '您如何看待一个专门为每家公司定制的职场母亲专用人工智能模型？',
        scaleLabels: {
          minEn: 'Not valuable -- completely unnecessary',
          minZh: '毫无必要 -- 完全不需要',
          maxEn: 'Extremely helpful -- enhances efficiency',
          maxZh: '极具价值 -- 提升效率'
        },
        tags: ['客观能力']
      },
      {
        id: 35,
        type: 'scale-question',
        textEn: 'How do you feel about requiring you to submit a confidential child health-related record to verify that you and other users are active caregivers?',
        textZh: '您如何看待要求您在使用本应用程序之前提交与儿童健康相关的保密记录，以证实您是孩子的照顾者？',
        scaleLabels: {
          minEn: 'Strongly oppose -- utterly invasive',
          minZh: '强烈反对 - 违反隐私',
          maxEn: 'Strongly support -- ensures safety and trust',
          maxZh: '强烈支持 - 保障安全的基础'
        },
        tags: ['客观能力']
      },
      {
        id: 36,
        type: 'scale-question',
        textEn: 'Do you believe misuse by unintended users (including your partner without permission) could negatively affect trust in the app?',
        textZh: '您认为如果有非目标用户滥用该平台（包括您的生活伴侣未经允许访问账户等情况），是否会对用户对本应用的信任度产生负面影响？',
        scaleLabels: {
          minEn: 'Definitely no -- no trust risk',
          minZh: '绝对不 -- 完全无风险',
          maxEn: 'Definitely yes -- severely undermines trust',
          maxZh: '绝对会 -- 严重破坏信任'
        }
      },
      {
        id: 37,
        type: 'scale-question',
        textEn: 'How do you feel about your company verifying through HR that business updates and activities posted on this platform are by yourself and other mother users, not others misusing their accounts?',
        textZh: '您如何看待由公司人力资源部门核查平台上的业务更新和动态确实由目标用户本人发布，而非他人滥用账户？',
        scaleLabels: {
          minEn: 'Strongly oppose',
          minZh: '强烈反对',
          maxEn: 'Strongly support',
          maxZh: '强烈支持'
        },
        tags: ['自我意识']
      },
      {
        id: 38,
        type: 'scale-question',
        textEn: 'How important are empathy, compassion, and selflessness associated with motherhood in leadership and life?',
        textZh: '您认为母亲体现出的同理心、关爱与无私，对成功的领导力和人生有多重要？',
        scaleLabels: {
          minEn: 'Not important at all',
          minZh: '完全不重要',
          maxEn: 'Extremely important',
          maxZh: '极其重要'
        },
        tags: ['社交情商']
      },
      {
        id: 39,
        type: 'scale-question',
        textEn: 'How important are resilience and perseverance associated with motherhood in leadership and life?',
        textZh: '您认为母亲展现出的韧性和毅力对成功的领导力和人生有多重要？',
        scaleLabels: {
          minEn: 'Not important at all',
          minZh: '完全不重要',
          maxEn: 'Extremely important',
          maxZh: '极其重要'
        },
        tags: ['核心耐力']
      },
      {
        id: 40,
        type: 'scale-question',
        textEn: 'How valuable are communication and listening associated with motherhood in leadership and life?',
        textZh: '您认为母亲身上的沟通与倾听能力对成功的领导力和人生有多重要？',
        scaleLabels: {
          minEn: 'Not valuable at all',
          minZh: '完全不重要',
          maxEn: 'Extremely important',
          maxZh: '极其重要'
        },
        tags: ['社交情商']
      },
      {
        id: 41,
        type: 'scale-question',
        textEn: 'How crucial are responsibility and accountability associated with motherhood in leadership and life?',
        textZh: '您认为母亲身上的责任感和担当对成功的领导力和人生有多重要？',
        scaleLabels: {
          minEn: 'Not important at all',
          minZh: '完全不重要',
          maxEn: 'Extremely important',
          maxZh: '极其重要'
        },
        tags: ['奉献精神']
      },
      {
        id: 42,
        type: 'scale-question',
        textEn: 'How prepared did you feel for motherhood before becoming a mother?',
        textZh: '在成为母亲之前，您觉得自己对母亲这一角色的准备程度如何？',
        scaleLabels: {
          minEn: 'Not prepared at all',
          minZh: '完全没有准备',
          maxEn: 'Very prepared',
          maxZh: '非常充分'
        },
        tags: ['核心耐力']
      },
      {
        id: 43,
        type: 'scale-question',
        textEn: 'How much has motherhood changed your personal values or priorities?',
        textZh: '母亲身份对您的个人价值观或人生优先事项改变有多大？',
        scaleLabels: {
          minEn: 'No change',
          minZh: '没有改变',
          maxEn: 'Completely',
          maxZh: '完全改变'
        },
        tags: ['自我意识']
      },
      {
        id: 44,
        type: 'scale-question',
        textEn: 'How supported do you feel by your family or community in your motherhood journey?',
        textZh: '在做母亲的过程中，您觉得家人或社群对您的支持程度如何？',
        scaleLabels: {
          minEn: 'Not supported at all',
          minZh: '完全没有支持',
          maxEn: 'Extremely supported',
          maxZh: '非常支持'
        },
        tags: ['社交情商']
      },
      {
        id: 45,
        type: 'scale-question',
        textEn: 'How much emotional fulfillment has motherhood brought to your life?',
        textZh: '母亲身份为您的生活带来了多少情绪满足感？',
        scaleLabels: {
          minEn: 'No emotion at all',
          minZh: '完全没有情感',
          maxEn: 'Extremely fulfilling',
          maxZh: '非常满足'
        },
        tags: ['奉献精神']
      },
      {
        id: 46,
        type: 'scale-question',
        textEn: 'How much do you feel that motherhood has made you more resilient or emotionally strong?',
        textZh: '母亲身份是否让您在情感方面变得更有韧性或更强大？',
        scaleLabels: {
          minEn: 'Much weaker',
          minZh: '明显减弱',
          maxEn: 'Much stronger',
          maxZh: '显著增强'
        },
        tags: ['情绪调节', '核心耐力']
      },
      {
        id: 47,
        type: 'scale-question',
        textEn: 'How has motherhood affected your ability to set boundaries (e.g., with work, family, or friends) in life?',
        textZh: '母亲身份对您设定边界（如与工作、家庭或朋友）能力的影响如何？',
        scaleLabels: {
          minEn: 'Significantly weakened',
          minZh: '显著减弱',
          maxEn: 'Improved greatly',
          maxZh: '显著提升'
        },
        tags: ['自我意识']
      },
      {
        id: 48,
        type: 'scale-question',
        textEn: 'How often do you feel pressure to meet external expectations of motherhood (e.g., societal, cultural, or family expectations)?',
        textZh: '您多久感受到来自外界对母亲角色（如社会、文化或家庭）的期待压力？',
        scaleLabels: {
          minEn: 'Never',
          minZh: '从不',
          maxEn: 'Always',
          maxZh: '总是'
        },
        tags: ['自我意识']
      },
      {
        id: 49,
        type: 'scale-question',
        textEn: 'How satisfied are you with the balance between your motherhood role and your sense of self outside of being a mother?',
        textZh: '您对自己平衡母亲这一身份与作为母亲之外的自我身份有多满意？',
        scaleLabels: {
          minEn: 'Very dissatisfied',
          minZh: '非常不满意',
          maxEn: 'Very satisfied',
          maxZh: '非常满意'
        },
        tags: ['自我意识']
      },
      {
        id: 50,
        type: 'scale-question',
        textEn: 'How much do you feel that your own mother\'s role influenced your early understanding of leadership or responsibility?',
        textZh: '您认为您的母亲在多大程度上影响了童年时期您对领导力或责任感的认知？',
        scaleLabels: {
          minEn: 'Not at all',
          minZh: '没有影响',
          maxEn: 'Very strongly',
          maxZh: '非常深远'
        },
        tags: ['自我意识']
      }
    ],
    privacyStatement: {
      titleEn: 'Privacy Statement',
      titleZh: '隐私声明',
      contentEn: '<strong style="font-size: 1.2em;">Data Usage and Privacy Statement</strong><br><br>At CHON, your privacy is fundamental. We only collect the information necessary to deliver meaningful insights, and we protect it with the highest standards of security and integrity.<br><br><hr><br><strong style="font-size: 1.2em;">For Individual Participants</strong><br><br>Your personal information will be used solely for the following purposes:<br><ul><li>To verify your eligibility for specific sections of the survey</li><li>To support demographic and statistical analysis across participant groups</li><li>To generate your personalized CHON personality profile</li></ul>',
      contentZh: '<strong style="font-size: 1.2em;">数据使用与隐私声明</strong><br><br>在 CHON，我们将您的隐私视为基本原则。我们仅收集实现分析目的所必需的信息，并以最高标准保障数据的安全与完整性。<br><br><hr><br><strong style="font-size: 1.2em;">针对个人参与者</strong><br><br>您的个人信息将仅用于以下用途：<br><ul><li>验证您是否符合特定问卷部分的参与资格</li><li>用于不同人群的统计与人口特征分析</li><li>生成您的个性化 CHON 性格分析报告</li></ul>'
    },
    uniqueIdMapping: {
      "mother 1": 2,
      "mother 2": 3,
      "mother 3": 4,
      "mother 4": 54,
      "mother 5": 55,
      "mother 6": 56,
      "mother 7": 57,
      "mother 8": 58,
      "mother 9": 59,
      "mother 10": 60,
      "mother 11": 61,
      "mother 12": 62,
      "mother 13": 63,
      "mother 14": 64,
      "mother 15": 65,
      "mother 16": 66,
      "mother 17": 67,
      "mother 18": 68,
      "mother 19": 69,
      "mother 20": 70,
      "mother 21": 71,
      "mother 22": 72,
      "mother 23": 27,
      "mother 24": 28,
      "mother 25": 29,
      "mother 26": 73,
      "mother 27": 31,
      "mother 28": 30,
      "mother 29": 33,
      "mother 30": 32,
      "mother 31": 34,
      "mother 32": 74,
      "mother 33": 35,
      "mother 34": 37,
      "mother 35": 40,
      "mother 36": 41,
      "mother 37": 42,
      "mother 38": 43,
      "mother 39": 44,
      "mother 40": 45,
      "mother 41": 46,
      "mother 42": 75,
      "mother 43": 76,
      "mother 44": 77,
      "mother 45": 78,
      "mother 46": 79,
      "mother 47": 80,
      "mother 48": 81,
      "mother 49": 82,
      "mother 50": 53
    }
  },
  corporate: {
    type: 'corporate',
    totalQuestions: 52,
    questions: [
      {
        id: 1,
        type: 'multiple-choice',
        textEn: "What's your biological sex at birth?",
        textZh: '您出生时的生理性别是什么？',
        options: [
          { id: 'A', textEn: 'Female', textZh: '女' },
          { id: 'B', textEn: 'Male', textZh: '男' }
        ]
      },
      {
        id: 2,
        type: 'multiple-choice',
        textEn: 'What is your age range?',
        textZh: '您的年龄是？',
        options: [
          { id: 'A', textEn: 'Under 18', textZh: '18岁以下' },
          { id: 'B', textEn: '18 - 24', textZh: '18 - 24' },
          { id: 'C', textEn: '25 - 34', textZh: '25 - 34' },
          { id: 'D', textEn: '35 - 44', textZh: '35 - 44' },
          { id: 'E', textEn: '45 - 54', textZh: '45 - 54' },
          { id: 'F', textEn: '55 - 64', textZh: '55 - 64' },
          { id: 'G', textEn: '65 or above', textZh: '65岁及以上' }
        ]
      },
      {
        id: 3,
        type: 'multiple-choice',
        textEn: 'Where are you currently based?',
        textZh: '您目前所在的地区是？',
        options: [
          { id: 'A', textEn: 'Asia', textZh: '亚洲' },
          { id: 'B', textEn: 'North America', textZh: '北美' },
          { id: 'C', textEn: 'South America', textZh: '南美' },
          { id: 'D', textEn: 'Europe', textZh: '欧洲' },
          { id: 'E', textEn: 'Africa', textZh: '非洲' },
          { id: 'F', textEn: 'Australia/Oceania', textZh: '澳大利亚/大洋洲' },
        ]
      },
      {
        id: 4,
        type: 'text-input',
        textEn: 'What is your current / most recent job position?',
        textZh: '您目前的职位名称是什么？'
      },
      {
        id: 5,
        type: 'text-input',
        textEn: 'What is your professional contact (e.g., email, LinkedIn)?',
        textZh: '请问您的职业联系方式是什么（例如：邮箱、领英）？'
      },
      {
        id: 6,
        type: 'multiple-choice',
        textEn: 'How many years of experience do you have in a managerial or leadership role?',
        textZh: '您在管理或领导岗位上有多少年的工作经验？',
        options: [
          { id: 'A', textEn: '1-3 years', textZh: '1-3年' },
          { id: 'B', textEn: '4-6 years', textZh: '4-6年' },
          { id: 'C', textEn: '7-9 years', textZh: '7-9年' },
          { id: 'D', textEn: '10+ years', textZh: '10年以上' }
        ]
      },
      {
        id: 7,
        type: 'multiple-choice',
        textEn: 'Which industry or business sector does your company operate in?',
        textZh: '贵公司属于哪个行业或业务领域？',
        options: [
          { id: 'A', textEn: 'Consumer Goods & Retail', textZh: '消费品和零售' },
          { id: 'B', textEn: 'Education & Business Professional Services', textZh: '教育和商业专业服务' },
          { id: 'C', textEn: 'Energy & Utilities', textZh: '能源和公用事业' },
          { id: 'D', textEn: 'Entertainment & Media', textZh: '娱乐和媒体' },
          { id: 'E', textEn: 'Financial Services', textZh: '金融服务' },
          { id: 'F', textEn: 'Government, Nonprofits & Public Services', textZh: '政府、非营利和公共服务' },
          { id: 'G', textEn: 'Healthcare & Pharmaceuticals', textZh: '医疗保健和制药' },
          { id: 'H', textEn: 'Industrial Production & Manufacturing', textZh: '工业生产和制造' },
          { id: 'I', textEn: 'Real Estate & Construction', textZh: '房地产和建筑' },
          { id: 'J', textEn: 'Technology & Telecommunications', textZh: '技术和电信' },
          { id: 'K', textEn: 'Transportation & Logistics', textZh: '运输和物流' }
        ]
      },
      {
        id: 8,
        type: 'multiple-choice',
        textEn: "What is your company's total employee headcount?",
        textZh: '贵公司的员工总人数是多少？',
        options: [
          { id: 'A', textEn: 'Fewer than 50', textZh: '少于50人' },
          { id: 'B', textEn: '50-249', textZh: '50-249' },
          { id: 'C', textEn: '250-999', textZh: '250-999' },
          { id: 'D', textEn: '1,000-9,999', textZh: '1,000-9,999' },
          { id: 'E', textEn: '10,000-99,999', textZh: '10,000-99,999' },
          { id: 'F', textEn: '100,000 or more', textZh: '100,000人及以上' }
        ]
      },
      {
        id: 9,
        type: 'multiple-choice',
        textEn: "What is the approximate annual revenue of your company?",
        textZh: '贵公司的年营收大约是多少？',
        options: [
          { id: 'A', textEn: 'Less than $10 million', textZh: '少于1000万' },
          { id: 'B', textEn: '$10-50 million', textZh: '1000万-5000万' },
          { id: 'C', textEn: '$50-500 million', textZh: '5000万-5亿' },
          { id: 'D', textEn: '$500 million-$10 billion', textZh: '5亿-100亿' },
          { id: 'E', textEn: '$10-100 billion', textZh: '100亿-1000亿' },
          { id: 'F', textEn: 'Over $100 billion', textZh: '超过1000亿' }
        ]
      },
      {
        id: 10,
        type: 'multiple-choice',
        textEn: 'What is the approximate size of your direct span of control?',
        textZh: '您的直接管理团队规模是多少？',
        options: [
          { id: 'A', textEn: '1-5 people', textZh: '1-5人' },
          { id: 'B', textEn: '6-15 people', textZh: '6-15人' },
          { id: 'C', textEn: '16-30 people', textZh: '16-30人' },
          { id: 'D', textEn: '30-50 people', textZh: '30-50人' },
          { id: 'E', textEn: 'More than 50 people', textZh: '50人以上' }
        ]
      },
      {
        id: 11,
        type: 'multiple-choice',
        textEn: 'What is the approximate size of your indirect span of control?',
        textZh: '您简介管理多少人？',
        options: [
          { id: 'A', textEn: '1-15 people', textZh: '1-15人' },
          { id: 'B', textEn: '16-50 people', textZh: '11-50人' },
          { id: 'C', textEn: '51-200 people', textZh: '51-200人' },
          { id: 'D', textEn: '200-500 people', textZh: '200-500人' },
          { id: 'E', textEn: 'More than 500 people', textZh: '500人以上' }
        ]
      },
      {
        id: 12,
        type: 'text-input',
        textEn: 'Describe the overall reporting structure within your team in ten words',
        textZh: '请在十字以内描述您团队中的整体报告结构'
      },
      {
        id: 13,
        type: 'scale-question',
        textEn: 'How would you describe the decision-making structure in your organization?',
        textZh: '您如何描述贵公司决策体系的运作方式？',
        scaleLabels: {
          minEn: 'Highly centralized',
          minZh: '高度集中化',
          maxEn: 'Flexibly adaptive',
          maxZh: '灵活变通'
        }
      },
      {
        id: 14,
        type: 'scale-question',
        textEn: 'In your opinion, what should be the primary basis of decision-making authority in your organization?',
        textZh: '在您看来，贵司的决策权应该主要基于什么？',
        scaleLabels: {
          minEn: 'Rigid policies & Top-down command',
          minZh: '严格的政策和自上而下的指挥',
          maxEn: 'Entirely based on individual\'s ability',
          maxZh: '完全基于个人能力'
        },
        tags: ['客观能力']
      },
      {
        id: 15,
        type: 'scale-question',
        textEn: 'How well-organized would you say your team structure is under your leadership?',
        textZh: '您认为在您的领导下，您的团队结构有多有序和高效？',
        scaleLabels: {
          minEn: 'Not organized',
          minZh: '缺乏组织性',
          maxEn: 'Very well-organized',
          maxZh: '组织性非常强'
        },
        tags: ['客观能力', '核心耐力']
      },
      {
        id: 16,
        type: 'scale-question',
        textEn: 'How would you rate your team\'s level of communication and collaboration under your leadership?',
        textZh: '您认为在您的领导下，您的团队的沟通与协作水平如何？',
        scaleLabels: {
          minEn: 'Very poor -- Lack communication & efficiency',
          minZh: '非常差 --- 缺乏沟通和效率',
          maxEn: 'Excellent -- Great communication & efficiency',
          maxZh: '非常好 --- 极好的沟通和效率'
        },
        tags: ['客观能力', '社交情商']
      },
      {
        id: 17,
        type: 'scale-question',
        textEn: 'How would you rate your experience in communicating and establishing trust with clients or business partners?',
        textZh: '您如何评价自己在与客户或业务伙伴沟通及建立信任方面的经验？',
        scaleLabels: {
          minEn: 'Very poor -- significant challenges',
          minZh: '非常差 -- 极大挑战',
          maxEn: 'Excellent -- effective and trusted',
          maxZh: '非常好 -- 有效、可信'
        },
        tags: ['社交能力', '情商']
      },
      {
        id: 18,
        type: 'scale-question',
        textEn: 'How effective do you believe your organization is at understanding client or market needs?',
        textZh: '您认为贵司在理解客户或市场需求方面的效果如何？',
        scaleLabels: {
          minEn: 'Very poor -- insufficient understanding',
          minZh: '非常差 -- 不充分了解',
          maxEn: 'Excellent -- exceeds expectations',
          maxZh: '非常好 -- 超出预期'
        },
        tags: ['社交能力', '情商']
      },
      {
        id: 19,
        type: 'scale-question',
        textEn: 'How important do you think responsibility is in building successful business projects?',
        textZh: '您认为责任感对商业项目的成功有多重要？',
        scaleLabels: {
          minEn: 'Not important at all',
          minZh: '完全不重要',
          maxEn: 'Extremely important',
          maxZh: '极其重要'
        },
        tags: ['客观能力', '奉献精神']
      },
      {
        id: 20,
        type: 'scale-question',
        textEn: 'How important do you think empathy and communication are in building successful business relationships?',
        textZh: '您认为同理心和沟通能力在建立成功的商业关系中有多重要？',
        scaleLabels: {
          minEn: 'Not important at all',
          minZh: '完全不重要',
          maxEn: 'Extremely important',
          maxZh: '极其重要'
        },
        tags: ['奉献精神', '社交情商']
      },
      {
        id: 21,
        type: 'scale-question',
        textEn: 'How would you describe the current recognition and utilization of the "soft skills" of kindness, responsibility, empathy, and communication in your company?',
        textZh: '您如何描述贵司目前对"软实力"（善良、责任心、同理心、沟通能力）的认可和使用情况？',
        scaleLabels: {
          minEn: 'Not recognized at all',
          minZh: '完全不认可',
          maxEn: 'Highly recognized and utilized',
          maxZh: '高度认可和利用'
        },
        tags: ['奉献精神']
      },
      {
        id: 22,
        type: 'multiple-choice',
        textEn: 'Do you think men and women are equally supported in your industry when it comes to balancing work and family?',
        textZh: '在您的行业中, 您认为男性和女性是否在平衡工作与家庭方面得到了同等支持？',
        options: [
          { id: 'A', textEn: 'No, one is significantly less supported', textZh: '不是，其一得到的很少同等支持' },
          { id: 'B', textEn: 'Yes, equally supported', textZh: '是的，两种性别都得到了平等支持' }
        ],
        tags: ['男：客观能力', '女：自我意识']
      },
      {
        id: 23,
        type: 'scale-question',
        textEn: 'In your opinion, how important is it for your organization to provide resources in the form of support and social bonding for working mothers?',
        textZh: '在您看来，公司为职场母亲提供情感支持和社交的资源有多重要？',
        scaleLabels: {
          minEn: 'Not important at all',
          minZh: '完全不重要',
          maxEn: 'Very important',
          maxZh: '非常重要'
        },
        tags: ['男：奉献精神', '女：自我意识']
      },
      {
        id: 24,
        type: 'scale-question',
        textEn: 'How would you describe your organization\'s current approach to supporting working mothers under your leadership?',
        textZh: '您如何描述贵司在您的领导下目前对职场母亲的支持程度？',
        scaleLabels: {
          minEn: 'Not supportive at all',
          minZh: '完全不支持',
          maxEn: 'Highly supportive with clear policies and resources, please specify',
          maxZh: '高度支持，有明确的政策和资源, 请阐述'
        },
        tags: ['男：奉献精神', '女：自我意识']
      },
      {
        id: 25,
        type: 'scale-question',
        textEn: 'How effectively do you use technology to support collaboration and productivity within your team?',
        textZh: '您在团队协作和生产力提升方面对科技的使用程度如何？',
        scaleLabels: {
          minEn: 'Not at all',
          minZh: '完全不使用',
          maxEn: 'Very effectively',
          maxZh: '非常有效地使用'
        },
        tags: ['客观能力']
      },
      {
        id: 26,
        type: 'multiple-choice',
        textEn: 'If you were the god or goddess of the business world and could change or create one thing from the following, what would it be?',
        textZh: '如果您是商业世界的创造神，并且可以创造或改变以下任何一件事，您会选择什么？',
        options: [
          { id: 'A', textEn: 'Redistribute all corporate shares so that every individual owns a piece of every business', textZh: '重新分配公司股份，让每个人都能在每家企业中分一杯羹' },
          { id: 'B', textEn: 'Create 72 versions of yourself, each mastering a different industry', textZh: '创造72个化身，每个精通一个不同的行业' },
          { id: 'C', textEn: 'Transform into an omnipotent prophet that oversees and predicts moves of everyone in the business world', textZh: '化身为全知预言家，精准观测并预测商业世界中每个人的行动' },
          { id: 'D', textEn: 'Imbue every product with divine allure, making it irresistible to all', textZh: '赋予所有产品神圣吸引力，让所有人都无法抗拒' },
          { id: 'E', textEn: 'Reconstruct the entire economic system to achieve absolute perfection and sustainability', textZh: '重塑所有经济体系，实现绝对完美与可持续发展' },
          { id: 'F', textEn: 'Ensure that no matter what happens, my business always stays ahead and outmaneuvers my competitors', textZh: '确保无论发生什么，我的企业始终超越我的竞争对手' }
        ]
      },
      {
        id: 27,
        type: 'scale-question',
        textEn: 'How well do you think enhanced abstract logical thinking would address emotional and life concerns?',
        textZh: '您认为加强抽象逻辑思维对解决情感和生活问题有多大帮助？',
        scaleLabels: {
          minEn: 'Not well - no link with emotions',
          minZh: '完全不行 - 毫无关系',
          maxEn: 'Extremely well - very effective',
          maxZh: '非常好 - 极其有效'
        },
        tags: ['客观能力', '情绪调节']
      },
      {
        id: 28,
        type: 'scale-question',
        textEn: 'Do you believe that self-love and the ability to care for others require strong logic to navigate challenges in life?',
        textZh: '你认为真正的自爱和关爱他人的能力在多大程度上需要强大的客观思维来解决生活中的挑战？',
        scaleLabels: {
          minEn: 'Strongly disagree',
          minZh: '非常不同意',
          maxEn: 'Strongly agree',
          maxZh: '非常同意'
        },
        tags: ['客观能力']
      },
      {
        id: 29,
        type: 'scale-question',
        textEn: 'How valuable would you find a feature that helps working mothers stay updated with trends and knowledge in their professional field?',
        textZh: '您认为一个帮助职场母亲了解其行业领域最新动态的功能有多大用处？',
        scaleLabels: {
          minEn: 'Not valuable',
          minZh: '毫无价值 - 毫无益处',
          maxEn: 'Extremely valuable',
          maxZh: '极具价值 - 职业发展必备'
        },
        tags: ['奉献精神']
      },
      {
        id: 30,
        type: 'scale-question',
        textEn: 'How valuable would a business opportunity board be, where working mothers on your team could post or access new projects and deals?',
        textZh: '您认为一个帮助职场母亲发布和获取商业交易和商业合作的功能有多大用处？',
        scaleLabels: {
          minEn: 'Not valuable',
          minZh: '毫无价值 - 完全不需要',
          maxEn: 'Highly valuable',
          maxZh: '极具价值 - 大幅提升发展'
        },
        tags: ['奉献精神']
      },
      {
        id: 31,
        type: 'scale-question',
        textEn: 'How do you perceive the value of a forum where mothers can share maternal experiences and emotional support?',
        textZh: '您认为一个帮助职场母亲分享育儿经验、获得情感支持的论坛有多大用处？',
        scaleLabels: {
          minEn: 'Not valuable',
          minZh: '毫无价值 - 完全不需要',
          maxEn: 'Extremely beneficial',
          maxZh: '极其有益 - 非常重要的连接'
        },
        tags: ['奉献精神']
      },
      {
        id: 32,
        type: 'scale-question',
        textEn: 'How valuable would direct access to external medical resouces for healthcare advice be within such an app?',
        textZh: '您认为提供联系外部医疗资源获得医学建议的功能有多大用处？',
        scaleLabels: {
          minEn: 'Not valuable',
          minZh: '毫无价值 - 完全不需要',
          maxEn: 'Extremely valuable',
          maxZh: '极具价值 - 健康必备'
        },
        tags: ['奉献精神']
      },
      {
        id: 33,
        type: 'scale-question',
        textEn: 'How beneficial would visuospatial and abstract logical training modules be for enhancing cognitive development?',
        textZh: '您认为视觉空间与数学逻辑训练模块对抽象逻辑发展有多大用处？',
        scaleLabels: {
          minEn: 'Not beneficial',
          minZh: '毫无价值 - 完全不需要',
          maxEn: 'Extremely beneficial',
          maxZh: '极具价值 - 提升效率'
        },
        tags: ['客观能力']
      },
      {
        id: 34,
        type: 'scale-question',
        textEn: 'How engaging do you think personalized profiles with interactive "electronic kids" avatars would be for promoting social interaction among working mothers?',
        textZh: '您认为通过个人主页中使用"电子小孩"互动来促进职场母亲之间社交互动的功能有多大用处？',
        scaleLabels: {
          minEn: 'Not engaging',
          minZh: '毫无价值 - 完全不需要',
          maxEn: 'Very engaging',
          maxZh: '极具价值 - 促进人性化连接'
        },
        tags: ['社交情商']
      },
      {
        id: 35,
        type: 'scale-question',
        textEn: 'How important would you find mentorship matching that connects new mothers with more experienced mothers within the same company or industry?',
        textZh: '您认为一个将新晋母亲与同一公司或行业内有更多育儿经验的母亲相匹配的功能有多大用处？',
        scaleLabels: {
          minEn: 'Not important',
          minZh: '毫无价值 - 完全不需要',
          maxEn: 'Extremely important',
          maxZh: '极具价值 - 促进人性化连接'
        },
        tags: ['社交情商']
      },
      {
        id: 36,
        type: 'scale-question',
        textEn: 'How would you evaluate a company-specific AI model offering work-related productivity features for working mothers?',
        textZh: '您如何看待一个专门为每家公司定制的职场母亲专用人工智能模型？',
        scaleLabels: {
          minEn: 'Not valuable',
          minZh: '毫无必要 - 完全不需要',
          maxEn: 'Extremely helpful',
          maxZh: '极具价值 - 提升效率'
        },
        tags: ['奉献精神']
      },
      {
        id: 37,
        type: 'scale-question',
        textEn: 'How do you see the role of AI technology evolving to support working parents in the next 5-10 years?',
        textZh: '您如何看待未来5-10年内，人工智能在职场父母方面的角色？',
        scaleLabels: {
          minEn: 'AI brings new challenges ahead',
          minZh: '带来全新挑战',
          maxEn: 'AI revolutionizes support for parents',
          maxZh: '革新对父母的支持'
        },
        tags: ['客观能力']
      },
      {
        id: 38,
        type: 'scale-question',
        textEn: 'In your mind, how could an app that incorporates motherhood also serve as a tool for improving client relationships, customer satisfaction, or deal development?',
        textZh: '在您看来，一款引进母亲这一身份的应用程序如何同时成为改善客户关系、提高客户满意度或促进交易发展的工具？',
        scaleLabels: {
          minEn: 'Not beneficial',
          minZh: '毫无价值 - 母爱毫无用处',
          maxEn: 'Extremely beneficial',
          maxZh: '极具价值 - 母爱增进连接'
        },
        tags: ['情绪管理']
      },
      {
        id: 39,
        type: 'scale-question',
        textEn: 'How do you feel about requiring users to submit a confidential child health-related record to verify that they are active caregivers while using this app?',
        textZh: '您如何看待要求用户在使用本应用程序的某些功能之前提交与儿童健康相关的保密记录，以证实她们是儿童的母亲？',
        scaleLabels: {
          minEn: 'Strongly oppose -- utterly invasive',
          minZh: '强烈反对 - 违反隐私',
          maxEn: 'Strongly support -- ensures safety and trust',
          maxZh: '强烈支持 - 保障安全的基础'
        },
        tags: ['客观能力']
      },
      {
        id: 40,
        type: 'scale-question',
        textEn: 'Do you believe misuse by unintended users (including partners of pregnant women and mothers accessing accounts without permission) could negatively affect trust in the app?',
        textZh: '您认为如果有非目标用户滥用该平台（包括孕妇以及母亲的生活伴侣未经允许访问账户等情况），是否会对本应用的信任度产生负面影响？',
        scaleLabels: {
          minEn: 'Definitely no -- no trust risk',
          minZh: '绝对不 - 完全无风险',
          maxEn: 'Definitely yes -- severely undermines trust',
          maxZh: '绝对会 - 严重破坏信任'
        }
      },
      {
        id: 41,
        type: 'scale-question',
        textEn: 'How do you feel about companies verifying through HR that business updates and activities posted on this platform are genuinely from the intended mother users and not others misusing their accounts?',
        textZh: '您如何看待由公司人力资源部门核查平台上的业务更新和动态确实由目标用户本人发布，而非他人滥用账户？',
        scaleLabels: {
          minEn: 'Strongly oppose',
          minZh: '强烈反对',
          maxEn: 'Strongly support',
          maxZh: '强烈支持'
        },
        tags: ['自我意识']
      },
      {
        id: 42,
        type: 'scale-question',
        textEn: 'How important are empathy, compassion, and selflessness associated with motherhood in leadership and life?',
        textZh: '您认为母亲体现出的同理心、关爱与无私，对成功的领导力和人生有多重要？',
        scaleLabels: {
          minEn: 'Not important at all',
          minZh: '完全不重要',
          maxEn: 'Extremely important',
          maxZh: '极其重要'
        },
        tags: ['社交情商']
      },
      {
        id: 43,
        type: 'scale-question',
        textEn: 'How important are resilience and perseverance associated with motherhood in leadership and life?',
        textZh: '您认为母亲展现出的韧性和毅力对成功的领导力和人生有多重要？',
        scaleLabels: {
          minEn: 'Not important at all',
          minZh: '完全不重要',
          maxEn: 'Extremely important',
          maxZh: '极其重要'
        },
        tags: ['核心耐力']
      },
      {
        id: 44,
        type: 'scale-question',
        textEn: 'How valuable are communication and listening associated with motherhood in leadership and life?',
        textZh: '您认为母亲身上的沟通与倾听能力对成功的领导力和人生有多重要？',
        scaleLabels: {
          minEn: 'Not valuable at all',
          minZh: '完全不重要',
          maxEn: 'Extremely important',
          maxZh: '极其重要'
        },
        tags: ['社交情商']
      },
      {
        id: 45,
        type: 'scale-question',
        textEn: 'How crucial are responsibility and accountability associated with motherhood in leadership and life?',
        textZh: '您认为母亲身上的责任感和担当对成功的领导力和人生有多重要？',
        scaleLabels: {
          minEn: 'Not important at all',
          minZh: '完全不重要',
          maxEn: 'Extremely important',
          maxZh: '极其重要'
        },
        tags: ['奉献精神']
      },
      {
        id: 46,
        type: 'scale-question',
        textEn: 'Have you personally resolved challenges balancing leadership responsibilities with parenting (or caregiving)?',
        textZh: '您是否曾面临平衡领导责任与育儿（或照护他人）之间的挑战？',
        scaleLabels: {
          minEn: 'Never',
          minZh: '从未',
          maxEn: 'Yes, frequently',
          maxZh: '经常'
        },
        tags: ['客观实力', '核心耐力']
      },
      {
        id: 47,
        type: 'scale-question',
        textEn: 'How much has becoming a parent (or caregiver) influenced your leadership style?',
        textZh: '成为父母（或照护者）对您的领导风格有多大影响？',
        scaleLabels: {
          minEn: 'No influence',
          minZh: '没有影响',
          maxEn: 'Significantly changed it for the better',
          maxZh: '有显著的积极改变'
        },
        tags: ['奉献精神']
      },
      {
        id: 48,
        type: 'scale-question',
        textEn: 'How do you believe motherhood impacts leadership effectiveness in the workplace?',
        textZh: '您认为引进母亲这一身份如何影响职场中的领导效果？',
        scaleLabels: {
          minEn: 'Negatively',
          minZh: '消极影响',
          maxEn: 'Positively',
          maxZh: '积极影响'
        },
        tags: ['奉献精神']
      },
      {
        id: 49,
        type: 'scale-question',
        textEn: 'How well does your organization integrate leadership traits developed through motherhood into its talent and leadership pipeline?',
        textZh: '您认为贵公司是否在人才培养和领导梯队中，重视并融合了母亲所带来的领导力特质？',
        scaleLabels: {
          minEn: 'Poorly',
          minZh: '不太重视 - 从不考虑',
          maxEn: 'Very well',
          maxZh: '非常重视 - 积极整合并推广'
        },
        tags: ['奉献精神']
      },
      {
        id: 50,
        type: 'scale-question',
        textEn: 'How much do you pay attention to the emotional well-being of working mothers around you?',
        textZh: '您在多大程度上关注身边职场母亲的情绪状态？',
        scaleLabels: {
          minEn: 'Not at all -- I don\'t pay attention to this',
          minZh: '完全不关注 - 不曾留意',
          maxEn: 'Very much -- I actively offer support',
          maxZh: '非常关注 - 会主动提供支持'
        },
        tags: ['社交情商']
      },
      {
        id: 51,
        type: 'scale-question',
        textEn: 'How equipped do you feel to recognize when a mother employee might be experiencing emotional difficulties due to life transitions?',
        textZh: '您认为自己在识别职场母亲因生活转变（如生育、育儿压力）而产生情绪困难方面的能力如何？',
        scaleLabels: {
          minEn: 'Not equipped at all -- I never consider this',
          minZh: '完全没有能力 - 从未考虑',
          maxEn: 'Very equipped -- I can identify and address it appropriately',
          maxZh: '非常有能力 - 能妥善应对'
        },
        tags: ['奉献精神']
      },
      {
        id: 52,
        type: 'scale-question',
        textEn: 'How much do you feel that your mother\'s role influenced your early understanding of leadership or responsibility?',
        textZh: '您认为您的母亲在多大程度上影响了童年时期您对领导力、责任感、同理心的认知？',
        scaleLabels: {
          minEn: 'Not at all',
          minZh: '没有影响',
          maxEn: 'Very strongly',
          maxZh: '非常深远'
        },
        tags: ['自我意识']
      }
    ],
    privacyStatement: {
      titleEn: 'Privacy Statement',
      titleZh: '隐私声明',
      contentEn: '<strong style="font-size: 1.2em;">Data Usage and Privacy Statement</strong><br><br>At CHON, your privacy is fundamental. We only collect the information necessary to deliver meaningful insights, and we protect it with the highest standards of security and integrity.<br><br><hr><br><strong style="font-size: 1.2em;">For Individual Participants</strong><br><br>Your personal information will be used solely for the following purposes:<br><ul><li>To verify your eligibility for specific sections of the survey</li><li>To support demographic and statistical analysis across participant groups</li><li>To generate your personalized CHON personality profile</li></ul>',
      contentZh: '<strong style="font-size: 1.2em;">数据使用与隐私声明</strong><br><br>在 CHON，我们将您的隐私视为基本原则。我们仅收集实现分析目的所必需的信息，并以最高标准保障数据的安全与完整性。<br><br><hr><br><strong style="font-size: 1.2em;">针对个人参与者</strong><br><br>您的个人信息将仅用于以下用途：<br><ul><li>验证您是否符合特定问卷部分的参与资格</li><li>用于不同人群的统计与人口特征分析</li><li>生成您的个性化 CHON 性格分析报告</li></ul>'
    },
    uniqueIdMapping: {
      "corporate 1": 1,
      "corporate 2": 2,
      "corporate 3": 3,
      "corporate 4": 5,
      "corporate 5": 6,
      "corporate 6": 7,
      "corporate 7": 8,
      "corporate 8": 9,
      "corporate 9": 10,
      "corporate 10": 11,
      "corporate 11": 12,
      "corporate 12": 13,
      "corporate 13": 14,
      "corporate 14": 15,
      "corporate 15": 16,
      "corporate 16": 17,
      "corporate 17": 18,
      "corporate 18": 19,
      "corporate 19": 20,
      "corporate 20": 21,
      "corporate 21": 22,
      "corporate 22": 23,
      "corporate 23": 24,
      "corporate 24": 25,
      "corporate 25": 26,
      "corporate 26": 27,
      "corporate 27": 28,
      "corporate 28": 29,
      "corporate 29": 30,
      "corporate 30": 31,
      "corporate 31": 32,
      "corporate 32": 33,
      "corporate 33": 34,
      "corporate 34": 35,
      "corporate 35": 36,
      "corporate 36": 37,
      "corporate 37": 38,
      "corporate 38": 39,
      "corporate 39": 40,
      "corporate 40": 41,
      "corporate 41": 42,
      "corporate 42": 43,
      "corporate 43": 44,
      "corporate 44": 45,
      "corporate 45": 46,
      "corporate 46": 47,
      "corporate 47": 48,
      "corporate 48": 49,
      "corporate 49": 50,
      "corporate 50": 51,
      "corporate 51": 52,
      "corporate 52": 53
    }
  },
  other: {
    type: 'other',
    totalQuestions: 41,
    questions: [
      {
        id: 1,
        type: 'multiple-choice',
        textEn: "What's your biological sex?",
        textZh: '您的性别是什么？',
        options: [
          { id: 'A', textEn: 'Female', textZh: '女' },
          { id: 'B', textEn: 'Male', textZh: '男' }
        ]
      },
      {
        id: 2,
        type: 'multiple-choice',
        textEn: 'What is your age range?',
        textZh: '您的年龄是？',
        options: [
          { id: 'A', textEn: 'Under 18', textZh: '18岁以下' },
          { id: 'B', textEn: '18 - 24', textZh: '18 - 24' },
          { id: 'C', textEn: '25 - 34', textZh: '25 - 34' },
          { id: 'D', textEn: '35 - 44', textZh: '35 - 44' },
          { id: 'E', textEn: '45 - 54', textZh: '45 - 54' },
          { id: 'F', textEn: '55 - 64', textZh: '55 - 64' },
          { id: 'G', textEn: '65 or above', textZh: '65岁及以上' }
        ]
      },
      {
        id: 3,
        type: 'multiple-choice',
        textEn: 'Where are you currently based?',
        textZh: '您目前所在的地区是？',
        options: [
          { id: 'A', textEn: 'Asia', textZh: '亚洲' },
          { id: 'B', textEn: 'North America', textZh: '北美' },
          { id: 'C', textEn: 'South America', textZh: '南美' },
          { id: 'D', textEn: 'Europe', textZh: '欧洲' },
          { id: 'E', textEn: 'Africa', textZh: '非洲' },
          { id: 'F', textEn: 'Australia/Oceania', textZh: '澳大利亚/大洋洲' },
        ]
      },
      {
        id: 4,
        type: 'multiple-choice',
        textEn: 'Have you worked in a for-profit corporate setting, currently or in the past?',
        textZh: '您目前或过去是否曾在营利性企业环境中工作过？',
        options: [
          { id: 'A', textEn: 'Yes', textZh: '是' },
          { id: 'B', textEn: 'No', textZh: '否' }
        ]
      },
      {
        id: 5,
        type: 'scale-question',
        textEn: 'How supportive is your current company or team in fostering both professional growth and overall well-being?',
        textZh: '您认为您所在的组织或团队在支持职业发展和身心健康双方面表现如何？',
        scaleLabels: {
          minEn: 'Not supportive at all',
          minZh: '完全不重视',
          maxEn: 'Very supportive',
          maxZh: '非常重视'
        },
        tags: ['自我意识']
      },
      {
        id: 6,
        type: 'scale-question',
        textEn: 'How much opportunity do you have to build meaningful professional relationships within your organization?',
        textZh: '您在组织或团队内建立有意义的合作关系的机会有多少？',
        scaleLabels: {
          minEn: 'None -- mostly isolated interactions',
          minZh: '没有 -- 多为孤立互动',
          maxEn: 'A lot -- strong connections',
          maxZh: '很多 -- 多为良好关系'
        },
        tags: ['社交能力', '情商']
      },
      {
        id: 7,
        type: 'scale-question',
        textEn: 'How important do you find emotional intelligence and soft skills (e.g., empathy, patience, communication, active listening) in your day-to-day collaboration with colleagues?',
        textZh: '您觉得在日常协作中，情绪智慧和软实力（如同理心、耐心、倾听）有多重要？',
        scaleLabels: {
          minEn: 'Not important at all',
          minZh: '完全不重要',
          maxEn: 'Extremely important',
          maxZh: '极为重要'
        },
        tags: ['社交情商', '奉献精神']
      },
      {
        id: 8,
        type: 'scale-question',
        textEn: 'How frequently do you experience acts of kindness or supportive behavior in your team or company culture?',
        textZh: '您在团队中感受到来自同事的善意或支持行为有多频繁？',
        scaleLabels: {
          minEn: 'Never',
          minZh: '从未',
          maxEn: 'Very frequently',
          maxZh: '非常频繁'
        },
        tags: ['奉献精神']
      },
      {
        id: 9,
        type: 'scale-question',
        textEn: 'How would you describe your role of providing support or care to colleagues during team interactions or projects?',
        textZh: '在团队合作或项目推进中，您通常会在多大程度上给予同事支持或关心？',
        scaleLabels: {
          minEn: 'Do not engage in offering support',
          minZh: '基本不提供支持',
          maxEn: 'Frequently offer support',
          maxZh: '经常主动给予支持'
        },
        tags: ['奉献精神']
      },
      {
        id: 10,
        type: 'scale-question',
        textEn: 'How much do you feel your contributions and perspectives are recognized and valued by your team?',
        textZh: '您觉得自己在团队中的意见和贡献被认可的程度如何？',
        scaleLabels: {
          minEn: 'Never',
          minZh: '几乎从未被采纳',
          maxEn: 'Always',
          maxZh: '总是被重视并采纳'
        },
        tags: ['自我意识']
      },
      {
        id: 11,
        type: 'scale-question',
        textEn: 'To what extent does your organization promote a culture of collaboration built on trust and mutual respect?',
        textZh: '您认为团队在营造基于信任与相互尊重的合作氛围方面做得如何？',
        scaleLabels: {
          minEn: 'Does not at all',
          minZh: '几乎没有相关文化',
          maxEn: 'Strongly across all levels',
          maxZh: '做得非常好，深入人心'
        },
        tags: ['客观能力', '奉献精神']
      },
      {
        id: 12,
        type: 'scale-question',
        textEn: 'How comfortable are you with reaching out to colleagues or managers when facing challenges or seeking help?',
        textZh: '面对困难或需要帮助时，您与同事或上级沟通的舒适度如何？',
        scaleLabels: {
          minEn: 'Very uncomfortable',
          minZh: '很不愿意',
          maxEn: 'Very comfortable',
          maxZh: '非常自然'
        },
        tags: ['社交情商', '情绪调节']
      },
      {
        id: 13,
        type: 'scale-question',
        textEn: 'How important do you think a people-centered work culture is for maintaining both productivity and team morale?',
        textZh: '您觉得以人为本的企业文化对保持工作效率和团队凝聚力的重要性如何？',
        scaleLabels: {
          minEn: 'Not important at all',
          minZh: '几乎不重要',
          maxEn: 'Extremely important',
          maxZh: '非常重要'
        },
        tags: ['社交情商']
      },
      {
        id: 14,
        type: 'scale-question',
        textEn: 'How often do you feel that a sense of belonging or team care positively impacts your motivation and job satisfaction?',
        textZh: '您怎么描述您因团队归属感或同事关怀提升工作积极性和满意度的频率？',
        scaleLabels: {
          minEn: 'Never',
          minZh: '从未，无影响',
          maxEn: 'Very often',
          maxZh: '经常，重要动力'
        },
        tags: ['情绪调节']
      },
      {
        id: 15,
        type: 'scale-question',
        textEn: 'What role does technology play in helping your team stay efficient and connected?',
        textZh: '您认为技术工具（如协作平台、生产力应用）在提升团队效率与保持联系方面的作用如何？',
        scaleLabels: {
          minEn: 'No role',
          minZh: '基本无作用',
          maxEn: 'A critical role',
          maxZh: '至关重要'
        },
        tags: ['客观能力']
      },
      {
        id: 16,
        type: 'scale-question',
        textEn: 'How well do you think enhanced abstract logical thinking would address emotional and life concerns?',
        textZh: '您认为加强抽象逻辑思维对解决情感和生活问题有多大帮助？',
        scaleLabels: {
          minEn: 'Not well - no link with emotions',
          minZh: '完全不行 - 毫无关系',
          maxEn: 'Extremely well - very effective',
          maxZh: '非常好 - 极其有效'
        },
        tags: ['客观能力', '情绪调节']
      },
      {
        id: 17,
        type: 'scale-question',
        textEn: 'Do you believe that self-love and the ability to care for others require strong logic to navigate challenges in life?',
        textZh: '你认为真正的自爱和关爱他人的能力在多大程度上需要强大的客观思维来解决生活中的挑战？',
        scaleLabels: {
          minEn: 'Strongly disagree',
          minZh: '非常不同意',
          maxEn: 'Strongly agree',
          maxZh: '非常同意'
        },
        tags: ['客观能力']
      },
      {
        id: 18,
        type: 'scale-question',
        textEn: 'How valuable would you find a feature that helps working mothers in your team stay updated with trends and knowledge in their professional field?',
        textZh: '您认为一个帮助职场母亲了解其行业领域最新动态的功能有多大用处？',
        scaleLabels: {
          minEn: 'Not valuable',
          minZh: '毫无价值 - 毫无益处',
          maxEn: 'Extremely valuable',
          maxZh: '极具价值 - 职业发展必备'
        },
        tags: ['奉献精神']
      },
      {
        id: 19,
        type: 'scale-question',
        textEn: 'How valuable would a business opportunity board be, where working mothers on your team could post or access new projects and deals?',
        textZh: '您认为一个帮助职场母亲发布和获取商业交易和商业合作的功能有多大用处？',
        scaleLabels: {
          minEn: 'Not valuable',
          minZh: '毫无价值 - 完全不需要',
          maxEn: 'Highly valuable',
          maxZh: '极具价值 - 大幅提升发展'
        }
      },
      {
        id: 20,
        type: 'scale-question',
        textEn: 'How do you perceive the value of a forum where mothers can share maternal experiences and emotional support?',
        textZh: '您认为一个帮助职场母亲分享育儿经验、获得情感支持的论坛有多大用处？',
        scaleLabels: {
          minEn: 'Not valuable',
          minZh: '毫无价值 - 完全不需要',
          maxEn: 'Extremely beneficial',
          maxZh: '极其有益 - 非常重要的连接'
        },
        tags: ['奉献精神']
      },
      {
        id: 21,
        type: 'scale-question',
        textEn: 'How valuable would direct access to external medical resouces for healthcare advice be within such an app?',
        textZh: '您认为提供联系外部医疗专业人士获得医学建议的功能有多大用处？',
        scaleLabels: {
          minEn: 'Not valuable',
          minZh: '毫无价值 - 完全不需要',
          maxEn: 'Extremely valuable',
          maxZh: '极具价值 - 健康必备'
        },
        tags: ['奉献精神']
      },
      {
        id: 22,
        type: 'scale-question',
        textEn: 'How beneficial would visuospatial and abstract logical training modules be for enhancing cognitive development?',
        textZh: '您认为视觉空间与数学逻辑训练模块对抽象逻辑发展有多大用处？',
        scaleLabels: {
          minEn: 'Not beneficial',
          minZh: '毫无价值 - 完全不需要',
          maxEn: 'Extremely beneficial',
          maxZh: '极具价值 - 提升效率'
        },
        tags: ['客观能力']
      },
      {
        id: 23,
        type: 'scale-question',
        textEn: 'How engaging do you think personalized profiles with interactive "electronic kids" avatars would be for promoting social interaction among working mothers?',
        textZh: '您认为通过个人主页中使用"电子小孩"互动来促进职场母亲之间社交互动的功能有多大用处？',
        scaleLabels: {
          minEn: 'Not engaging',
          minZh: '毫无价值 - 完全不需要',
          maxEn: 'Very engaging',
          maxZh: '极具价值 - 促进人性化连接'
        },
        tags: ['社交情商']
      },
      {
        id: 24,
        type: 'scale-question',
        textEn: 'How important would you find mentorship matching that connects new mothers with more experienced mothers within the same company or industry?',
        textZh: '您认为一个将新晋母亲与同一公司或行业内有更多育儿经验的母亲相匹配的功能有多大用处？',
        scaleLabels: {
          minEn: 'Not important',
          minZh: '毫无价值 - 完全不需要',
          maxEn: 'Extremely important',
          maxZh: '极具价值 - 促进人性化连接'
        },
        tags: ['社交情商']
      },
      {
        id: 25,
        type: 'scale-question',
        textEn: 'How would you evaluate a company-specific AI model offering work-related productivity features for working mothers?',
        textZh: '您如何看待一个专门为每家公司定制的职场母亲专用人工智能模型？',
        scaleLabels: {
          minEn: 'Not valuable',
          minZh: '毫无必要 - 完全不需要',
          maxEn: 'Extremely helpful',
          maxZh: '极具价值 - 提升效率'
        },
        tags: ['奉献精神']
      },
      {
        id: 26,
        type: 'scale-question',
        textEn: 'How do you see the role of AI technology evolving to support working parents in the next 5-10 years?',
        textZh: '您如何看待未来5-10年内，人工智能在职场父母方面的角色？',
        scaleLabels: {
          minEn: 'AI brings new challenges ahead',
          minZh: '带来全新挑战',
          maxEn: 'AI revolutionizes support for parents',
          maxZh: '革新对父母的支持'
        },
        tags: ['客观能力']
      },
      {
        id: 27,
        type: 'scale-question',
        textEn: 'In your mind, how could an app that incorporates motherhood also serve as a tool for improving client relationships, customer satisfaction, or deal development?',
        textZh: '在您看来，一款引进母亲这一身份的应用程序如何同时成为改善客户关系、提高客户满意度或促进交易发展的工具？',
        scaleLabels: {
          minEn: 'Not beneficial',
          minZh: '毫无价值 - 母爱毫无用处',
          maxEn: 'Extremely beneficial',
          maxZh: '极具价值 - 母爱增进连接'
        },
        tags: ['情绪管理']
      },
      {
        id: 28,
        type: 'scale-question',
        textEn: 'How do you feel about requiring users to submit a confidential child health-related record to verify that they are active caregivers before using this app?',
        textZh: '您如何看待要求用户在使用本应用程序的某些功能之前提交与儿童健康相关的保密记录，以证实她们是儿童的母亲？',
        scaleLabels: {
          minEn: 'Strongly oppose -- utterly invasive',
          minZh: '强烈反对 - 违反隐私',
          maxEn: 'Strongly support -- ensures safety and trust',
          maxZh: '强烈支持 - 保障安全的基础'
        },
        tags: ['客观能力']
      },
      {
        id: 29,
        type: 'scale-question',
        textEn: 'Do you believe misuse by unintended users (including partners of pregnant women and mothers accessing accounts without permission) could negatively affect trust in the app?',
        textZh: '您认为如果有非目标用户滥用该平台（包括孕妇以及母亲的生活伴侣未经允许访问账户等情况），是否会对本应用的信任度产生负面影响？',
        scaleLabels: {
          minEn: 'Definitely no -- no trust risk',
          minZh: '绝对不 - 完全无风险',
          maxEn: 'Definitely yes -- severely undermines trust',
          maxZh: '绝对会 - 严重破坏信任'
        }
      },
      {
        id: 30,
        type: 'scale-question',
        textEn: 'How do you feel about companies verifying through HR that business updates and activities posted on this platform are genuinely from the intended mother users and not others misusing their accounts?',
        textZh: '您如何看待由公司人力资源部门核查平台上的业务更新和动态确实由目标用户本人发布，而非他人滥用账户？',
        scaleLabels: {
          minEn: 'Strongly oppose',
          minZh: '强烈反对',
          maxEn: 'Strongly support',
          maxZh: '强烈支持'
        },
        tags: ['自我意识']
      },
      {
        id: 31,
        type: 'scale-question',
        textEn: 'How important are empathy, compassion, and selflessness associated with motherhood in work and life?',
        textZh: '您认为母亲常体现出的同理心、关爱与无私，对成功的工作和人生有多重要？',
        scaleLabels: {
          minEn: 'Not important at all',
          minZh: '完全不重要',
          maxEn: 'Extremely important',
          maxZh: '极其重要'
        },
        tags: ['社交情商']
      },
      {
        id: 32,
        type: 'scale-question',
        textEn: 'How important are resilience and perseverance associated with motherhood in work and life?',
        textZh: '您认为母亲展现出的韧性和毅力对成功的工作和人生有多重要？',
        scaleLabels: {
          minEn: 'Not important at all',
          minZh: '完全不重要',
          maxEn: 'Extremely important',
          maxZh: '极其重要'
        },
        tags: ['核心耐力']
      },
      {
        id: 33,
        type: 'scale-question',
        textEn: 'How valuable are communication and listening associated with motherhood in work and life?',
        textZh: '您认为母亲身上的沟通与倾听能力对成功的工作和人生有多重要？',
        scaleLabels: {
          minEn: 'Not valuable at all',
          minZh: '完全不重要',
          maxEn: 'Extremely valuable',
          maxZh: '极其重要'
        },
        tags: ['社交情商']
      },
      {
        id: 34,
        type: 'scale-question',
        textEn: 'How crucial are responsibility and accountability associated with motherhood in work and life?',
        textZh: '您认为母亲身上的责任感和担当对成功的工作和人生有多重要？',
        scaleLabels: {
          minEn: 'Not important at all',
          minZh: '完全不重要',
          maxEn: 'Extremely crucial',
          maxZh: '极其重要'
        },
        tags: ['奉献精神']
      },
      {
        id: 35,
        type: 'scale-question',
        textEn: 'Have you personally resolved challenges balancing leadership responsibilities with caregiving?',
        textZh: '您是否曾面临平衡领导责任与照护他人之间的挑战？',
        scaleLabels: {
          minEn: 'Never',
          minZh: '从未',
          maxEn: 'Yes, frequently',
          maxZh: '是的，经常'
        },
        tags: ['客观实力', '核心耐力']
      },
      {
        id: 36,
        type: 'scale-question',
        textEn: 'How much has becoming a caregiver of any kind influenced your work style?',
        textZh: '成为照护他人的人对您的工作处事风格有多大影响？',
        scaleLabels: {
          minEn: 'Negative impact',
          minZh: '消极影响',
          maxEn: 'Significantly improved',
          maxZh: '积极改变'
        },
        tags: ['奉献精神']
      },
      {
        id: 37,
        type: 'scale-question',
        textEn: 'How do you believe motherhood impacts leadership effectiveness in the workplace?',
        textZh: '您认为母亲身份如何影响职场中的领导效果？',
        scaleLabels: {
          minEn: 'Negatively',
          minZh: '消极影响',
          maxEn: 'Positively',
          maxZh: '积极影响'
        },
        tags: ['奉献精神']
      },
      {
        id: 38,
        type: 'scale-question',
        textEn: 'How well does your organization integrate leadership traits developed through motherhood into its talent and leadership pipeline?',
        textZh: '您认为您所在的公司是否在人才培养和领导梯队中，重视并融合了母亲所带来的领导力特质？',
        scaleLabels: {
          minEn: 'Poorly -- rarely or never considers them',
          minZh: '不太重视 ------ 很少或从不考虑',
          maxEn: 'Very well -- actively integrates and promotes',
          maxZh: '非常重视 ------ 积极整合并推广'
        },
        tags: ['奉献精神']
      },
      {
        id: 39,
        type: 'scale-question',
        textEn: 'How much do you pay attention to the emotional well-being of working mothers around you?',
        textZh: '您在多大程度上关注身边职场母亲的情绪状态，特别是受到激素变化或产后抑郁等潜在挑战的影响时？',
        scaleLabels: {
          minEn: 'Not at all -- I don\'t pay attention to this',
          minZh: '完全不关注 -- 不曾留意',
          maxEn: 'Very much -- I actively offer support',
          maxZh: '非常关注 -- 会主动提供支持'
        },
        tags: ['社交情商']
      },
      {
        id: 40,
        type: 'scale-question',
        textEn: 'How equipped do you feel to recognize when a mother colleague might be experiencing emotional difficulties due to life transitions?',
        textZh: '您认为自己在识别职场母亲因生活转变（如生育、育儿压力）而产生情绪困难方面的能力如何？',
        scaleLabels: {
          minEn: 'Not equipped at all -- I never consider this',
          minZh: '完全没有能力 -- 从未考虑',
          maxEn: 'Very equipped -- I can identify and address it appropriately',
          maxZh: '非常有能力 -- 能妥善应对'
        },
        tags: ['奉献精神']
      },
      {
        id: 41,
        type: 'scale-question',
        textEn: 'How much do you feel that your mother\'s role influenced your early understanding of leadership or responsibility?',
        textZh: '您认为您的母亲在多大程度上影响了童年时期您对领导力、责任感、同理心的认知？',
        scaleLabels: {
          minEn: 'Not at all',
          minZh: '没有影响',
          maxEn: 'Very strongly',
          maxZh: '非常深远'
        },
        tags: ['自我意识']
      }
    ],
    privacyStatement: {
      titleEn: 'Privacy Statement',
      titleZh: '隐私声明',
      contentEn: '<strong style="font-size: 1.2em;">Data Usage and Privacy Statement</strong><br><br>At CHON, your privacy is fundamental. We only collect the information necessary to deliver meaningful insights, and we protect it with the highest standards of security and integrity.<br><br><hr><br><strong style="font-size: 1.2em;">For Individual Participants</strong><br><br>Your personal information will be used solely for the following purposes:<br><ul><li>To verify your eligibility for specific sections of the survey</li><li>To support demographic and statistical analysis across participant groups</li><li>To generate your personalized CHON personality profile</li></ul>',
      contentZh: '<strong style="font-size: 1.2em;">数据使用与隐私声明</strong><br><br>在 CHON，我们将您的隐私视为基本原则。我们仅收集实现分析目的所必需的信息，并以最高标准保障数据的安全与完整性。<br><br><hr><br><strong style="font-size: 1.2em;">针对个人参与者</strong><br><br>您的个人信息将仅用于以下用途：<br><ul><li>验证您是否符合特定问卷部分的参与资格</li><li>用于不同人群的统计与人口特征分析</li><li>生成您的个性化 CHON 性格分析报告</li></ul>'
    },
    uniqueIdMapping: {
      "other 1": 1,
      "other 2": 2,
      "other 3": 3,
      "other 4": 4,
      "other 5": 83,
      "other 6": 84,
      "other 7": 22,
      "other 8": 85,
      "other 9": 86,
      "other 10": 87,
      "other 11": 88,
      "other 12": 89,
      "other 13": 90,
      "other 14": 91,
      "other 15": 26,
      "other 16": 28,
      "other 17": 29,
      "other 18": 30,
      "other 19": 31,
      "other 20": 32,
      "other 21": 33,
      "other 22": 34,
      "other 23": 35,
      "other 24": 36,
      "other 25": 37,
      "other 26": 38,
      "other 27": 39,
      "other 28": 40,
      "other 29": 41,
      "other 30": 42,
      "other 31": 43,
      "other 32": 44,
      "other 33": 45,
      "other 34": 46,
      "other 35": 47,
      "other 36": 48,
      "other 37": 49,
      "other 38": 50,
      "other 39": 51,
      "other 40": 52,
      "other 41": 53
    }
  },
  both: {
      type: 'both',
      totalQuestions: 66,
      questions: [
        // Page 1 - Corporate background
        {
          id: 1,
          type: 'multiple-choice',
          textEn: 'What is your current / most recent job position?',
          textZh: '您目前的职位名称是什么？',
          options: [
            { id: 'A', textEn: 'Senior Manager', textZh: '高级经理' },
            { id: 'B', textEn: 'Director', textZh: '总监' },
            { id: 'C', textEn: 'Vice President', textZh: '副总裁' },
            { id: 'D', textEn: 'Managing Director', textZh: '董事总经理' },
            { id: 'E', textEn: 'Partner', textZh: '合伙人' },
            { id: 'F', textEn: 'President', textZh: '总裁' },
            { id: 'G', textEn: 'C-suite Executives (CEO, CFO, COO, etc)', textZh: 'C级高管 (CEO, CFO, COO等)' },
            { id: 'H', textEn: 'Board of Directors', textZh: '董事会成员' }
          ]
        },
        {
          id: 2,
          type: 'text-input',
          textEn: 'What is your professional contact (e.g., email, LinkedIn)?',
          textZh: '请问您的职业联系方式是什么（例如：邮箱、领英）？',
        },
        {
          id: 3,
          type: 'multiple-choice',
          textEn: 'Which industry or business sector does your company operate in?',
          textZh: '贵公司属于哪个行业或业务领域？',
          options: [
            { id: 'A', textEn: 'Consumer Goods & Retail', textZh: '消费品和零售' },
            { id: 'B', textEn: 'Education & Business Professional Services', textZh: '教育和商业专业服务' },
            { id: 'C', textEn: 'Energy & Utilities', textZh: '能源和公用事业' },
            { id: 'D', textEn: 'Entertainment & Media', textZh: '娱乐和媒体' },
            { id: 'E', textEn: 'Financial Services', textZh: '金融服务' },
            { id: 'F', textEn: 'Government, Nonprofits & Public Services', textZh: '政府、非营利和公共服务' },
            { id: 'G', textEn: 'Healthcare & Pharmaceuticals', textZh: '医疗保健和制药' },
            { id: 'H', textEn: 'Industrial Production & Manufacturing', textZh: '工业生产和制造' },
            { id: 'I', textEn: 'Real Estate & Construction', textZh: '房地产和建筑' },
            { id: 'J', textEn: 'Technology & Telecommunications', textZh: '技术和电信' },
            { id: 'K', textEn: 'Transportation & Logistics', textZh: '运输和物流' }
          ]
        },
        {
          id: 4,
          type: 'multiple-choice',
          textEn: 'How many years of experience do you have in a managerial or leadership role?',
          textZh: '您在管理或领导岗位上有多少年的工作经验？',
          options: [
            { id: 'A', textEn: '1-3 years', textZh: '1-3年' },
            { id: 'B', textEn: '4-6 years', textZh: '4-6年' },
            { id: 'C', textEn: '7-9 years', textZh: '7-9年' },
            { id: 'D', textEn: '10+ years', textZh: '10年以上' }
          ]
        },
        {
          id: 5,
          type: 'text-input',
          textEn: 'What is the approximate size of your direct span of control?',
          textZh: '您的直接管理团队规模是多少？',
        },
        {
          id: 6,
          type: 'text-input',
          textEn: 'What is the approximate size of your indirect span of control?',
          textZh: '您间接管理多少人？',
        },
        {
          id: 7,
          type: 'text-input',
          textEn: 'How would you describe the overall reporting structure look like within your team in ten words?',
          textZh: '请在十字以内描述您团队中的整体报告结构',
        },
        // Page 2 - Mother background
        {
          id: 8,
          type: 'multiple-choice',
          textEn: 'How many children do you have or are expecting to have?',
          textZh: '您有或预计有多少个孩子？',
          options: [
            { id: 'A', textEn: '1', textZh: '1 个' },
            { id: 'B', textEn: '2', textZh: '2 个' },
            { id: 'C', textEn: '3', textZh: '3 个' },
            { id: 'D', textEn: '4 or more', textZh: '4 个或更多' },
          ]
        },
        {
          id: 9,
          type: 'text-input',
          textEn: 'Which hospital did you use for prenatal care services?',
          textZh: '您在哪家医院进行了产检服务？',
        },
        {
          id: 10,
          type: 'multiple-choice',
          textEn: 'How many trimesters did you experience noticeable morning sickness?',
          textZh: '您经历了几个妊娠期有明显的孕吐反应？',
          options: [
            { id: 'A', textEn: 'None', textZh: '无' },
            { id: 'B', textEn: '1 trimester', textZh: '1个妊娠期' },
            { id: 'C', textEn: '2 trimesters', textZh: '2个妊娠期' },
            { id: 'D', textEn: 'Entire pregnancy', textZh: '整个孕期' },
          ]
        },
        {
          id: 11,
          type: 'text-input',
          textEn: 'What was your youngest child\'s birth weight?',
          textZh: '您第一胎宝宝的出生体重是多少？',
        },
        {
          id: 12,
          type: 'multiple-choice',
          textEn: 'How long was your maternity leave?',
          textZh: '您的产假有多长时间？',
          options: [
            { id: 'A', textEn: '<8 weeks', textZh: '少于8周' },
            { id: 'B', textEn: '8-14 weeks', textZh: '8-14周' },
            { id: 'C', textEn: '15-26 weeks', textZh: '15-26周' },
            { id: 'D', textEn: '27-52 weeks', textZh: '27-52周' },
            { id: 'E', textEn: '>1 year', textZh: '超过1年' }
          ]
        },
        {
          id: 13,
          type: 'multiple-choice',
          textEn: 'Did you receive postpartum care services?',
          textZh: '您是否接受了产后护理或入住了月子中心？',
          options: [
            { id: 'A', textEn: 'Yes', textZh: '是' },
            { id: 'B', textEn: 'No', textZh: '否' },
          ]
        },
        {
          id: 14,
          type: 'text-input',
          textEn: 'Describe your postpartum emotions in one word',
          textZh: '用十个词形容您的产后状态',
        },
        {
          id: 15,
          type: 'text-input',
          textEn: 'Describe your motherhood experience in ten words',
          textZh: '用十个词形容您作为母亲的状态吗？',
        },
        // Page 3 - Leadership
        {
          id: 16,
          type: 'scale-question',
          textEn: 'How would you describe the decision-making structure in your organization?',
          textZh: '您如何描述贵公司决策体系的运作方式？',
          scaleLabels: {
            minEn: 'Highly centralized',
            minZh: '高度集中化',
            maxEn: 'Flexibly adaptive',
            maxZh: '灵活变通'
          }
        },
        {
          id: 17,
          type: 'scale-question',
          textEn: 'In your opinion, what should be the primary basis of decision-making authority in your organization?',
          textZh: '在您看来，贵司的决策权应该主要基于什么？',
          scaleLabels: {
            minEn: 'Rigid policies & Top-down command',
            minZh: '严格的政策和自上而下的指挥',
            maxEn: 'Entirely based on individual\'s ability',
            maxZh: '完全基于个人能力'
          },
          tags: ['客观能力']
        },
        {
          id: 18,
          type: 'scale-question',
          textEn: 'How well-organized would you say your team structure is under your leadership?',
          textZh: '您认为在您的领导下，您的团队结构有多有序和高效？',
          scaleLabels: {
            minEn: 'Not organized',
            minZh: '缺乏组织性',
            maxEn: 'Very well-organized',
            maxZh: '组织性非常强'
          },
          tags: ['客观能力', '核心耐力']
        },
        {
          id: 19,
          type: 'scale-question',
          textEn: 'How would you rate your team\'s level of communication and collaboration under your leadership?',
          textZh: '您认为在您的领导下，您的团队的沟通与协作水平如何？',
          scaleLabels: {
            minEn: 'Very poor – Lack communication & efficiency',
            minZh: '非常差 —— 缺乏沟通和效率',
            maxEn: 'Excellent – Great communication & efficiency',
            maxZh: '非常好 —— 极好的沟通和效率'
          },
          tags: ['客观能力', '社交情商']
        },
        {
          id: 20,
          type: 'scale-question',
          textEn: 'How would you rate your experience in communicating and establishing trust with clients or business partners?',
          textZh: '您如何评价自己在与客户或业务伙伴沟通及建立信任方面的经验？',
          scaleLabels: {
            minEn: 'Very poor – significant challenges',
            minZh: '非常差 – 极大挑战',
            maxEn: 'Excellent – effective and trusted',
            maxZh: '非常好 – 有效、可信'
          },
          tags: ['社交情商']
        },
        {
          id: 21,
          type: 'scale-question',
          textEn: 'How effective do you believe your organization is at understanding client or market needs?',
          textZh: '您认为贵司在理解客户或市场需求方面的效果如何？',
          scaleLabels: {
            minEn: 'Very poor – insufficient understanding',
            minZh: '非常差 – 不充分了解',
            maxEn: 'Excellent – exceeds expectations',
            maxZh: '非常好 – 超出预期'
          },
          tags: ['社交情商']
        },
        {
          id: 22,
          type: 'scale-question',
          textEn: 'How important do you think responsibility is in building successful business projects?',
          textZh: '您认为责任感对商业项目的成功有多重要？',
          scaleLabels: {
            minEn: 'Not important at all',
            minZh: '完全不重要',
            maxEn: 'Extremely important',
            maxZh: '极其重要'
          },
          tags: ['客观能力', '奉献精神']
        },
        {
          id: 23,
          type: 'scale-question',
          textEn: 'How important do you think empathy and communication are in building successful business relationships?',
          textZh: '您认为同理心和沟通能力在建立成功的商业关系中有多重要？',
          scaleLabels: {
            minEn: 'Not important at all',
            minZh: '完全不重要',
            maxEn: 'Extremely important',
            maxZh: '极其重要'
          },
          tags: ['奉献精神', '社交情商']
        },
        {
          id: 24,
          type: 'scale-question',
          textEn: 'How would you describe the current recognition and utilization of the "soft skills" of kindness, responsibility, empathy, and communication in your company?',
          textZh: '您如何描述贵司目前对"软实力"（善良、责任心、同理心、沟通能力）的认可和使用情况？',
          scaleLabels: {
            minEn: 'Not recognized at all',
            minZh: '完全不认可',
            maxEn: 'Highly recognized and utilized',
            maxZh: '高度认可和利用'
          },
          tags: ['奉献精神']
        },
        {
          id: 25,
          type: 'scale-question',
          textEn: 'Do you think men and women are equally supported in your industry when it comes to balancing work and family?',
          textZh: '在您的行业中, 您认为男性和女性是否在平衡工作与家庭方面得到了同等支持？',
          scaleLabels: {
            minEn: 'No, one is significantly less supported',
            minZh: '不是，其一得到的很少同等支持',
            maxEn: 'Yes, equally supported',
            maxZh: '是的，两种性别都得到了平等支持'
          },
          tags: ['自我意识']
        },
        {
          id: 26,
          type: 'scale-question',
          textEn: 'In your opinion, how important is it for your organization to provide resources in the form of support and social bonding for working mothers?',
          textZh: '在您看来，公司为职场母亲提供情感支持和社交的资源有多重要？',
          scaleLabels: {
            minEn: 'Not important at all',
            minZh: '完全不重要',
            maxEn: 'Very important',
            maxZh: '非常重要'
          },
          tags: ['奉献精神', '自我意识']
        },
        {
          id: 27,
          type: 'scale-question',
          textEn: 'How would you describe your organization\'s current approach to supporting working mothers under your leadership?',
          textZh: '您如何描述贵司在您的领导下目前对职场母亲的支持程度？',
          scaleLabels: {
            minEn: 'Not supportive at all',
            minZh: '完全不支持',
            maxEn: 'Highly supportive with clear policies and resources',
            maxZh: '高度支持，有明确的政策和资源'
          },
          tags: ['奉献精神', '自我意识']
        },
        {
          id: 28,
          type: 'scale-question',
          textEn: 'How effectively do you use technology to support collaboration and productivity within your team?',
          textZh: '您在团队协作和生产力提升方面对科技的使用程度如何？',
          scaleLabels: {
            minEn: 'Not at all',
            minZh: '完全不使用',
            maxEn: 'Very effectively',
            maxZh: '非常有效地使用'
          },
          tags: ['客观能力']
        },
        {
          id: 29,
          type: 'multiple-choice',
          textEn: 'If you were the god or goddess of the business world and could change or create one thing from the following, what would it be?',
          textZh: '如果您是商业世界的创造神，并且可以创造或改变以下任何一件事，您会选择什么？',
          options: [
            { id: 'A', textEn: 'Redistribute corporate shares so that every individual owns a piece of every business', textZh: '重新分配公司股份，让每个人都能在每家企业中分一杯羹' },
            { id: 'B', textEn: 'Create 72 versions of yourself, each mastering a different industry', textZh: '创造72个化身，每个精通一个不同的行业' },
            { id: 'C', textEn: 'Transform into an all-knowing prophet that oversees and predicts moves of everyone in the business world', textZh: '化身为全知预言家，精准观测并预测商业世界中每个人的行动' },
            { id: 'D', textEn: 'Imbue every product with divine allure, making it irresistible to all', textZh: '赋予所有产品神圣吸引力，让所有人都无法抗拒' },
            { id: 'E', textEn: 'Reconstruct the entire economic system to achieve absolute perfection and sustainability', textZh: '重塑所有经济体系，实现绝对完美与可持续发展' },
            { id: 'F', textEn: 'Ensure that no matter what happens, my business always stays ahead and outmaneuvers my competitors', textZh: '确保无论发生什么，我的企业始终超越我的竞争对手' }
          ]
        },
        {
          id: 30,
          type: 'scale-question',
          textEn: 'How involved do you feel you are with your previous social life from work after pregnancy?',
          textZh: '您觉得怀孕后自己与以往工作的社交联系程度如何？',
          scaleLabels: {
            minEn: 'Not involved at all',
            minZh: '完全未参与',
            maxEn: 'Very involved',
            maxZh: '非常投入'
          },
          tags: ['社交情商']
        },
        {
          id: 31,
          type: 'scale-question',
          textEn: 'How well does your work arrangement after pregnancy support your needs as a working mother?',
          textZh: '您怀孕后的工作安排对作为职场母亲的您有多大支持作用？',
          scaleLabels: {
            minEn: 'Not supportive at all',
            minZh: '完全不支持',
            maxEn: 'Extremely supportive',
            maxZh: '非常支持'
          }
        },
        {
          id: 32,
          type: 'scale-question',
          textEn: 'How connected do you feel to your professional identity since becoming a mother?',
          textZh: '自成为母亲后，您对自己的职业身份感有多强？',
          scaleLabels: {
            minEn: 'Not connected – motherhood is full priority',
            minZh: '完全不强 – 母亲角色优先',
            maxEn: 'Very connected – profession is important',
            maxZh: '非常强 – 职业身份很重要'
          },
          tags: ['自我意识']
        },
        {
          id: 33,
          type: 'scale-question',
          textEn: 'How has motherhood impacted your career progression or promotion opportunities?',
          textZh: '母亲身份对您的职业发展或晋升机会有何影响？',
          scaleLabels: {
            minEn: 'Very negative – significantly hindered',
            minZh: '非常负面 – 明显阻碍',
            maxEn: 'Very positive – enhanced opportunities',
            maxZh: '非常积极 – 提升机会'
          }
        },
        {
          id: 34,
          type: 'scale-question',
          textEn: 'How capable are you with the current support your employer provides in balancing work and motherhood?',
          textZh: '您如何评价您运用公司提供的兼顾工作和育儿的支持的能力？',
          scaleLabels: {
            minEn: 'Not capable of being supported',
            minZh: '完全不能被支持',
            maxEn: 'Extremely supported',
            maxZh: '非常能被支持'
          },
          tags: ['自我意识']
        },
        {
          id: 35,
          type: 'scale-question',
          textEn: 'How has motherhood influenced your leadership or management style at work?',
          textZh: '母亲身份如何影响了您在工作中的领导或管理风格？',
          scaleLabels: {
            minEn: 'Negative – worse at communication',
            minZh: '消极影响 – 降低沟通能力',
            maxEn: 'Positive – better at communication',
            maxZh: '积极影响 – 提升沟通能力'
          },
          tags: ['情绪调节']
        },
        {
          id: 36,
          type: 'scale-question',
          textEn: 'How effective are you at managing work-related stress since becoming a mother?',
          textZh: '自成为母亲后，您应对工作压力的能力如何？',
          scaleLabels: {
            minEn: 'Much less – harder to manage stress now',
            minZh: '更低效 – 更难应对压力',
            maxEn: 'Much more – strengthened my resilience',
            maxZh: '更有效 – 增强了韧性'
          },
          tags: ['核心耐力', '情绪调节']
        },
        {
          id: 37,
          type: 'scale-question',
          textEn: 'How motivated do you feel to pursue career growth since becoming a mother?',
          textZh: '自成为母亲后，您在职业发展方面的动力有多强？',
          scaleLabels: {
            minEn: 'Not motivated at all',
            minZh: '完全没有',
            maxEn: 'Very motivated',
            maxZh: '非常强'
          },
          tags: ['核心耐力']
        },
        {
          id: 38,
          type: 'scale-question',
          textEn: 'How would your satisfaction level with your ability to maintain work-life balance be?',
          textZh: '您对您目前工作与生活平衡的能力感到满意吗？',
          scaleLabels: {
            minEn: 'Very dissatisfied',
            minZh: '非常不满意',
            maxEn: 'Very satisfied',
            maxZh: '非常满意'
          },
          tags: ['自我意识']
        },
        {
          id: 39,
          type: 'scale-question',
          textEn: 'How often do you feel your needs as a mother are taken into account during important workplace decisions?',
          textZh: '在重要的职场决策中，您觉得作为职场母亲的需求被考虑的频率如何？',
          scaleLabels: {
            minEn: 'Never – completely overlooked',
            minZh: '从未 – 完全未被考虑',
            maxEn: 'Always – consistently considered',
            maxZh: '总是 – 经常被考虑'
          },
          tags: ['自我意识']
        },
        {
          id: 40,
          type: 'scale-question',
          textEn: 'How connected do you feel with other mothers through your work?',
          textZh: '您在工作中与其他母亲的联系如何？',
          scaleLabels: {
            minEn: 'Very disconnected — no connection',
            minZh: '非常弱 – 没有联系',
            maxEn: 'Very connected – strong networks',
            maxZh: '非常强 – 紧密网络'
          },
          tags: ['社交情商']
        },
        {
          id: 41,
          type: 'scale-question',
          textEn: 'Are you actively seeking more opportunities to connect with other mothers through your profession?',
          textZh: '您是否主动在工作中寻求更多与其他职场母亲建立联系的机会？',
          scaleLabels: {
            minEn: 'Never',
            minZh: '从不',
            maxEn: 'Always',
            maxZh: '经常'
          },
          tags: ['社交情商']
        },
        {
          id: 42,
          type: 'scale-question',
          textEn: 'How well do you think enhanced abstract logical thinking would address emotional and life concerns?',
          textZh: '您认为加强抽象逻辑思维对解决情感和生活问题有多大帮助？',
          scaleLabels: {
            minEn: 'Not well - No link with emotions',
            minZh: '完全不行 – 毫无关系',
            maxEn: 'Extremely well - Very effective',
            maxZh: '非常好 – 极其有效'
          },
          tags: ['客观能力', '情绪调节']
        },
        {
          id: 43,
          type: 'scale-question',
          textEn: 'Do you believe that self-love and the ability to care for others require strong logic to navigate challenges in life?',
          textZh: '你认为真正的自爱和关爱他人的能力在多大程度上需要强大的客观思维来解决生活中的挑战？',
          scaleLabels: {
            minEn: 'Strongly disagree',
            minZh: '非常不同意',
            maxEn: 'Strongly agree',
            maxZh: '非常同意'
          }
        },
        {
          id: 44,
          type: 'scale-question',
          textEn: 'How valuable do you find having a professional page within the app to showcase your previous work?',
          textZh: '您觉得在应用内拥有一个用于展示以往工作的职业页面有多大价值？',
          scaleLabels: {
            minEn: 'Not valuable at all',
            minZh: '完全没有价值',
            maxEn: 'Extremely valuable',
            maxZh: '非常有价值'
          },
          tags: ['自我意识']
        },
        {
          id: 45,
          type: 'scale-question',
          textEn: 'How likely are you to use this app to share completed projects or achievements for deal sourcing or client acquisition?',
          textZh: '您有多大可能使用该应用分享完成的商业项目或工作成就，以寻找合作机会或获取客户？',
          scaleLabels: {
            minEn: 'Very unlikely',
            minZh: '完全不可能',
            maxEn: 'Very likely',
            maxZh: '非常可能'
          },
          tags: ['客观能力']
        },
        {
          id: 46,
          type: 'scale-question',
          textEn: 'How valuable would you find a feature that helps working mothers stay updated with trends and knowledge in their professional field?',
          textZh: '您认为一个帮助职场母亲了解其行业领域最新动态的功能有多大用处？',
          scaleLabels: {
            minEn: 'Not valuable',
            minZh: '毫无价值 – 毫无益处',
            maxEn: 'Extremely valuable',
            maxZh: '极具价值 – 职业发展必备'
          },
          tags: ['奉献精神']
        },
        {
          id: 47,
          type: 'scale-question',
          textEn: 'How likely are you to use the forum to connect with other mothers for emotional or medical support?',
          textZh: '您有多大可能使用该论坛与其他母亲建立联系，获取情感或医疗方面的支持？',
          scaleLabels: {
            minEn: 'Very unlikely',
            minZh: '完全不可能',
            maxEn: 'Very likely',
            maxZh: '非常可能'
          },
          tags: ['社交情商']
        },
        {
          id: 48,
          type: 'scale-question',
          textEn: 'How valuable do you think this forum could be in helping you feel less isolated as a working mother?',
          textZh: '您认为该论坛在帮助您增进作为职场母亲与别人连接方面有多大价值？',
          scaleLabels: {
            minEn: 'Not valuable at all',
            minZh: '完全没有价值',
            maxEn: 'Extremely valuable',
            maxZh: '非常有价值'
          },
          tags: ['自我意识', '社交情商']
        },
        {
          id: 49,
          type: 'scale-question',
          textEn: 'How motivated are you to use visuospatial and logical training modules within the app to strengthen abstract cognitive skills?',
          textZh: '您有多大动力使用应用内的视觉空间和逻辑训练模块？',
          scaleLabels: {
            minEn: 'Not motivated at all',
            minZh: '完全没有动力',
            maxEn: 'Very motivated',
            maxZh: '非常有动力'
          },
          tags: ['客观能力']
        },
        {
          id: 50,
          type: 'scale-question',
          textEn: 'How helpful do you think cognitive training would be in enhancing your problem-solving abilities?',
          textZh: '您认为抽象逻辑训练对提升您解决问题的能力有多大帮助？',
          scaleLabels: {
            minEn: 'Not helpful at all',
            minZh: '完全无帮助',
            maxEn: 'Extremely helpful',
            maxZh: '非常有帮助'
          },
          tags: ['客观能力']
        },
        {
          id: 51,
          type: 'scale-question',
          textEn: 'How engaging do you think it would be to create and interact with a self-designed electronic child avatar in your personal profile?',
          textZh: '您觉得在个人主页中创建并与自定义的"电子小孩"虚拟形象互动的这个功能有多大吸引力？',
          scaleLabels: {
            minEn: 'Not engaging at all',
            minZh: '完全无吸引力',
            maxEn: 'Very engaging',
            maxZh: '非常有吸引力'
          },
          tags: ['社交情商']
        },
        {
          id: 52,
          type: 'scale-question',
          textEn: 'How would you evaluate a company-specific AI model offering work-related productivity features for you and other mothers?',
          textZh: '您如何看待一个专门为每家公司定制的职场母亲专用人工智能模型？',
          scaleLabels: {
            minEn: 'Not valuable – completely unnecessary',
            minZh: '毫无必要 – 完全不需要',
            maxEn: 'Extremely helpful – enhances efficiency',
            maxZh: '极具价值 – 提升效率'
          },
          tags: ['客观能力']
        },
        {
          id: 53,
          type: 'scale-question',
          textEn: 'How do you feel about requiring you to submit a confidential child health-related record to verify that you and other users are active caregivers?',
          textZh: '您如何看待要求您在使用本应用程序之前提交与儿童健康相关的保密记录，以证实您是孩子的照顾者？',
          scaleLabels: {
            minEn: 'Strongly oppose – utterly invasive',
            minZh: '强烈反对 - 违反隐私',
            maxEn: 'Strongly support – ensures safety and trust',
            maxZh: '强烈支持 - 保障安全的基础'
          },
          tags: ['客观能力']
        },
        {
          id: 54,
          type: 'scale-question',
          textEn: 'Do you believe misuse by unintended users (including your partner accessing accounts without permission) could negatively affect trust in the app?',
          textZh: '您认为如果有非目标用户滥用该平台（包括您的生活伴侣未经允许访问账户等情况），是否会对用户对本应用的信任度产生负面影响？',
          scaleLabels: {
            minEn: 'Definitely no – no trust risk',
            minZh: '绝对不 – 完全无风险',
            maxEn: 'Definitely yes – severely undermines trust',
            maxZh: '绝对会 – 严重破坏信任'
          }
        },
        {
          id: 55,
          type: 'scale-question',
          textEn: 'How do you feel about your company occasionally verifying through HR that business updates and activities posted on this platform are genuinely by yourself and other mother users, not others misusing their accounts?',
          textZh: '您如何看待由公司人力资源部门核查平台上的业务更新和动态确实由目标用户本人发布，而非他人滥用账户？',
          scaleLabels: {
            minEn: 'Strongly oppose',
            minZh: '强烈反对',
            maxEn: 'Strongly support',
            maxZh: '强烈支持'
          },
          tags: ['自我意识']
        },
        {
          id: 56,
          type: 'scale-question',
          textEn: 'How prepared did you feel for motherhood before becoming a mother?',
          textZh: '在成为母亲之前，您觉得自己对母亲这一角色的准备程度如何？',
          scaleLabels: {
            minEn: 'Not prepared at all',
            minZh: '完全没有准备',
            maxEn: 'Very prepared',
            maxZh: '非常充分'
          },
          tags: ['核心耐力']
        },
        {
          id: 57,
          type: 'scale-question',
          textEn: 'How much has motherhood changed your personal values or priorities?',
          textZh: '母亲身份对您的个人价值观或人生优先事项改变有多大？',
          scaleLabels: {
            minEn: 'No change',
            minZh: '没有改变',
            maxEn: 'Completely',
            maxZh: '完全改变'
          },
          tags: ['自我意识']
        },
        {
          id: 58,
          type: 'scale-question',
          textEn: 'How supported do you feel by your family or community in your motherhood journey?',
          textZh: '在做母亲的过程中，您觉得家人或社群对您的支持程度如何？',
          scaleLabels: {
            minEn: 'Not supported at all',
            minZh: '完全没有支持',
            maxEn: 'Extremely supported',
            maxZh: '非常支持'
          },
          tags: ['社交情商']
        },
        {
          id: 59,
          type: 'scale-question',
          textEn: 'How confident are you in your ability to balance motherhood with your personal goals (e.g., hobbies, self-care)?',
          textZh: '您在平衡母亲角色与个人目标方面有多大信心？',
          scaleLabels: {
            minEn: 'Not confident at all',
            minZh: '完全没有信心',
            maxEn: 'Very confident',
            maxZh: '非常有信心'
          },
          tags: ['自我意识']
        },
        {
          id: 60,
          type: 'scale-question',
          textEn: 'How much emotional fulfillment has motherhood brought to your life?',
          textZh: '母亲身份为您的生活带来了多少情感满足感？',
          scaleLabels: {
            minEn: 'No emotion at all',
            minZh: '完全没有情感',
            maxEn: 'Extremely fulfilling',
            maxZh: '非常满足'
          },
          tags: ['奉献精神']
        },
        {
          id: 61,
          type: 'scale-question',
          textEn: 'How much do you feel that motherhood has made you more resilient or emotionally strong?',
          textZh: '母亲身份是否让您变得更有韧性或情绪更强大？',
          scaleLabels: {
            minEn: 'Much weaker',
            minZh: '明显减弱',
            maxEn: 'Much stronger',
            maxZh: '显著增强'
          },
          tags: ['情绪调节', '核心耐力']
        },
        {
          id: 62,
          type: 'scale-question',
          textEn: 'How has motherhood affected your ability to set boundaries (e.g., with work, family, or friends) in life?',
          textZh: '母亲身份对您设定边界（如与工作、家庭或朋友）能力的影响如何？',
          scaleLabels: {
            minEn: 'Significantly weakened',
            minZh: '显著减弱',
            maxEn: 'Improved greatly',
            maxZh: '显著提升'
          },
          tags: ['自我意识']
        },
        {
          id: 63,
          type: 'scale-question',
          textEn: 'How often do you feel pressure to meet external expectations of motherhood (e.g., societal, cultural, or family expectations)?',
          textZh: '您多久感受到来自外界对母亲角色（如社会、文化或家庭）的期待压力？',
          scaleLabels: {
            minEn: 'Never',
            minZh: '从不',
            maxEn: 'Always',
            maxZh: '总是'
          },
          tags: ['自我意识']
        },
        {
          id: 64,
          type: 'scale-question',
          textEn: 'How satisfied are you with the balance between your motherhood role and your sense of self outside of being a mother?',
          textZh: '您对自己平衡母亲这一身份与作为母亲之外的自我身份有多满意？',
          scaleLabels: {
            minEn: 'Very dissatisfied',
            minZh: '非常不满意',
            maxEn: 'Very satisfied',
            maxZh: '非常满意'
          },
          tags: ['自我意识']
        },
        {
          id: 65,
          type: 'scale-question',
          textEn: 'How important is it for you to connect with other mothers who share similar experiences?',
          textZh: '与有类似经历的其他母亲建立联系对您来说有多重要？',
          scaleLabels: {
            minEn: 'Not important at all',
            minZh: '完全不重要',
            maxEn: 'Extremely important',
            maxZh: '非常重要'
          },
          tags: ['社交情商']
        },
        {
          id: 66,
          type: 'scale-question',
          textEn: 'How much do you feel that your own mother\'s role influenced your early understanding of leadership or responsibility?',
          textZh: '您认为您的母亲在多大程度上影响了童年时期您对领导力或责任感的认知？',
          scaleLabels: {
            minEn: 'Not at all',
            minZh: '没有影响',
            maxEn: 'Very strongly',
            maxZh: '非常深远'
          },
          tags: ['自我意识']
        }
      ],
      privacyStatement: {
        titleEn: 'Privacy Statement',
        titleZh: '隐私声明',
        contentEn: '<strong style="font-size: 1.2em;">Data Usage and Privacy Statement</strong><br><br>At CHON, your privacy is fundamental. We only collect the information necessary to deliver meaningful insights, and we protect it with the highest standards of security and integrity.<br><br><hr><br><strong style="font-size: 1.2em;">For Individual Participants</strong><br><br>Your personal information will be used solely for the following purposes:<br><ul><li>To verify your eligibility for specific sections of the survey</li><li>To support demographic and statistical analysis across participant groups</li><li>To generate your personalized CHON personality profile</li></ul>',
        contentZh: '<strong style="font-size: 1.2em;">数据使用与隐私声明</strong><br><br>在 CHON，我们将您的隐私视为基本原则。我们仅收集实现分析目的所必需的信息，并以最高标准保障数据的安全与完整性。<br><br><hr><br><strong style="font-size: 1.2em;">针对个人参与者</strong><br><br>您的个人信息将仅用于以下用途：<br><ul><li>验证您是否符合特定问卷部分的参与资格</li><li>用于不同人群的统计与人口特征分析</li><li>生成您的个性化 CHON 性格分析报告</li></ul>'
      }
    }
  };