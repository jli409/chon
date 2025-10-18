export type QuestionType = 'multiple-choice' | 'text-input' | 'scale-question' | 'multi-select' | 'searchable-dropdown' | 'text-with-unit';
export type QuestionnaireType = 'mother' | 'corporate' | 'other' | 'both';

export interface Option {
  id: string;
  textEn: string;
  textZh: string;
}

export interface ScaleLabels {
  left: {
    en: string;
    zh: string;
  };
  right: {
    en: string;
    zh: string;
  };
}

export interface Question {
  id: string;
  type: QuestionType;
  textEn: string;
  textZh: string;
  options?: Option[];
  scaleLabels?: ScaleLabels;
  tags?: string[];
  conditionalTags?: {
    male?: string[];
    female?: string[];
  };
  multiple?: boolean;
  unifiedId?: number; // Reference to the unified question ID for conditional logic
}

export interface QuestionnaireConfig {
  type: QuestionnaireType;
  title: {
    en: string;
    zh: string;
  };
  questionIds: number[]; // References to unified questions by numeric ID
  questionModifications?: Record<number, {
    textEn?: string;
    textZh?: string;
    sectionTitle?: {
      en: string;
      zh: string;
    };
  }>;
  conditionalModifications?: Record<number, {
    condition: {
      questionId: number;
      answer: string;
    };
    modifications: {
      textEn?: string;
      textZh?: string;
    };
  }[]>;
  sections?: {
    title: {
      en: string;
      zh: string;
    };
    startIndex: number;
    endIndex: number;
  }[];
  totalQuestions: number;
}

export interface PrivacyStatement {
  titleEn: string;
  titleZh: string;
  contentEn: string;
  contentZh: string;
}

export interface QuestionnaireContext {
  type: QuestionnaireType;
  title: {
    en: string;
    zh: string;
  };
  questions: Question[];
  privacyStatement: PrivacyStatement;
  totalQuestions: number;
}

export const unifiedQuestions: Record<number, Question> = {
  // Demographics
  1: {
    id: '1',
    type: 'multiple-choice',
    textEn: 'What\'s your biological sex?',
    textZh: '您的生理性别是什么？',
    options: [
      { id: 'A', textEn: 'Female', textZh: '女' },
      { id: 'B', textEn: 'Male', textZh: '男' }
    ]
  },
  2: {
    id: '2',
        type: 'multiple-choice',
        textEn: 'What is your age range?',
        textZh: '您的年龄是？',
        options: [
          { id: 'A', textEn: 'Under 18', textZh: '18岁以下' },
          { id: 'B', textEn: '18–24', textZh: '18–24' },
          { id: 'C', textEn: '25–34', textZh: '25–34' },
          { id: 'D', textEn: '35–44', textZh: '35–44' },
          { id: 'E', textEn: '45–54', textZh: '45–54' },
          { id: 'F', textEn: '55–64', textZh: '55–64' },
          { id: 'G', textEn: '65 or above', textZh: '65岁及以上' }
        ]
      },
  3: {
    id: '3',
    type: 'searchable-dropdown',
        textEn: 'Where are you currently based?',
    textZh: '您目前所在的国家或地区是？',
        options: [
      { id: 'AF', textEn: 'Afghanistan', textZh: '阿富汗' },
      { id: 'AL', textEn: 'Albania', textZh: '阿尔巴尼亚' },
      { id: 'DZ', textEn: 'Algeria', textZh: '阿尔及利亚' },
      { id: 'AD', textEn: 'Andorra', textZh: '安道尔' },
      { id: 'AO', textEn: 'Angola', textZh: '安哥拉' },
      { id: 'AG', textEn: 'Antigua and Barbuda', textZh: '安提瓜和巴布达' },
      { id: 'AR', textEn: 'Argentina', textZh: '阿根廷' },
      { id: 'AM', textEn: 'Armenia', textZh: '亚美尼亚' },
      { id: 'AU', textEn: 'Australia', textZh: '澳大利亚' },
      { id: 'AT', textEn: 'Austria', textZh: '奥地利' },
      { id: 'AZ', textEn: 'Azerbaijan', textZh: '阿塞拜疆' },
      { id: 'BS', textEn: 'Bahamas', textZh: '巴哈马' },
      { id: 'BH', textEn: 'Bahrain', textZh: '巴林' },
      { id: 'BD', textEn: 'Bangladesh', textZh: '孟加拉国' },
      { id: 'BB', textEn: 'Barbados', textZh: '巴巴多斯' },
      { id: 'BY', textEn: 'Belarus', textZh: '白俄罗斯' },
      { id: 'BE', textEn: 'Belgium', textZh: '比利时' },
      { id: 'BZ', textEn: 'Belize', textZh: '伯利兹' },
      { id: 'BJ', textEn: 'Benin', textZh: '贝宁' },
      { id: 'BT', textEn: 'Bhutan', textZh: '不丹' },
      { id: 'BO', textEn: 'Bolivia', textZh: '玻利维亚' },
      { id: 'BA', textEn: 'Bosnia and Herzegovina', textZh: '波斯尼亚和黑塞哥维那' },
      { id: 'BW', textEn: 'Botswana', textZh: '博茨瓦纳' },
      { id: 'BR', textEn: 'Brazil', textZh: '巴西' },
      { id: 'BN', textEn: 'Brunei', textZh: '文莱' },
      { id: 'BG', textEn: 'Bulgaria', textZh: '保加利亚' },
      { id: 'BF', textEn: 'Burkina Faso', textZh: '布基纳法索' },
      { id: 'BI', textEn: 'Burundi', textZh: '布隆迪' },
      { id: 'CV', textEn: 'Cabo Verde', textZh: '佛得角' },
      { id: 'KH', textEn: 'Cambodia', textZh: '柬埔寨' },
      { id: 'CM', textEn: 'Cameroon', textZh: '喀麦隆' },
      { id: 'CA', textEn: 'Canada', textZh: '加拿大' },
      { id: 'CF', textEn: 'Central African Republic', textZh: '中非共和国' },
      { id: 'TD', textEn: 'Chad', textZh: '乍得' },
      { id: 'CL', textEn: 'Chile', textZh: '智利' },
      { id: 'CN', textEn: 'China', textZh: '中国' },
      { id: 'CO', textEn: 'Colombia', textZh: '哥伦比亚' },
      { id: 'KM', textEn: 'Comoros', textZh: '科摩罗' },
      { id: 'CG', textEn: 'Congo', textZh: '刚果（布）' },
      { id: 'CD', textEn: 'Congo (DRC)', textZh: '刚果（金）' },
      { id: 'CR', textEn: 'Costa Rica', textZh: '哥斯达黎加' },
      { id: 'CI', textEn: 'Côte d\'Ivoire', textZh: '科特迪瓦' },
      { id: 'HR', textEn: 'Croatia', textZh: '克罗地亚' },
      { id: 'CU', textEn: 'Cuba', textZh: '古巴' },
      { id: 'CY', textEn: 'Cyprus', textZh: '塞浦路斯' },
      { id: 'CZ', textEn: 'Czech Republic', textZh: '捷克' },
      { id: 'DK', textEn: 'Denmark', textZh: '丹麦' },
      { id: 'DJ', textEn: 'Djibouti', textZh: '吉布提' },
      { id: 'DM', textEn: 'Dominica', textZh: '多米尼克' },
      { id: 'DO', textEn: 'Dominican Republic', textZh: '多米尼加' },
      { id: 'EC', textEn: 'Ecuador', textZh: '厄瓜多尔' },
      { id: 'EG', textEn: 'Egypt', textZh: '埃及' },
      { id: 'SV', textEn: 'El Salvador', textZh: '萨尔瓦多' },
      { id: 'GQ', textEn: 'Equatorial Guinea', textZh: '赤道几内亚' },
      { id: 'ER', textEn: 'Eritrea', textZh: '厄立特里亚' },
      { id: 'EE', textEn: 'Estonia', textZh: '爱沙尼亚' },
      { id: 'SZ', textEn: 'Eswatini', textZh: '斯威士兰' },
      { id: 'ET', textEn: 'Ethiopia', textZh: '埃塞俄比亚' },
      { id: 'FJ', textEn: 'Fiji', textZh: '斐济' },
      { id: 'FI', textEn: 'Finland', textZh: '芬兰' },
      { id: 'FR', textEn: 'France', textZh: '法国' },
      { id: 'GA', textEn: 'Gabon', textZh: '加蓬' },
      { id: 'GM', textEn: 'Gambia', textZh: '冈比亚' },
      { id: 'GE', textEn: 'Georgia', textZh: '格鲁吉亚' },
      { id: 'DE', textEn: 'Germany', textZh: '德国' },
      { id: 'GH', textEn: 'Ghana', textZh: '加纳' },
      { id: 'GR', textEn: 'Greece', textZh: '希腊' },
      { id: 'GD', textEn: 'Grenada', textZh: '格林纳达' },
      { id: 'GT', textEn: 'Guatemala', textZh: '危地马拉' },
      { id: 'GN', textEn: 'Guinea', textZh: '几内亚' },
      { id: 'GW', textEn: 'Guinea-Bissau', textZh: '几内亚比绍' },
      { id: 'GY', textEn: 'Guyana', textZh: '圭亚那' },
      { id: 'HT', textEn: 'Haiti', textZh: '海地' },
      { id: 'HN', textEn: 'Honduras', textZh: '洪都拉斯' },
      { id: 'HK', textEn: 'Hong Kong SAR', textZh: '香港特别行政区' },
      { id: 'HU', textEn: 'Hungary', textZh: '匈牙利' },
      { id: 'IS', textEn: 'Iceland', textZh: '冰岛' },
      { id: 'IN', textEn: 'India', textZh: '印度' },
      { id: 'ID', textEn: 'Indonesia', textZh: '印度尼西亚' },
      { id: 'IR', textEn: 'Iran', textZh: '伊朗' },
      { id: 'IQ', textEn: 'Iraq', textZh: '伊拉克' },
      { id: 'IE', textEn: 'Ireland', textZh: '爱尔兰' },
      { id: 'IL', textEn: 'Israel', textZh: '以色列' },
      { id: 'IT', textEn: 'Italy', textZh: '意大利' },
      { id: 'JM', textEn: 'Jamaica', textZh: '牙买加' },
      { id: 'JP', textEn: 'Japan', textZh: '日本' },
      { id: 'JO', textEn: 'Jordan', textZh: '约旦' },
      { id: 'KZ', textEn: 'Kazakhstan', textZh: '哈萨克斯坦' },
      { id: 'KE', textEn: 'Kenya', textZh: '肯尼亚' },
      { id: 'KI', textEn: 'Kiribati', textZh: '基里巴斯' },
      { id: 'KP', textEn: 'North Korea', textZh: '朝鲜' },
      { id: 'KR', textEn: 'South Korea', textZh: '韩国' },
      { id: 'KW', textEn: 'Kuwait', textZh: '科威特' },
      { id: 'KG', textEn: 'Kyrgyzstan', textZh: '吉尔吉斯斯坦' },
      { id: 'LA', textEn: 'Laos', textZh: '老挝' },
      { id: 'LV', textEn: 'Latvia', textZh: '拉脱维亚' },
      { id: 'LB', textEn: 'Lebanon', textZh: '黎巴嫩' },
      { id: 'LS', textEn: 'Lesotho', textZh: '莱索托' },
      { id: 'LR', textEn: 'Liberia', textZh: '利比里亚' },
      { id: 'LY', textEn: 'Libya', textZh: '利比亚' },
      { id: 'LI', textEn: 'Liechtenstein', textZh: '列支敦士登' },
      { id: 'LT', textEn: 'Lithuania', textZh: '立陶宛' },
      { id: 'LU', textEn: 'Luxembourg', textZh: '卢森堡' },
      { id: 'MO', textEn: 'Macao SAR', textZh: '澳门特别行政区' },
      { id: 'MG', textEn: 'Madagascar', textZh: '马达加斯加' },
      { id: 'MW', textEn: 'Malawi', textZh: '马拉维' },
      { id: 'MY', textEn: 'Malaysia', textZh: '马来西亚' },
      { id: 'MV', textEn: 'Maldives', textZh: '马尔代夫' },
      { id: 'ML', textEn: 'Mali', textZh: '马里' },
      { id: 'MT', textEn: 'Malta', textZh: '马耳他' },
      { id: 'MH', textEn: 'Marshall Islands', textZh: '马绍尔群岛' },
      { id: 'MR', textEn: 'Mauritania', textZh: '毛里塔尼亚' },
      { id: 'MU', textEn: 'Mauritius', textZh: '毛里求斯' },
      { id: 'MX', textEn: 'Mexico', textZh: '墨西哥' },
      { id: 'FM', textEn: 'Micronesia', textZh: '密克罗尼西亚' },
      { id: 'MD', textEn: 'Moldova', textZh: '摩尔多瓦' },
      { id: 'MC', textEn: 'Monaco', textZh: '摩纳哥' },
      { id: 'MN', textEn: 'Mongolia', textZh: '蒙古' },
      { id: 'ME', textEn: 'Montenegro', textZh: '黑山' },
      { id: 'MA', textEn: 'Morocco', textZh: '摩洛哥' },
      { id: 'MZ', textEn: 'Mozambique', textZh: '莫桑比克' },
      { id: 'MM', textEn: 'Myanmar', textZh: '缅甸' },
      { id: 'NA', textEn: 'Namibia', textZh: '纳米比亚' },
      { id: 'NR', textEn: 'Nauru', textZh: '瑙鲁' },
      { id: 'NP', textEn: 'Nepal', textZh: '尼泊尔' },
      { id: 'NL', textEn: 'Netherlands', textZh: '荷兰' },
      { id: 'NZ', textEn: 'New Zealand', textZh: '新西兰' },
      { id: 'NI', textEn: 'Nicaragua', textZh: '尼加拉瓜' },
      { id: 'NE', textEn: 'Niger', textZh: '尼日尔' },
      { id: 'NG', textEn: 'Nigeria', textZh: '尼日利亚' },
      { id: 'MK', textEn: 'North Macedonia', textZh: '北马其顿' },
      { id: 'NO', textEn: 'Norway', textZh: '挪威' },
      { id: 'OM', textEn: 'Oman', textZh: '阿曼' },
      { id: 'PK', textEn: 'Pakistan', textZh: '巴基斯坦' },
      { id: 'PW', textEn: 'Palau', textZh: '帕劳' },
      { id: 'PS', textEn: 'Palestine', textZh: '巴勒斯坦' },
      { id: 'PA', textEn: 'Panama', textZh: '巴拿马' },
      { id: 'PG', textEn: 'Papua New Guinea', textZh: '巴布亚新几内亚' },
      { id: 'PY', textEn: 'Paraguay', textZh: '巴拉圭' },
      { id: 'PE', textEn: 'Peru', textZh: '秘鲁' },
      { id: 'PH', textEn: 'Philippines', textZh: '菲律宾' },
      { id: 'PL', textEn: 'Poland', textZh: '波兰' },
      { id: 'PT', textEn: 'Portugal', textZh: '葡萄牙' },
      { id: 'QA', textEn: 'Qatar', textZh: '卡塔尔' },
      { id: 'RO', textEn: 'Romania', textZh: '罗马尼亚' },
      { id: 'RU', textEn: 'Russia', textZh: '俄罗斯' },
      { id: 'RW', textEn: 'Rwanda', textZh: '卢旺达' },
      { id: 'KN', textEn: 'Saint Kitts and Nevis', textZh: '圣基茨和尼维斯' },
      { id: 'LC', textEn: 'Saint Lucia', textZh: '圣卢西亚' },
      { id: 'VC', textEn: 'Saint Vincent and the Grenadines', textZh: '圣文森特和格林纳丁斯' },
      { id: 'WS', textEn: 'Samoa', textZh: '萨摩亚' },
      { id: 'SM', textEn: 'San Marino', textZh: '圣马力诺' },
      { id: 'ST', textEn: 'Sao Tome and Principe', textZh: '圣多美和普林西比' },
      { id: 'SA', textEn: 'Saudi Arabia', textZh: '沙特阿拉伯' },
      { id: 'SN', textEn: 'Senegal', textZh: '塞内加尔' },
      { id: 'RS', textEn: 'Serbia', textZh: '塞尔维亚' },
      { id: 'SC', textEn: 'Seychelles', textZh: '塞舌尔' },
      { id: 'SL', textEn: 'Sierra Leone', textZh: '塞拉利昂' },
      { id: 'SG', textEn: 'Singapore', textZh: '新加坡' },
      { id: 'SK', textEn: 'Slovakia', textZh: '斯洛伐克' },
      { id: 'SI', textEn: 'Slovenia', textZh: '斯洛文尼亚' },
      { id: 'SB', textEn: 'Solomon Islands', textZh: '所罗门群岛' },
      { id: 'SO', textEn: 'Somalia', textZh: '索马里' },
      { id: 'ZA', textEn: 'South Africa', textZh: '南非' },
      { id: 'SS', textEn: 'South Sudan', textZh: '南苏丹' },
      { id: 'ES', textEn: 'Spain', textZh: '西班牙' },
      { id: 'LK', textEn: 'Sri Lanka', textZh: '斯里兰卡' },
      { id: 'SD', textEn: 'Sudan', textZh: '苏丹' },
      { id: 'SR', textEn: 'Suriname', textZh: '苏里南' },
      { id: 'SE', textEn: 'Sweden', textZh: '瑞典' },
      { id: 'CH', textEn: 'Switzerland', textZh: '瑞士' },
      { id: 'SY', textEn: 'Syria', textZh: '叙利亚' },
      { id: 'TJ', textEn: 'Tajikistan', textZh: '塔吉克斯坦' },
      { id: 'TZ', textEn: 'Tanzania', textZh: '坦桑尼亚' },
      { id: 'TW', textEn: 'Taiwan Region', textZh: '台湾地区' },
      { id: 'TH', textEn: 'Thailand', textZh: '泰国' },
      { id: 'TL', textEn: 'Timor-Leste', textZh: '东帝汶' },
      { id: 'TG', textEn: 'Togo', textZh: '多哥' },
      { id: 'TO', textEn: 'Tonga', textZh: '汤加' },
      { id: 'TT', textEn: 'Trinidad and Tobago', textZh: '特立尼达和多巴哥' },
      { id: 'TN', textEn: 'Tunisia', textZh: '突尼斯' },
      { id: 'TR', textEn: 'Turkey', textZh: '土耳其' },
      { id: 'TM', textEn: 'Turkmenistan', textZh: '土库曼斯坦' },
      { id: 'TV', textEn: 'Tuvalu', textZh: '图瓦卢' },
      { id: 'UG', textEn: 'Uganda', textZh: '乌干达' },
      { id: 'UA', textEn: 'Ukraine', textZh: '乌克兰' },
      { id: 'AE', textEn: 'United Arab Emirates', textZh: '阿联酋' },
      { id: 'GB', textEn: 'United Kingdom', textZh: '英国' },
      { id: 'US', textEn: 'United States', textZh: '美国' },
      { id: 'UY', textEn: 'Uruguay', textZh: '乌拉圭' },
      { id: 'UZ', textEn: 'Uzbekistan', textZh: '乌兹别克斯坦' },
      { id: 'VU', textEn: 'Vanuatu', textZh: '瓦努阿图' },
      { id: 'VA', textEn: 'Vatican City', textZh: '梵蒂冈' },
      { id: 'VE', textEn: 'Venezuela', textZh: '委内瑞拉' },
      { id: 'VN', textEn: 'Vietnam', textZh: '越南' },
      { id: 'YE', textEn: 'Yemen', textZh: '也门' },
      { id: 'ZM', textEn: 'Zambia', textZh: '赞比亚' },
      { id: 'ZW', textEn: 'Zimbabwe', textZh: '津巴布韦' }
    ]
  },
  4: {
    id: '4',
        type: 'multiple-choice',
        textEn: 'Have you worked in a for-profit corporate setting, currently or in the past?',
    textZh: '您目前或过去是否曾在营利性企业环境中工作过？',
        options: [
          { id: 'A', textEn: 'Yes', textZh: '是' },
          { id: 'B', textEn: 'No', textZh: '否' }
        ]
      },
  5: {
    id: '5',
        type: 'multiple-choice',
    textEn: 'How would you describe your racial or ethnic background?',
    textZh: '您如何描述您的种族或民族背景？',
        options: [
      { id: 'A', textEn: 'African American', textZh: '非裔美国人' },
      { id: 'B', textEn: 'Asian', textZh: '亚洲人' },
      { id: 'C', textEn: 'Hispanic/Latino', textZh: '西班牙裔/拉丁美洲人' },
      { id: 'D', textEn: 'Middle Eastern/North African', textZh: '中东人/北非人' },
      { id: 'E', textEn: 'Mixed/Multiracial', textZh: '混血/多民族' },
      { id: 'F', textEn: 'Native American/Alaska Native', textZh: '美洲原住民/阿拉斯加原住民' },
      { id: 'G', textEn: 'Native Hawaiian/Pacific Islander', textZh: '夏威夷原住民/太平洋岛民' },
      { id: 'H', textEn: 'White/Caucasian', textZh: '白人/高加索人' },
      { id: 'I', textEn: 'Other', textZh: '其他' },
      { id: 'J', textEn: 'Prefer not to say', textZh: '不愿回答' }
    ]
  },
  6: {
    id: '6',
        type: 'text-input',
    textEn: 'Please enter your professional contact to allow us to verify your identity.',
    textZh: '请输入您的职业联系方式，以便验证身份。'
      },
  7: {
    id: '7',
        type: 'multiple-choice',
    textEn: 'How long have you been in a managerial or leadership role?',
        textZh: '您在管理或领导岗位上有多少年的工作经验？',
        options: [
          { id: 'A', textEn: '1–3 years', textZh: '1–3年' },
          { id: 'B', textEn: '4–6 years', textZh: '4–6年' },
          { id: 'C', textEn: '7–9 years', textZh: '7–9年' },
          { id: 'D', textEn: '10+ years', textZh: '10年以上' }
        ]
      },
  8: {
    id: '8',
        type: 'multiple-choice',
        textEn: 'Which industry or business sector does your company operate in?',
        textZh: '贵公司属于哪个行业或业务领域？',
        options: [
      { id: 'A', textEn: 'Consumer Goods & Retail', textZh: '消费品与零售' },
      { id: 'B', textEn: 'Education & Business Professional Services', textZh: '教育与商业专业服务' },
      { id: 'C', textEn: 'Energy & Utilities', textZh: '能源与公用事业' },
      { id: 'D', textEn: 'Entertainment & Media', textZh: '娱乐与媒体' },
      { id: 'E', textEn: 'Financial Services', textZh: '金融服务' },
      { id: 'F', textEn: 'Government, Nonprofits & Public Services', textZh: '政府、非营利组织与公共服务' },
      { id: 'G', textEn: 'Healthcare & Pharmaceuticals', textZh: '医疗保健与制药' },
      { id: 'H', textEn: 'Industrial Production & Manufacturing', textZh: '工业生产与制造业' },
      { id: 'I', textEn: 'Real Estate & Construction', textZh: '房地产与建筑' },
      { id: 'J', textEn: 'Technology & Telecommunications', textZh: '技术与电信' },
      { id: 'K', textEn: 'Transportation & Logistics', textZh: '运输与物流' }
    ]
  },
  9: {
    id: '9',
        type: 'multiple-choice',
    textEn: 'What is your company\'s total employee headcount?',
        textZh: '贵公司的员工总人数是多少？',
        options: [
          { id: 'A', textEn: 'Fewer than 50', textZh: '少于50人' },
          { id: 'B', textEn: '50–249', textZh: '50–249人' },
          { id: 'C', textEn: '250–999', textZh: '250–999人' },
          { id: 'D', textEn: '1,000–9,999', textZh: '1,000–9,999人' },
          { id: 'E', textEn: '10,000–50,000', textZh: '10,000–50,000人' },
          { id: 'F', textEn: '50,000 or more', textZh: '50,000人及以上' }
    ]
  },
  10: {
    id: '10',
        type: 'multiple-choice',
    textEn: 'What is the approximate annual revenue of your company?',
        textZh: '贵公司的年营收大约是多少？',
        options: [
      { id: 'A', textEn: 'Less than $1 million', textZh: '少于500万' },
      { id: 'B', textEn: '$1–10 million', textZh: '500–5,000万' },
      { id: 'C', textEn: '$10–50 million', textZh: '5,000万–5亿' },
      { id: 'D', textEn: '$50–500 million', textZh: '5亿–50亿' },
      { id: 'E', textEn: '$500 million–$5 billion', textZh: '50亿–500亿' },
      { id: 'F', textEn: 'Over $10 billion', textZh: '超过500亿' }
    ]
  },
  11: {
    id: '11',
        type: 'multiple-choice',
    textEn: 'What is the approximate size of your span of control?',
    textZh: '您的管理规模是多少？',
        options: [
      { id: 'A', textEn: '1–5 people', textZh: '1–5人' },
      { id: 'B', textEn: '6–20 people', textZh: '6–20人' },
      { id: 'C', textEn: '20–50 people', textZh: '20–50人' },
      { id: 'D', textEn: '50+ people', textZh: '50人以上' }
    ]
  },
  12: {
    id: '12',
    type: 'scale-question',
    textEn: 'What\'s the decision-making structure in your company?',
    textZh: '您如何描述贵公司的决策体系？',
    scaleLabels: {
      left: { en: 'Highly centralized', zh: '高度集中化' },
      right: { en: 'Flexibly adaptive', zh: '灵活变通' }
    }
  },
  13: {
    id: '13',
        type: 'scale-question',
    textEn: 'What should be the primary basis of authority in your company?',
    textZh: '贵司的决策权应该如何决定？',
        scaleLabels: {
      left: { en: 'Policies & Command', zh: '政策和指挥' },
      right: { en: 'Individual\'s ability', zh: '个人能力' }
    },
    tags: ['objectivity']
  },
  14: {
    id: '14',
        type: 'scale-question',
    textEn: 'How well-organized is your team structure?',
    textZh: '您的团队结构有多高效？',
        scaleLabels: {
      left: { en: 'Not organized', zh: '缺乏组织性' },
      right: { en: 'Very well-organized', zh: '组织性强' }
    },
    tags: ['objectivity']
  },
  15: {
    id: '15',
        type: 'scale-question',
    textEn: 'What\'s your team\'s level of communication and collaboration?',
    textZh: '您的团队的沟通与协作水平如何？',
        scaleLabels: {
      left: { en: 'Very poor – Lack communication & efficiency', zh: '非常差 — 缺乏沟通和效率' },
      right: { en: 'Excellent – Great communication & efficiency', zh: '非常好 — 极好的沟通并高效' }
    },
    tags: ['objectivity', 'socialIntelligence']
  },
  16: {
    id: '16',
        type: 'scale-question',
    textEn: 'What\'s your experience in establishing trust with business partners?',
    textZh: '您与客户建立信任的经历如何？',
        scaleLabels: {
      left: { en: 'Very poor – significant challenges', zh: '非常差 – 极大挑战' },
      right: { en: 'Excellent – effective and trusted', zh: '非常好 – 有效、可信' }
    },
    tags: ['socialIntelligence']
  },
  17: {
    id: '17',
        type: 'scale-question',
    textEn: 'Is your team effective at understanding client or market needs?',
    textZh: '贵司在理解客户或市场方面如何？',
        scaleLabels: {
      left: { en: 'Very poor – insufficient understanding', zh: '非常差 – 不充分了解' },
      right: { en: 'Excellent – exceeds expectations', zh: '非常好 – 超出预期' }
    },
    tags: ['socialIntelligence']
  },
  18: {
    id: '18',
        type: 'scale-question',
    textEn: 'Is responsibility important in business projects?',
    textZh: '责任感对于商业项目重要吗？',
        scaleLabels: {
      left: { en: 'Not important at all', zh: '完全不重要' },
      right: { en: 'Extremely important', zh: '极其重要' }
    },
    tags: ['objectivity', 'dedication']
  },
  19: {
    id: '19',
        type: 'scale-question',
    textEn: 'Are empathy and communication important in business relationships?',
    textZh: '同理心和沟通能力在商业关系中重要吗？',
        scaleLabels: {
      left: { en: 'Not important at all', zh: '完全不重要' },
      right: { en: 'Extremely important', zh: '极其重要' }
    },
    tags: ['socialIntelligence', 'dedication']
  },
  20: {
    id: '20',
        type: 'scale-question',
    textEn: 'Does your company value "soft skills" of responsibility, empathy, and communication?',
    textZh: '贵司认可软实力（例如责任心、同理心、沟通能力）吗？',
        scaleLabels: {
      left: { en: 'Not recognized at all', zh: '完全不认可' },
      right: { en: 'Highly recognized and utilized', zh: '高度认可和利用' }
    },
    tags: ['dedication']
  },
  21: {
    id: '21',
        type: 'scale-question',
    textEn: 'Are men and women equally supported in balancing work and family?',
    textZh: '男性和女性是否在平衡工作与家庭方面得到了同等支持？',
    scaleLabels: {
      left: { en: 'No, one is significantly less supported', zh: '不是，其一得到的很少同等支持' },
      right: { en: 'Yes, equally supported', zh: '是的，都得到了平等支持' }
    },
    conditionalTags: {
      male: ['objectivity'],
      female: ['selfAwareness']
    }
  },
  22: {
    id: '22',
        type: 'scale-question',
    textEn: 'Is providing support and social bonding for working mothers important?',
    textZh: '为职场母亲提供情感和支持重要吗？',
        scaleLabels: {
      left: { en: 'Not important at all', zh: '完全不重要' },
      right: { en: 'Very important', zh: '非常重要' }
    },
    conditionalTags: {
      male: ['dedication'],
      female: ['selfAwareness']
    }
  },
  23: {
    id: '23',
        type: 'scale-question',
    textEn: 'How is your company\'s current support for working mothers?',
    textZh: '贵司在您的领导下目前对职场母亲的支持程度是？',
        scaleLabels: {
      left: { en: 'Not supportive at all', zh: '完全不支持' },
      right: { en: 'Highly supportive', zh: '高度支持' }
    },
    conditionalTags: {
      male: ['dedication'],
      female: ['selfAwareness']
    }
  },
  24: {
    id: '24',
        type: 'scale-question',
    textEn: 'Do you use technology within your team?',
    textZh: '您在团队里会常用科技工具吗？',
        scaleLabels: {
      left: { en: 'Not at all', zh: '完全不使用' },
      right: { en: 'Very effectively', zh: '非常有效地使用' }
    },
    tags: ['objectivity']
  },
  25: {
    id: '25',
        type: 'multiple-choice',
    textEn: 'For the personality test result, we ask you to imagine yourself as the god or goddess of the business world... If you could change or create one thing, what would it be?',
    textZh: '关于性格测试结果，我们请您将自己想象成商界的创造神... 如果您可以创造或改变以下任何一件事，您会选择什么？',
        options: [
      { id: 'prometheus', textEn: 'Redistribute all corporate shares so that every individual owns a piece of every business', textZh: '重新分配所有企业股份，让每个人都拥有每家企业的一部分' },
      { id: 'wukong', textEn: 'Create 72 versions of yourself, each mastering a different industry', textZh: '创造72个版本的自己，每个都精通不同的行业' },
      { id: 'odin', textEn: 'Transform into an omnipotent prophet that predicts and controls moves of everyone in the business world', textZh: '转变为全能的预言家，预测并控制商界每个人的行动' },
      { id: 'venus', textEn: 'Imbue every product with divine allure, making it irresistible to all', textZh: '为每个产品注入神圣的魅力，使其对所有人都有不可抗拒的吸引力' },
      { id: 'nuwa', textEn: 'Reconstruct the entire economic system to achieve absolute perfection and sustainability', textZh: '重建整个经济体系，实现绝对的完美和可持续性' },
      { id: 'athena', textEn: 'Ensure that no matter what happens, I can always come up with a plan to stay ahead and outmaneuver my competitors', textZh: '确保无论发生什么，我总能想出计划来保持领先并超越竞争对手' }
    ]
  },
  26: {
    id: '26',
        type: 'scale-question',
    textEn: 'Does logical thinking address emotional and life concerns?',
    textZh: '逻辑思维是否解决情感和生活问题？',
        scaleLabels: {
      left: { en: 'Not well – no link with emotions', zh: '完全不行 – 毫无关系' },
      right: { en: 'Extremely well – very effective', zh: '非常好 – 极其有效' }
    },
    tags: ['objectivity', 'emotionalRegulation']
  },
  27: {
    id: '27',
        type: 'scale-question',
    textEn: 'Do self-love and care for others require objective reasoning?',
    textZh: '自爱和关爱他人是否需要客观思维支持？',
        scaleLabels: {
      left: { en: 'Strongly disagree', zh: '非常不需要' },
      right: { en: 'Strongly agree', zh: '非常需要' }
    },
    tags: ['objectivity']
  },
  28: {
    id: '28',
        type: 'scale-question',
    textEn: 'How valuable is it for working mothers to stay updated with their professional field?',
    textZh: '职场母亲了解行业领域信息有多大价值？',
        scaleLabels: {
      left: { en: 'Not valuable', zh: '毫无价值' },
      right: { en: 'Extremely valuable', zh: '极具价值' }
    },
    tags: ['dedication']
  },
  29: {
    id: '29',
        type: 'scale-question',
    textEn: 'How valuable is it for working mothers to post and access new business deals?',
    textZh: '职场母亲发布和获取商业合作有多大价值？',
        scaleLabels: {
      left: { en: 'Not valuable', zh: '毫无价值' },
      right: { en: 'Highly valuable', zh: '极具价值' }
    },
    tags: ['dedication']
  },
  30: {
    id: '30',
        type: 'scale-question',
    textEn: 'How valuable is it for working mothers to share maternal experiences and emotional support?',
    textZh: '职场母亲分享育儿经验、提供情感支持有多大价值？',
        scaleLabels: {
      left: { en: 'Not valuable', zh: '毫无价值' },
      right: { en: 'Extremely beneficial', zh: '极其有益' }
    },
    tags: ['dedication']
  },
  31: {
    id: '31',
        type: 'scale-question',
    textEn: 'How valuable is medical advice from healthcare professionals for working mothers?',
    textZh: '外部医疗专业人士为职场母亲提供医学建议有多大价值？',
        scaleLabels: {
      left: { en: 'Not valuable', zh: '毫无价值' },
      right: { en: 'Extremely valuable', zh: '极具价值' }
    },
    tags: ['dedication']
  },
  32: {
    id: '32',
    type: 'scale-question',
    textEn: 'How valuable are visuospatial and logical training?',
    textZh: '视觉空间与逻辑训练有多大价值？',
    scaleLabels: {
      left: { en: 'Not valuable', zh: '毫无价值' },
      right: { en: 'Extremely valuable', zh: '极具价值' }
    },
    tags: ['objectivity']
  },
  33: {
    id: '33',
        type: 'scale-question',
    textEn: 'How engaging are self-customized kids\' avatars and tokens for interactions?',
    textZh: '促进互动的自定义儿童虚拟形象和代币有多大价值？',
        scaleLabels: {
      left: { en: 'Not engaging', zh: '毫无价值' },
      right: { en: 'Very engaging', zh: '极具价值' }
    },
    tags: ['socialIntelligence']
  },
  34: {
    id: '34',
        type: 'scale-question',
    textEn: 'How important is mentorship matching for mothers of the same industry?',
    textZh: '一个将业内母亲"导师匹配"的功能有多大价值？',
        scaleLabels: {
      left: { en: 'Not important', zh: '毫无价值' },
      right: { en: 'Extremely important', zh: '极具价值' }
    },
    tags: ['socialIntelligence']
  },
  35: {
    id: '35',
        type: 'scale-question',
    textEn: 'How valuable is a company-specific AI for working mothers?',
    textZh: '一个为每家公司定制的职场母亲专用人工智能模型有多大价值？',
        scaleLabels: {
      left: { en: 'Not valuable', zh: '毫无必要' },
      right: { en: 'Extremely helpful', zh: '极具价值' }
    },
    tags: ['dedication']
  },
  36:{
    id: '36',
    type: 'scale-question',
    textEn: 'How will AI support working parents in the next 5–10 years?',
    textZh: '未来5–10年内，人工智能在职场父母方面的角色？',
    scaleLabels: {
      left: { en: 'AI brings new challenges ahead', zh: '带来全新挑战' },
      right: { en: 'AI revolutionizes support for parents', zh: '革新对父母的支持' }
    },
    tags: ['objectivity']
  },
  37:{
    id: '37',
    type: 'scale-question',
    textEn: 'How will incorporating motherhood improve client relationships?',
    textZh: '母亲这一身份的加入如何改善客户关系？',
    scaleLabels: {
      left: { en: 'Not beneficial', zh: '毫无价值' },
      right: { en: 'Extremely beneficial', zh: '极具价值' }
    },
    tags: ['emotionalRegulation']
  },
  38: {
    id: '38',
        type: 'scale-question',
    textEn: 'Is a confidential child health-related record needed to verify mothers\' identity?',
    textZh: '是否需要一份与儿童健康相关的保密记录来核实母亲的身份？',
        scaleLabels: {
      left: { en: 'Strongly oppose – utterly invasive', zh: '强烈反对 – 违反隐私' },
      right: { en: 'Strongly support – ensures safety and trust', zh: '强烈支持 – 保障安全的基础' }
    },
    tags: ['objectivity']
  },
  39: {
    id: '39',
        type: 'scale-question',
    textEn: 'Does misuse by unintended users negatively affect trust?',
    textZh: '非目标用户滥用该平台是否会对信任度产生负面影响？',
        scaleLabels: {
      left: { en: 'Definitely no – no trust risk', zh: '绝对不 – 完全无风险' },
      right: { en: 'Definitely yes – severely undermines trust', zh: '绝对会 – 严重破坏信任' }
    }
  },
  40: {
    id: '40',
        type: 'scale-question',
    textEn: 'Should companies verify that this platform is for family members approved by working mothers?',
    textZh: '公司是否应核实该平台供职场母亲允许的家庭成员使用？',
        scaleLabels: {
      left: { en: 'Strongly oppose', zh: '强烈反对' },
      right: { en: 'Strongly support', zh: '强烈支持' }
    },
    tags: ['selfAwareness']
  },
  41: {
    id: '41',
        type: 'scale-question',
    textEn: 'How important are mothers\' empathy and selflessness in leadership?',
    textZh: '母亲的同理心与无私对领导力有多重要？',
        scaleLabels: {
      left: { en: 'Not important at all', zh: '完全不重要' },
      right: { en: 'Extremely important', zh: '极其重要' }
    },
    tags: ['socialIntelligence']
  },
  42: {
    id: '42',
        type: 'scale-question',
    textEn: 'How important are mothers\' resilience and perseverance in leadership?',
    textZh: '母亲的韧性和毅力对领导力有多重要？',
        scaleLabels: {
      left: { en: 'Not important at all', zh: '完全不重要' },
      right: { en: 'Extremely important', zh: '极其重要' }
    },
    tags: ['coreEndurance']
  },
  43: {
    id: '43',
        type: 'scale-question',
    textEn: 'How important are mothers\' communication and listening in leadership?',
    textZh: '母亲的沟通与倾听能力对领导力有多重要？',
        scaleLabels: {
      left: { en: 'Not important at all', zh: '完全不重要' },
      right: { en: 'Extremely important', zh: '极其重要' }
    },
    tags: ['socialIntelligence']
  },
  44: {
    id: '44',
        type: 'scale-question',
    textEn: 'How important are mothers\' responsibility and accountability in leadership?',
    textZh: '母亲的责任感和担当对工作有多重要？',
        scaleLabels: {
      left: { en: 'Not important at all', zh: '完全不重要' },
      right: { en: 'Extremely important', zh: '极其重要' }
    },
    tags: ['objectivity', 'dedication']
  },
  45: {
    id: '45',
        type: 'scale-question',
    textEn: 'Have you resolved challenges balancing leadership responsibilities with caregiving?',
    textZh: '您是否解决过平衡领导责任与照护他人之间的挑战？',
        scaleLabels: {
      left: { en: 'Never', zh: '从未' },
      right: { en: 'Yes, frequently', zh: '是的，经常' }
    },
    tags: ['objectivity', 'dedication']
  },
  46: {
    id: '46',
        type: 'scale-question',
    textEn: 'Has becoming a parent (or caregiver) influenced your leadership style?',
    textZh: '成为家长或照顾者对您的工作处事风格有多大影响？',
        scaleLabels: {
      left: { en: 'No influence', zh: '没有影响' },
      right: { en: 'Significantly changed it for the better', zh: '显著改善' }
    },
    tags: ['dedication']
  },
  47: {
    id: '47',
        type: 'scale-question',
    textEn: 'How does motherhood impact leadership effectiveness in the workplace?',
    textZh: '母亲身份如何影响职场中的领导效果？',
        scaleLabels: {
      left: { en: 'Negatively', zh: '负面影响' },
      right: { en: 'Positively', zh: '积极影响' }
    },
    tags: ['dedication']
  },
  48: {
    id: '48',
    type: 'scale-question',
    textEn: 'How does your company integrate mothers\' leadership qualities into its pipeline?',
    textZh: '您所在的公司如何在建设中融入母亲的领导力特质？',
    scaleLabels: {
      left: { en: 'Poorly', zh: '不太融入' },
      right: { en: 'Very well', zh: '非常融入' }
    },
    tags: ['dedication']
  },
  49: {
    id: '49',
    type: 'scale-question',
    textEn: 'How much do you pay attention to the emotional well-being of working mothers around you?',
    textZh: '您在多大程度上关注身边职场母亲的情绪状态？',
    scaleLabels: {
      left: { en: 'Not at all', zh: '完全不关注' },
      right: { en: 'Very much', zh: '非常关注' }
    },
    tags: ['socialIntelligence']
  },
  50: {
    id: '50',
    type: 'scale-question',
    textEn: 'Do you recognize when others experiences emotional difficulties?',
    textZh: '您是否能识别他人情绪方面的困难？',
    scaleLabels: {
      left: { en: 'Not equipped at all', zh: '完全不识别' },
      right: { en: 'Very equipped', zh: '非常识别' }
    },
    tags: ['emotionalRegulation', 'dedication']
  },
  51: {
    id: '51',
    type: 'scale-question',
    textEn: 'Does your mother\'s role influence your understanding of leadership in childhood?',
    textZh: '您的母亲是否影响了童年时期您对领导力的认知？',
    scaleLabels: {
      left: { en: 'Not at all', zh: '没有影响' },
      right: { en: 'Very strongly', zh: '非常深远' }
    },
    tags: ['selfAwareness']
  },
  52: {
    id: '52',
    type: 'searchable-dropdown',
    textEn: 'How many children do you have or are expecting to have?',
    textZh: '您有多少个孩子或即将拥有多少个孩子？',
    options: [
      { id: '1', textEn: '1', textZh: '1' },
      { id: '2', textEn: '2', textZh: '2' },
      { id: '3', textEn: '3', textZh: '3' },
      { id: '4', textEn: '4', textZh: '4' },
      { id: '5', textEn: '5', textZh: '5' },
      { id: '6', textEn: '6', textZh: '6' },
      { id: '7', textEn: '7', textZh: '7' },
      { id: '8', textEn: '8', textZh: '8' },
      { id: '9', textEn: '9', textZh: '9' },
      { id: '10', textEn: '10', textZh: '10' },
      { id: '10+', textEn: '10+', textZh: '10+' }
    ]
  },
  53: {
    id: '53',
        type: 'multiple-choice',
    textEn: 'During which weeks of your pregnancy did you experience noticeable morning sickness?',
    textZh: '在怀孕的哪些周数期间，您经历了明显的妊娠反应？',
        options: [
      { id: 'A', textEn: 'I did not experience noticeable morning sickness', textZh: '我没有经历明显的妊娠反应' },
      { id: 'B', textEn: 'Weeks 4–8', textZh: '第4至第8周' },
      { id: 'C', textEn: 'Weeks 9–12', textZh: '第9至第12周' },
      { id: 'D', textEn: 'Weeks 13–20', textZh: '第13至第20周' },
      { id: 'E', textEn: 'Weeks 21–28', textZh: '第21至第28周' },
      { id: 'F', textEn: 'Weeks 29–36', textZh: '第29至第36周' },
      { id: 'G', textEn: 'Weeks 37–40', textZh: '第37至第40周' },
      { id: 'H', textEn: 'I can\'t remember', textZh: '我记不清了' }
    ]
  },
  54: {
    id: '54',
    type: 'text-with-unit',
    textEn: 'What was your youngest child\'s birth weight?',
    textZh: '您第一胎宝宝的出生体重是多少？',
    options: [
      { id: 'kg', textEn: 'kg', textZh: '千克' },
      { id: 'lbs', textEn: 'lbs', textZh: '磅' }
    ]
  },
  55: {
    id: '55',
        type: 'multiple-choice',
    textEn: 'How long was your maternity leave?',
    textZh: '您的产假有多长时间？',
        options: [
      { id: 'A', textEn: '<8 weeks', textZh: '少于8周' },
      { id: 'B', textEn: '8–14 weeks', textZh: '8–14周' },
      { id: 'C', textEn: '15–26 weeks', textZh: '15–26周' },
      { id: 'D', textEn: '27–52 weeks', textZh: '27–52周' },
      { id: 'E', textEn: '1 year', textZh: '超过1年' }
    ]
  },
  56: {
    id: '56',
        type: 'multiple-choice',
    textEn: 'Did you receive postpartum care services?',
    textZh: '您是否接受了产后护理或入住了月子中心？',
        options: [
          { id: 'A', textEn: 'Yes', textZh: '是' },
          { id: 'B', textEn: 'No', textZh: '否' }
        ]
      },
  57: {
    id: '57',
    type: 'text-input',
    textEn: 'Postpartum emotion in one word',
    textZh: '一个词形容您的产后状态'
  },
  58: {
    id: '58',
    type: 'text-input',
    textEn: 'Motherhood experience in one word',
    textZh: '一个词形容您作为母亲的状态'
  },
  59: {
    id: '59',
    type: 'scale-question',
    textEn: 'How involved are you with your previous social life from work?',
    textZh: '自己与以往工作的社交联系程度如何？',
    scaleLabels: {
      left: { en: 'Not involved at all', zh: '完全无参与' },
      right: { en: 'Very involved', zh: '非常投入' }
    },
    tags: ['socialIntelligence']
  },
  60: {
    id: '60',
    type: 'scale-question',
    textEn: 'How well does your work arrangement support your needs?',
    textZh: '您的工作安排对您有多大支持作用？',
    scaleLabels: {
      left: { en: 'Not supportive at all', zh: '完全不支持' },
      right: { en: 'Extremely supportive', zh: '非常支持' }
    }
  },
  61: {
    id: '61',
    type: 'scale-question',
    textEn: 'How connected are you to your professional identity?',
    textZh: '您对自己的职业身份感有多强？',
    scaleLabels: {
      left: { en: 'Not connected – motherhood is full priority', zh: '完全不强 – 母亲角色优先' },
      right: { en: 'Very connected – profession is important', zh: '非常强 – 职业身份很重要' }
    },
    tags: ['selfAwareness']
  },
  62: {
    id: '62',
        type: 'scale-question',
    textEn: 'How has motherhood impacted your career progression?',
    textZh: '母亲身份对您的职业发展或晋升机会有何影响？',
        scaleLabels: {
      left: { en: 'Very negative', zh: '非常负面' },
      right: { en: 'Very positive', zh: '非常积极' }
    }
  },
  63: {
    id: '63',
    type: 'scale-question',
    textEn: 'How is your work-life balance supported by your company?',
    textZh: '您的工作与生活平衡如何被贵司支持？',
    scaleLabels: {
      left: { en: 'Not capable of being supported', zh: '完全不能被支持' },
      right: { en: 'Extremely supported', zh: '非常能被支持' }
    },
    tags: ['selfAwareness']
  },
  64: {
    id: '64',
    type: 'scale-question',
    textEn: 'How has motherhood influenced your leadership style?',
    textZh: '母亲身份如何影响您的领导风格？',
    scaleLabels: {
      left: { en: 'Very negative', zh: '非常负面' },
      right: { en: 'Very positive', zh: '非常积极' }
    },
    tags: ['emotionalRegulation']
  },
  65: {
    id: '65',
    type: 'scale-question',
    textEn: 'How has motherhood influenced your resilience against stress?',
    textZh: '母亲身份如何影响您的抗压能力？',
    scaleLabels: {
      left: { en: 'Much less', zh: '抗压能力减弱' },
      right: { en: 'Much more', zh: '抗压能力增强' }
    },
    tags: ['emotionalRegulation']
  },
  66: {
    id: '66',
    type: 'scale-question',
    textEn: 'How motivated do you feel to pursue career growth?',
    textZh: '您职业发展动力有多强？',
    scaleLabels: {
      left: { en: 'Not motivated at all', zh: '完全没有' },
      right: { en: 'Very motivated', zh: '非常强' }
    },
    tags: ['coreEndurance']
  },
  67: {
    id: '67',
    type: 'scale-question',
    textEn: 'How satisfied are you with your work-life balance?',
    textZh: '您对您的工作与生活平衡是否满意？',
    scaleLabels: {
      left: { en: 'Very disatisfied', zh: '非常不满意' },
      right: { en: 'Very satisfied', zh: '非常满意' }
    },
    tags: ['selfAwareness']
  },
  68: {
    id: '68',
    type: 'scale-question',
    textEn: 'Are your needs as a mother taken into account duirng workplace decisions?',
    textZh: '您作为母亲的需求是否在职场决策中被考虑到？',
    scaleLabels: {
      left: { en: 'Never', zh: '从不' },
      right: { en: 'Always', zh: '总是' }
    },
    tags: ['selfAwareness']
  },
  69: {
    id: '69',
    type: 'scale-question',
    textEn: 'How connected do you feel with other mothers through your work?',
    textZh: '您在工作中与其他母亲的联系如何？',
    scaleLabels: {
      left: { en: 'Very disconnected', zh: '非常弱' },
      right: { en: 'Very connected', zh: '非常强' }
    },
    tags: ['socialIntelligence']
  },
  70: {
    id: '70',
    type: 'scale-question',
    textEn: 'Do you want to connect with other mothers through your profession?',
    textZh: '您是否想与其他职场母亲建立联系？',
    scaleLabels: {
      left: { en: 'Never', zh: '从不' },
      right: { en: 'Always', zh: '总是' }
    },
    tags: ['socialIntelligence']
  },
  71: {
    id: '71',
    type: 'scale-question',
    textEn: 'How valuable is showcasing your previous work?',
    textZh: '展示您以往的工作经历对您来说有多重要？',
    scaleLabels: {
      left: { en: 'Not valuable at all', zh: '毫无价值' },
      right: { en: 'Extremely valuable', zh: '极具价值' }
    },
    tags: ['selfAwareness']
  }, 
  72: {
    id: '72',
    type: 'scale-question',
    textEn: 'How helpful is cognitive ability to enhance your problem-solving abilities? ',
    textZh: '抽象逻辑能力对提升您解决问题的能力有多大帮助？',
    scaleLabels: {
      left: { en: 'Not helpful at all', zh: '毫无帮助' },
      right: { en: 'Extremely helpful', zh: '极具帮助' }
    },
    tags: ['objectivity']
  },
  73: {
    id: '73',
    type: 'scale-question',
    textEn: 'Are you prepared for motherhood beforehand?',
    textZh: '您成为母亲前心理准备如何？',
    scaleLabels: {
      left: { en: 'Not prepared at all', zh: '完全没有准备' },
      right: { en: 'Very prepared', zh: '非常充分' }
    },
    tags: ['coreEndurance']
  },
  74: {
    id: '74',
    type: 'scale-question',
    textEn: 'Did motherhood change your personal values?',
    textZh: '母亲身份是否改变了个人价值？',
    scaleLabels: {
      left: { en: 'A) Completely', zh: '完全改变' },
      right: { en: 'E) No change', zh: '没有改变' }
    },
    tags: ['selfAwareness']
  },
  75: {
    id: '75',
    type: 'scale-question',
    textEn: 'Does your family or community support you in motherhood?',
    textZh: '在成为母亲的过程中，家人或社群对您支持吗？',
    scaleLabels: {
      left: { en: 'A) Not supported at all', zh: '完全没有支持' },
      right: { en: 'E) Extremely supported', zh: '非常支持' }
    },
    tags: ['socialIntelligence']
  },
  76: {
    id: '76',
    type: 'scale-question',
    textEn: 'Did motherhood bring emotional fulfillment to your life?',
    textZh: '母亲身份是否为您带来了情感满足？',
    scaleLabels: {
      left: { en: 'A) No emotion at all', zh: '完全没有支持' },
      right: { en: 'E) Extremely fulfilling', zh: '非常满足' }
    },
    tags: ['dedication']
  },
  77: {
    id: '77',
    type: 'scale-question',
    textEn: 'Did motherhood make you more emotionally strong?',
    textZh: '母亲身份让你情绪上更坚韧了吗？',
    scaleLabels: {
      left: { en: 'A) Much weaker', zh: '明显减弱' },
      right: { en: 'E) Much stronger', zh: '显著增强' }
    },
    tags: ['emotionalRegulation']
  },
  78: {
    id: '78',
    type: 'scale-question',
    textEn: 'Did motherhood change your ability to set boundaries?',
    textZh: '母亲身份是否影响了您设定边界的能力？',
    scaleLabels: {
      left: { en: 'A) Significantly weakened', zh: '显著减弱' },
      right: { en: 'E) Improved greatly', zh: '显著提升' }
    },
    tags: ['selfAwareness']
  },
  79: {
    id: '79',
    type: 'scale-question',
    textEn: 'Do you feel pressured to meet external expectations of motherhood?',
    textZh: '您是否感受到外界对母亲身份的期待压力？',
    scaleLabels: {
      left: { en: 'A) Always', zh: '总是' },
      right: { en: 'E) Never', zh: '从不' }
    },
    tags: ['selfAwareness']
  },
  80: {
    id: '80',
    type: 'scale-question',
    textEn: 'Are you satisfied with the balance between mother and self?',
    textZh: '您对母亲身份与自我之间的平衡是否满意？',
    scaleLabels: {
      left: { en: 'A) Very dissatisfied', zh: '非常不满意' },
      right: { en: 'E) Very satisfied', zh: '非常满意' }
    },
    tags: ['selfAwareness']
  },
  81: {
    id: '81',
    type: 'scale-question',
    textEn: 'Does your company foster professional growth and well-being?',
    textZh: '贵司是否同时重视职业发展和身心健康？',
    scaleLabels: {
      left: { en: 'A) Not supportive at all', zh: '完全不重视' },
      right: { en: 'E) Very supportive', zh: '非常重视' }
    },
    tags: ['selfAwareness']
  },
  82: {
    id: '82',
    type: 'scale-question',
    textEn: 'Do you build meaningful relationships through work?',
    textZh: '您在工作中是否有建立有意义的关系的机会？',
    scaleLabels: {
      left: { en: 'A) None – mostly isolated interactions', zh: '没有 – 多为孤立互动' },
      right: { en: 'E) A lot – strong connections', zh: '很多 – 多为良好关系' }
    }
  },
  83: {
    id: '83',
    type: 'scale-question',
    textEn: 'Do you experience acts of kindness in work?',
    textZh: '您在工作中是否感受到他人的善意之举？',
    scaleLabels: {
      left: { en: 'A) Never', zh: '从未' },
      right: { en: 'E) Very frequently', zh: '非常频繁' }
    },
    tags: ['dedication']
  },
  84: {
    id: '84',
    type: 'scale-question',
    textEn: 'Do you support or care for colleagues?',
    textZh: '您是否会给予同事支持或关心？',
    scaleLabels: {
      left: { en: 'A) Do not engage in offering support', zh: '基本不提供支持' },
      right: { en: 'E) Frequently offer support', zh: '经常主动给予支持' }
    },
    tags: ['dedication']
  },
  85: {
    id: '85',
    type: 'scale-question',
    textEn: 'Do you feel recognized and valued by your team?',
    textZh: '您是否在团队中感觉到被认可？',
    scaleLabels: {
      left: { en: 'A) Never', zh: '几乎从未被认可' },
      right: { en: 'E) Always', zh: '总是被认可' }
    },
    tags: ['selfAwareness']
  },
  86: {
    id: '86',
    type: 'scale-question',
    textEn: 'Does your company promote collaboration based on trust and respect?',
    textZh: '贵司是否鼓励基于信任与相互尊重的合作？',
    scaleLabels: {
      left: { en: 'A) Does not at all', zh: '几乎没有' },
      right: { en: 'E) Strongly across all levels', zh: '在所有层面都出色' }
    },
    tags: ['objectivity', 'dedication']
  },
  87: {
    id: '87',
    type: 'scale-question',
    textEn: 'Could you reach out to colleagues or managers when facing challenges?',
    textZh: '面对困难或需要帮助时，您能否与同事或上级沟通？',
    scaleLabels: {
      left: { en: 'A) Very uncomfortable', zh: '很不愿意' },
      right: { en: 'E) Very comfortable', zh: '非常自然' }
    },
    tags: ['emotionalRegulation', 'socialIntelligence']
  },
  88: {
    id: '88',
    type: 'scale-question',
    textEn: 'Is a people-centered work culture important?',
    textZh: '以人为本的企业文化是否重要？',
    scaleLabels: {
      left: { en: 'A) Not important at all', zh: '几乎不重要' },
      right: { en: 'E) Extremely important', zh: '非常重要' }
    },
    tags: ['socialIntelligence']
  },
  89: {
    id: '89',
    type: 'scale-question',
    textEn: 'Do you feel motivated by a sense of belonging or team care?',
    textZh: '您是否因团队归属感或同事关怀提升工作积极性？',
    scaleLabels: {
      left: { en: 'A) Never', zh: '从未' },
      right: { en: 'E) Very often', zh: '经常' }
    },
    tags: ['emotionalRegulation']
  },
};

export const questionnaireConfigs: Record<QuestionnaireType, QuestionnaireConfig> = {
  mother: {
    type: 'mother',
    title: { en: 'Mother Questionnaire', zh: '母亲问卷' },
    questionIds: [
      2,   // mother 1
      3,   // mother 2
      4,   // mother 3
      5,   // mother 4
      52,  // mother 5
      53,  // mother 6
      54,  // mother 7
      55,  // mother 8
      56,  // mother 9
      57,  // mother 10
      58,  // mother 11
      // Section I. About Work-Life Balance (if yes to mother 3) / About Life Balance (if no to mother 3)
      59,  // mother 12
      60,  // mother 13
      61,  // mother 14
      62,  // mother 15
      63,  // mother 16
      68,  // mother 17
      64,  // mother 18
      65,  // mother 19
      66,  // mother 20
      69,  // mother 21
      70,  // mother 22
      25,  // mother 23
      // Section II. About Us, CHON
      26,  // mother 24
      27,  // mother 25
      71,  // mother 26
      29,  // mother 27
      28,  // mother 28
      31,  // mother 29
      30,  // mother 30
      32,  // mother 31
      72,  // mother 32
      33,  // mother 33
      35,  // mother 34
      38,  // mother 35
      39,  // mother 36
      40,  // mother 37
      // Section III. About Motherhood
      41,  // mother 38
      42,  // mother 39
      43,  // mother 40
      44,  // mother 41
      73,  // mother 42
      74,  // mother 43
      75,  // mother 44
      76,  // mother 45
      77,  // mother 46
      78,  // mother 47
      79,  // mother 48
      80,  // mother 49
      51   // mother 50
    ],
    sections: [
      {
        title: { en: 'Demographics & Background', zh: '人口统计与背景' },
        startIndex: 0,
        endIndex: 10
      },
      {
        title: { en: 'About Work-Life Balance', zh: '关于工作与生活平衡' },
        startIndex: 11,
        endIndex: 22
      },
      {
        title: { en: 'About Us, CHON', zh: '关于我们，CHON' },
        startIndex: 23,
        endIndex: 36
      },
      {
        title: { en: 'About Motherhood', zh: '关于母亲身份' },
        startIndex: 37,
        endIndex: 49
      }
    ],
    questionModifications: {
      // Note: Questions 28 and 29 have conditional text based on question 4 answer
      // If question 4 (mother 3 - corporate experience) is "No":
      //   Q28: 'How valuable are you staying updated with interested fields?' / '您了解感兴趣领域有多大价值？'
      //   Q29: 'How valuable are you sharing your life and accessing new opportunities?' / '您分享生活和了解新机会有多大价值？'
      // If question 4 is "Yes", use the default modifications below
      28: {
        textEn: 'How valuable is it for you to stay updated with your professional field?',
        textZh: '您了解行业领域信息有多大价值？'
      },
      29: {
        textEn: 'How valuable is it for you to post and access new business deals?',
        textZh: '您发布和获取商业合作有多大价值？'
      },
      30: {
        textEn: 'How valuable is it for you to share maternal experiences and emotional support?',
        textZh: '您分享育儿经验、提供情感支持有多大价值？'
      },
      31: {
        textEn: 'How valuable is medical advice from healthcare professionals for you?',
        textZh: '外部医疗专业人士为您提供医学建议有多大价值？'
      },
      35: {
        textEn: 'How valuable is a company-specific AI for you?',
        textZh: '一个为每家公司定制的您专用人工智能模型有多大价值？'
      },
      40: {
        textEn: 'Should companies verify that this platform is for family members approved by you?',
        textZh: '公司是否应核实该平台供您允许的家庭成员使用？'
      }
    },
    conditionalModifications: {
      28: [
        {
          condition: {
            questionId: 4,
            answer: 'B' // No corporate experience
          },
          modifications: {
            textEn: 'How valuable are you staying updated with interested fields?',
            textZh: '您了解感兴趣领域有多大价值？'
          }
        }
      ],
      29: [
        {
          condition: {
            questionId: 4,
            answer: 'B' // No corporate experience
          },
          modifications: {
            textEn: 'How valuable are you sharing your life and accessing new opportunities?',
            textZh: '您分享生活和了解新机会有多大价值？'
          }
        }
      ],
      59: [
        {
          condition: {
            questionId: 4,
            answer: 'B' // No corporate experience
          },
          modifications: {
            textEn: 'How involved are you with your previous social life?',
            textZh: '自己与以往的社交联系程度如何？'
          }
        }
      ],
      60: [
        {
          condition: {
            questionId: 4,
            answer: 'B' // No corporate experience
          },
          modifications: {
            textEn: 'How well does your life arrangement support your needs?',
            textZh: '您的生活安排对您有多大支持作用？'
          }
        }
      ],
      61: [
        {
          condition: {
            questionId: 4,
            answer: 'B' // No corporate experience
          },
          modifications: {
            textEn: 'How connected are you to your personal identity?',
            textZh: '您对自己的个人身份感有多强？'
          }
        }
      ],
      62: [
        {
          condition: {
            questionId: 4,
            answer: 'B' // No corporate experience
          },
          modifications: {
            textEn: 'How has motherhood impacted your personal development?',
            textZh: '母亲身份对您的个人发展有何影响？'
          }
        }
      ],
      63: [
        {
          condition: {
            questionId: 4,
            answer: 'B' // No corporate experience
          },
          modifications: {
            textEn: 'How is your life balance supported by your community?',
            textZh: '您的生活平衡如何被社区支持？'
          }
        }
      ],
      66: [
        {
          condition: {
            questionId: 4,
            answer: 'B' // No corporate experience
          },
          modifications: {
            textEn: 'How motivated do you feel to pursue personal growth?',
            textZh: '您个人发展的动力有多强？'
          }
        }
      ],
      67: [
        {
          condition: {
            questionId: 4,
            answer: 'B' // No corporate experience
          },
          modifications: {
            textEn: 'How satisfied are you with your life balance?',
            textZh: '您对您的生活平衡满意吗？'
          }
        }
      ],
      68: [
        {
          condition: {
            questionId: 4,
            answer: 'B' // No corporate experience
          },
          modifications: {
            textEn: 'Are your needs as a mother taken into account during community decisions?',
            textZh: '您作为母亲的需求是否在社区决策中被考虑到？'
          }
        }
      ],
      69: [
        {
          condition: {
            questionId: 4,
            answer: 'B' // No corporate experience
          },
          modifications: {
            textEn: 'How connected do you feel with other mothers through your life?',
            textZh: '您在生活中与其他母亲的联系如何？'
          }
        }
      ],
      70: [
        {
          condition: {
            questionId: 4,
            answer: 'B' // No corporate experience
          },
          modifications: {
            textEn: 'Do you want to connect with other mothers through your lifestyle?',
            textZh: '您是否想在生活中与其他母亲建立联系？'
          }
        }
      ]
    },
    totalQuestions: 50
  },
  corporate: {
    type: 'corporate',
    title: { en: 'Corporate Manager Questionnaire', zh: '企业管理者问卷' },
    questionIds: [
      6,   // corporate manager 1
      1,   // corporate manager 2
      2,   // corporate manager 3
      3,   // corporate manager 4
      5,   // corporate manager 5
      7,   // corporate manager 6
      8,   // corporate manager 7
      9,   // corporate manager 8
      10,  // corporate manager 9
      11,  // corporate manager 10
      // Section I. About Your Leadership
      12,  // corporate manager 11
      13,  // corporate manager 12
      14,  // corporate manager 13
      15,  // corporate manager 14
      16,  // corporate manager 15
      17,  // corporate manager 16
      18,  // corporate manager 17
      19,  // corporate manager 18
      20,  // corporate manager 19
      21,  // corporate manager 20
      22,  // corporate manager 21
      23,  // corporate manager 22
      24,  // corporate manager 23
      25,  // corporate manager 24
      // Section II. About Us, CHON
      26,  // corporate manager 25
      27,  // corporate manager 26
      28,  // corporate manager 27
      29,  // corporate manager 28
      30,  // corporate manager 29
      31,  // corporate manager 30
      32,  // corporate manager 31
      33,  // corporate manager 32
      34,  // corporate manager 33
      35,  // corporate manager 34
      36,  // corporate manager 35
      37,  // corporate manager 36
      38,  // corporate manager 37
      39,  // corporate manager 38
      40,  // corporate manager 39
      // Section III. About Motherhood
      41,  // corporate manager 40
      42,  // corporate manager 41
      43,  // corporate manager 42
      44,  // corporate manager 43
      45,  // corporate manager 44
      46,  // corporate manager 45
      47,  // corporate manager 46
      48,  // corporate manager 47
      49,  // corporate manager 48
      50,  // corporate manager 49
      51   // corporate manager 50
    ],
    sections: [
      {
        title: { en: 'Demographics & Professional Background', zh: '人口统计与职业背景' },
        startIndex: 0,
        endIndex: 9
      },
      {
        title: { en: 'About Your Leadership', zh: '关于您的领导力' },
        startIndex: 10,
        endIndex: 23
      },
      {
        title: { en: 'About Us, CHON', zh: '关于我们，CHON' },
        startIndex: 24,
        endIndex: 38
      },
      {
        title: { en: 'About Motherhood', zh: '关于母亲身份' },
        startIndex: 39,
        endIndex: 49
      }
    ],
    questionModifications: {},
    totalQuestions: 50
  },
  other: {
    type: 'other',
    title: { en: 'General Questionnaire', zh: '通用问卷' },
    questionIds: [
      1,   // others 1
      2,   // others 2
      3,   // others 3
      4,   // others 4
      5,   // others 5
      // Section I. About Professional Work (if yes to others 3) / About Teamwork (if no to others 3)
      81,  // others 6
      82,  // others 7
      20,  // others 8
      83,  // others 9
      84,  // others 10
      85,  // others 11
      86,  // others 12
      87,  // others 13
      88,  // others 14
      89,  // others 15
      24,  // others 16
      // Section II. About Us, CHON
      26,  // others 17
      27,  // others 18
      28,  // others 19
      29,  // others 20
      30,  // others 21
      31,  // others 22
      32,  // others 23
      33,  // others 24
      34,  // others 25
      35,  // others 26
      36,  // others 27
      37,  // others 28
      38,  // others 29
      39,  // others 30
      40,  // others 31
      // Section III. About Motherhood
      41,  // others 32
      42,  // others 33
      43,  // others 34
      44,  // others 35
      45,  // others 36
      46,  // others 37
      47,  // others 38
      48,  // others 39
      49,  // others 40
      50,  // others 41
      51   // others 42
    ],
    sections: [
      {
        title: { en: 'Demographics & Background', zh: '人口统计与背景' },
        startIndex: 0,
        endIndex: 4
      },
      {
        title: { en: 'About Professional Work & Teamwork', zh: '关于专业工作与团队合作' },
        startIndex: 5,
        endIndex: 15
      },
      {
        title: { en: 'About Us, CHON', zh: '关于我们，CHON' },
        startIndex: 16,
        endIndex: 30
      },
      {
        title: { en: 'About Motherhood', zh: '关于母亲身份' },
        startIndex: 31,
        endIndex: 41
      }
    ],
    questionModifications: {},
    totalQuestions: 42
  },
  both: {
    type: 'both',
    title: { en: 'Mother + Corporate Manager Questionnaire', zh: '母亲+企业管理者问卷' },
    questionIds: [
      6,   // both 1
      2,   // both 2
      3,   // both 3
      5,   // both 4
      52,  // both 5
      53,  // both 6
      54,  // both 7
      55,  // both 8
      56,  // both 9
      57,  // both 10
      58,  // both 11
      5,   // both 12
      7,   // both 13
      8,   // both 14
      9,   // both 15
      10,  // both 16
      11,  // both 17
      // Section I. About Your Leadership
      12,  // both 18
      13,  // both 19
      14,  // both 20
      15,  // both 21
      16,  // both 22
      17,  // both 23
      18,  // both 24
      19,  // both 25
      20,  // both 26
      21,  // both 27
      22,  // both 28
      23,  // both 29
      24,  // both 30
      25,  // both 31
      // Section II. About Work-Life Balance
      59,  // both 32
      60,  // both 33
      61,  // both 34
      62,  // both 35
      63,  // both 36
      68,  // both 37
      64,  // both 38
      65,  // both 39
      66,  // both 40
      69,  // both 41
      70,  // both 42
      // Section III. About Us, CHON
      26,  // both 43
      27,  // both 44
      71,  // both 45
      29,  // both 46
      28,  // both 47
      31,  // both 48
      30,  // both 49
      32,  // both 50
      72,  // both 51
      33,  // both 52
      35,  // both 53
      38,  // both 54
      39,  // both 55
      40,  // both 56
      // Section IV. About Motherhood
      41,  // both 57
      42,  // both 58
      43,  // both 59
      44,  // both 60
      73,  // both 61
      74,  // both 62
      75,  // both 63
      76,  // both 64
      77,  // both 65
      78,  // both 66
      79,  // both 67
      80,  // both 68
      51   // both 69
    ],
    sections: [
      {
        title: { en: 'Demographics & Background', zh: '人口统计与背景' },
        startIndex: 0,
        endIndex: 16
      },
      {
        title: { en: 'About Your Leadership', zh: '关于您的领导力' },
        startIndex: 17,
        endIndex: 30
      },
      {
        title: { en: 'About Work-Life Balance', zh: '关于工作与生活平衡' },
        startIndex: 31,
        endIndex: 41
      },
      {
        title: { en: 'About Us, CHON', zh: '关于我们，CHON' },
        startIndex: 42,
        endIndex: 55
      },
      {
        title: { en: 'About Motherhood', zh: '关于母亲身份' },
        startIndex: 56,
        endIndex: 68
      }
    ],
    questionModifications: {
      28: {
        textEn: 'How valuable is it for you to stay updated with your professional field?',
        textZh: '您了解行业领域信息有多大价值？'
      },
      29: {
        textEn: 'How valuable is it for you to post and access new business deals?',
        textZh: '您发布和获取商业合作有多大价值？'
      },
      30: {
        textEn: 'How valuable is it for you to share maternal experiences and emotional support?',
        textZh: '您分享育儿经验、提供情感支持有多大价值？'
      },
      31: {
        textEn: 'How valuable is medical advice from healthcare professionals for you?',
        textZh: '外部医疗专业人士为您提供医学建议有多大价值？'
      },
      35: {
        textEn: 'How valuable is a company-specific AI for you?',
        textZh: '一个为每家公司定制的您专用人工智能模型有多大价值？'
      },
      40: {
        textEn: 'Should companies verify that this platform is for family members approved by you?',
        textZh: '公司是否应核实该平台供您允许的家庭成员使用？'
      }
    },
    totalQuestions: 69
  }
};

export const getQuestionnaire = (type: QuestionnaireType): QuestionnaireContext => {
  const config = questionnaireConfigs[type];
  const questions: Question[] = config.questionIds.map((questionId, index) => {
    const baseQuestion = unifiedQuestions[questionId];
    if (!baseQuestion) {
      throw new Error(`Question ID ${questionId} not found in unified questions`);
    }
    
    // Create a copy of the question with local ID
    const question: Question = {
      ...baseQuestion,
      id: `${type}_${index + 1}`, // Local questionnaire ID
      unifiedId: questionId // Keep track of unified question ID for conditional logic
    };
    
    // Apply modifications if they exist
    const modifications = config.questionModifications?.[questionId];
    if (modifications) {
      if (modifications.textEn) question.textEn = modifications.textEn;
      if (modifications.textZh) question.textZh = modifications.textZh;
    }
    
    return question;
  });

  return {
    type: config.type,
    title: config.title,
    questions,
      privacyStatement: {
      titleEn: 'Data Usage and Privacy Statement',
      titleZh: '数据使用与隐私声明',
      contentEn: '<strong style="font-size: 1.2em;">Data Usage and Privacy Statement</strong><br><br>At CHON, your privacy is fundamental. We only collect the information necessary to deliver meaningful insights, and we protect it with the highest standards of security and integrity.<br><br><hr><br><br><strong style="font-size: 1.2em;">For Individual Participants</strong><br><br>Your personal information will be used solely for the following purposes:<br><ul><li>To verify your eligibility for specific sections of the survey</li><li>To support demographic and statistical analysis across participant groups</li><li>To generate your personalized CHON personality profile</li></ul>',
      contentZh: '<strong style="font-size: 1.2em;">数据使用与隐私声明</strong><br><br>在 CHON，我们将您的隐私视为基本原则。我们仅收集实现分析目的所必需的信息，并以最高标准保障数据的安全与完整性。<br><br><hr><br><br><strong style="font-size: 1.2em;">针对个人参与者</strong><br><br>您的个人信息将仅用于以下用途：<br><ul><li>验证您是否符合特定问卷部分的参与资格</li><li>用于不同人群的统计与人口特征分析</li><li>生成您的个性化 CHON 性格分析报告</li></ul>'
    },
    totalQuestions: config.totalQuestions
  };
};

export const questionnaires: Record<QuestionnaireType, QuestionnaireContext> = {
  mother: getQuestionnaire('mother'),
  corporate: getQuestionnaire('corporate'),
  other: getQuestionnaire('other'),
  both: getQuestionnaire('both')
  };