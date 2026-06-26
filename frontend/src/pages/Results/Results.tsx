import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import type { TagStats } from '../../utils/tagUtils';
import {
  buildCharacterMatchRowsFromSorted,
  buildFinalScoresForMatching,
  CHARACTER_MATCH_SORT_INPUT,
  normalizeTagStatsForMatching,
  sortCharactersForPersistence
} from '../../utils/characterMatchRows';
import userSessionApi from '../../api/userSession';
import { questionnaires, type QuestionnaireType } from '../PersonalityTest/questionnaires';
import odinImage from '../../assets/characters/odin.jpg';
import wukongImage from '../../assets/characters/wukong.jpg';
import prometheusImage from '../../assets/characters/prometheus.jpg';
import nuwaImage from '../../assets/characters/nuwa.jpg';
import athenaImage from '../../assets/characters/athena.jpg';
import venusImage from '../../assets/characters/venus.jpg';
import './Results.css';

type ResultsLocationState = {
  resultsBootstrap?: {
    tagStats: Record<string, TagStats>;
    q25Letter: string;
  };
};

interface LegendComment {
  id: string;
  author: string;
  text: string;
}

const legendStorageKey = (characterEn: string) => `chon_legend_comments_${characterEn}`;

const loadLegendComments = (characterEn: string): LegendComment[] => {
  try {
    const raw = localStorage.getItem(legendStorageKey(characterEn));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LegendComment[]) : [];
  } catch (e) {
    console.error('Error parsing legend comments:', e);
    return [];
  }
};

interface CardData {
  id: string;
  name: {
    en: string;
    zh: string;
  };
  title: {
    en: string;
    zh: string;
  };
  description: {
    en: string[];
    zh: string[];
  };
  mythology: {
    en: string;
    zh: string;
  };
  tagRanges: {
    selfAwareness: [number, number]; // 自我意识
    dedication: [number, number]; // 奉献精神
    socialIntelligence: [number, number]; // 社交情商
    emotionalRegulation: [number, number]; // 情绪调节
    objectivity: [number, number]; // 客观能力
    coreEndurance: [number, number]; // 核心耐力
  };
  image: string;
}

// 首先定义一个类型来更好地处理标签翻译
interface TagTranslations {
  en: string;
  zh: string;
}

// 修改SVG六边形图表组件
const HexagonChart: React.FC<{
  scores: Record<string, number>,
  labels: Record<string, TagTranslations>,
  language: string,
  animationKey?: number, // 添加动画重置键
  characterRanges?: Record<string, [number, number]> // 添加角色分数范围
}> = ({ scores, labels, language, animationKey, characterRanges }) => {
  // 六边形的6个顶点 - 调整起始角度为30度，使顶点而非边在正上方
  const getHexagonPoints = (center: [number, number], size: number) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      // 从30度开始，每隔60度一个顶点
      const angle = (Math.PI / 6) + (Math.PI / 3 * i);
      const x = center[0] + size * Math.cos(angle);
      const y = center[1] + size * Math.sin(angle);
      points.push([x, y]);
    }
    return points;
  };

  // 定义标准六个指标的顺序，确保数据一致性
  const tagKeys = ['selfAwareness', 'dedication', 'socialIntelligence', 'emotionalRegulation', 'objectivity', 'coreEndurance'];

  // 根据分数计算多边形顶点
  const getScorePoints = (center: [number, number], size: number, scores: Record<string, number>) => {
    const points = [];
    
    for (let i = 0; i < 6; i++) {
      const tag = tagKeys[i];
      const score = scores[tag] || 0;
      const scaledSize = (size * score) / 100;
      // 从30度开始，每隔60度一个顶点
      const angle = (Math.PI / 6) + (Math.PI / 3 * i);
      const x = center[0] + scaledSize * Math.cos(angle);
      const y = center[1] + scaledSize * Math.sin(angle);
      points.push([x, y]);
    }
    return points;
  };

  // 获取标签位置的函数 - 优化定位
  const getTagPosition = (center: [number, number], size: number, tagIndex: number) => {
    // 从30度开始，每隔60度一个顶点
    const angle = (Math.PI / 6) + (Math.PI / 3 * tagIndex);
    // 为外部标签增加额外距离
    const distance = size + 30;
    
    // 计算标签坐标
    const x = center[0] + distance * Math.cos(angle);
    const y = center[1] + distance * Math.sin(angle);
    
    return { 
      key: tagKeys[tagIndex], 
      labelX: x, 
      labelY: y, 
      angle: angle * (180 / Math.PI) // 转换为角度
    };
  };

  // 获取分数标签的位置 - 响应式调整
  const getScorePosition = (center: [number, number], size: number, tagIndex: number, score: number) => {
    // 从30度开始，每隔60度一个顶点
    const angle = (Math.PI / 6) + (Math.PI / 3 * tagIndex);
    
    // 计算分数位置 - 在数据点和中心点之间
    const scaledSize = (size * score) / 100 * 0.7; // 略微靠近中心点，用0.7比例
    
    const x = center[0] + scaledSize * Math.cos(angle);
    const y = center[1] + scaledSize * Math.sin(angle);
    
    return { x, y };
  };

  // 生成同心六边形的点（创建刻度线）
  const generateConcentric = (center: [number, number], maxSize: number, count: number = 4) => {
    const polygons = [];
    for (let i = 1; i <= count; i++) {
      const size = maxSize * (i / count);
      const points = getHexagonPoints(center, size);
      polygons.push(points.map(point => point.join(',')).join(' '));
    }
    return polygons;
  };

  const [animated, setAnimated] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // 使用useEffect监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // 使用useEffect监听animationKey变化，重置动画状态
  useEffect(() => {
    setAnimated(false);
    const timer = setTimeout(() => {
      setAnimated(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [animationKey]); // 依赖于animationKey
  
  const center: [number, number] = [200, 200]; // 中心点坐标
  const size = 160; // 六边形尺寸
  
  // 获取外部六边形坐标
  const outerPoints = getHexagonPoints(center, size);
  const outerPolygon = outerPoints.map(point => point.join(',')).join(' ');
  
  // 生成同心六边形（刻度线）
  const concentricPolygons = generateConcentric(center, size);
  
  // 获取分数多边形
  const scorePoints = getScorePoints(center, size, scores);
  const scorePolygon = scorePoints.map(point => point.join(',')).join(' ');
  
  // 为每个位置增加标签和分数位置
  const tagPositions = [];
  for (let i = 0; i < 6; i++) {
    const pos = getTagPosition(center, size, i);
    const tagKey = tagKeys[i];
    const score = scores[tagKey] || 0;
    const scorePos = getScorePosition(center, size, i, score);
    
    tagPositions.push({
      ...pos,
      score,
      scoreX: scorePos.x,
      scoreY: scorePos.y
    });
  }

  // 添加刻度值 - 调整位置以匹配新的角度
  const scaleValues = ["0", "25", "50", "75", "100"];
  
  // 根据屏幕尺寸调整分数气泡和标签的大小
  const getBubbleSize = () => {
    if (windowWidth <= 380) return 16;
    if (windowWidth <= 480) return 17;
    if (windowWidth <= 768) return 18;
    return 18;
  };
  
  const getScoreFontSize = () => {
    if (windowWidth <= 380) return 10;
    if (windowWidth <= 480) return 11;
    if (windowWidth <= 768) return 11;
    return 12;
  };
  
  const getLabelWidth = () => {
    if (windowWidth <= 380) return 100;
    if (windowWidth <= 480) return 110;
    if (windowWidth <= 768) return 120;
    return 130;
  };

  return (
    <div className="svg-hexagon-chart">
      <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        {/* 刻度值 */}
        {scaleValues.map((value, index) => {
          if (index === 0) return null; // 跳过中心点的0值
          const distance = (size * index) / (scaleValues.length - 1);
          // 调整角度使刻度值的位置更合理
          const angle = Math.PI / 6;
          return (
            <text
              key={`scale-${index}`}
              x={center[0] + distance * Math.cos(angle)}
              y={center[1] - distance * Math.sin(angle)}
              fill="rgba(255,255,255,0.5)"
              fontSize="10"
              textAnchor="middle"
              style={{
                opacity: animated ? 1 : 0,
                transition: `opacity 0.5s ease ${0.3 + index * 0.1}s`
              }}
            >
              {value}
            </text>
          );
        })}
        
        {/* 同心六边形（刻度线） */}
        {concentricPolygons.map((polygon, index) => (
          <polygon
            key={index}
            points={polygon}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
            style={{
              opacity: animated ? 1 : 0,
              transition: `opacity 0.5s ease ${0.2 + index * 0.1}s`
            }}
          />
        ))}
        
        {/* 径向线 */}
        {outerPoints.map((point, i) => (
          <line 
            key={i}
            x1={center[0]} 
            y1={center[1]} 
            x2={point[0]} 
            y2={point[1]} 
            stroke="rgba(255,255,255,0.1)" 
            strokeWidth="1"
            style={{
              opacity: animated ? 1 : 0,
              transition: `opacity 0.5s ease ${0.3 + i * 0.05}s`
            }}
          />
        ))}
        
        {/* 外部框架 */}
        <polygon 
          points={outerPolygon} 
          fill="none" 
          stroke="rgba(255,255,255,0.3)" 
          strokeWidth="2"
          style={{
            opacity: animated ? 1 : 0,
            transition: 'opacity 0.8s ease 0.5s'
          }}
        />
        
        {/* 用户分数线（无填充，仅边框） */}
        <polygon 
          points={scorePolygon} 
          fill="none" 
          stroke="#F0BDC0" 
          strokeWidth="3"
          style={{
            opacity: animated ? 1 : 0,
            transition: 'opacity 1s ease 0.7s'
          }}
        />

        {/* 分数点 */}
        {scorePoints.map((point, i) => (
          <circle
            key={i}
            cx={point[0]}
            cy={point[1]}
            r="4"
            fill="#F0BDC0"
            style={{
              opacity: animated ? 1 : 0,
              transition: `opacity 0.5s ease ${0.8 + i * 0.1}s`,
              transform: `scale(${animated ? 1 : 0})`,
              transformOrigin: 'center',
              transitionProperty: 'opacity, transform',
              transitionDuration: '0.5s',
              transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
          />
        ))}
        
        {/* 角色范围区域（粉色阴影区） */}
        {characterRanges && (() => {
          const rangePoints = [];
          for (let i = 0; i < 6; i++) {
            const tag = tagKeys[i];
            const range = characterRanges[tag];
            if (range) {
              const minSize = (size * range[0]) / 100;
              const maxSize = (size * range[1]) / 100;
              const angle = (Math.PI / 6) + (Math.PI / 3 * i);
              
              rangePoints.push({
                minX: center[0] + minSize * Math.cos(angle),
                minY: center[1] + minSize * Math.sin(angle),
                maxX: center[0] + maxSize * Math.cos(angle),
                maxY: center[1] + maxSize * Math.sin(angle)
              });
            }
          }
          
          // 创建内外两个六边形来表示范围
          const minPolygon = rangePoints.map(p => `${p.minX},${p.minY}`).join(' ');
          const maxPolygon = rangePoints.map(p => `${p.maxX},${p.maxY}`).join(' ');
          
          return (
            <g style={{
              opacity: animated ? 0.3 : 0,
              transition: 'opacity 0.8s ease 0.5s'
            }}>
              {/* 使用clip-path创建范围区域 */}
              <defs>
                <clipPath id="range-clip">
                  <polygon points={maxPolygon} />
                </clipPath>
              </defs>
              {/* 最大范围轮廓 */}
              <polygon 
                points={maxPolygon}
                fill="rgba(240, 189, 192, 0.15)"
                stroke="rgba(240, 189, 192, 0.4)"
                strokeWidth="2"
              />
              {/* 最小范围轮廓 */}
              <polygon 
                points={minPolygon}
                fill="rgba(10, 10, 10, 0.3)"
                stroke="rgba(240, 189, 192, 0.4)"
                strokeWidth="2"
              />
            </g>
          );
        })()}
        
        {/* 分数值气泡 */}
        {tagPositions.map((item, index) => {
          const bubbleSize = getBubbleSize();
          const fontSize = getScoreFontSize();
          
          return (
            <g 
              key={`score-bubble-${item.key}`} 
              style={{
                opacity: animated ? 1 : 0,
                transition: `opacity 0.5s ease ${1.2 + index * 0.1}s`
              }}
            >
              {/* 分数背景气泡 */}
              <circle
                cx={item.scoreX}
                cy={item.scoreY}
                r={bubbleSize}
                fill="rgba(10,10,10,0.8)"
                stroke="#F0BDC0"
                strokeWidth="1.5"
                style={{
                  filter: "drop-shadow(0 0 3px rgba(240,189,192,0.5))"
                }}
              />
              {/* 分数文本 */}
              <text
                x={item.scoreX}
                y={item.scoreY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#F0BDC0"
                fontSize={fontSize}
                fontWeight="bold"
              >
                {Math.round(item.score)}%
              </text>
            </g>
          );
        })}
        
        {/* 标签文本 */}
        {tagPositions.map((item, index) => {
          const labelText = labels[item.key] 
            ? (language === 'en' ? labels[item.key].en : labels[item.key].zh) 
            : item.key;
          
          // 获取响应式标签宽度
          const labelWidth = getLabelWidth();
          
          return (
            <g 
              key={`label-${item.key}`}
              style={{
                opacity: animated ? 1 : 0,
                transition: `opacity 0.5s ease ${1 + index * 0.1}s`
              }}
            >
              {/* 标签文本背景 */}
              <rect
                x={item.labelX - labelWidth / 2}
                y={item.labelY - 12}
                width={labelWidth}
                height="24"
                rx="12"
                ry="12"
                fill="rgba(0,0,0,0.6)"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
                className="label-background"
              />
              
              {/* 标签文本 */}
              <text 
                x={item.labelX} 
                y={item.labelY} 
                textAnchor="middle" 
                dominantBaseline="middle"
                fill="white"
                fontSize={windowWidth <= 480 ? 11 : 13}
                fontWeight="bold"
                className="label-text"
              >
                {labelText}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// 添加一个优雅的加载组件
const FancyLoader: React.FC = () => {
  return (
    <div className="fancy-loader-container">
      <div className="fancy-loader-content">
        <div className="fancy-loader-hexagon">
          <div className="hexagon-outer"></div>
          <div className="hexagon-middle"></div>
          <div className="hexagon-inner"></div>
        </div>
        <div className="fancy-loader-text">
          <span>L</span>
          <span>o</span>
          <span>a</span>
          <span>d</span>
          <span>i</span>
          <span>n</span>
          <span>g</span>
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </div>
      </div>
    </div>
  );
};

// 模拟卡片数据
const cardsData: CardData[] = [
  {
    id: 'odin',
    name: {
      en: 'Odin',
      zh: '奥丁'
    },
    title: {
      en: 'The Adept Commander',
      zh: '超卓指挥官'
    },
    description: {
      en: [
        'From the old market order you call Ymir,',
        'Darkness has the upperhand,',
        'Where competition is win-lose only,',
        'No ground for collaboration,',
        'Where market need is undetermined,',
        'Everyone was scrambling all over the place.',
        '',
        'You dissect, lead and attack with brothers by your side,',
        'From complexity of market demand and risk of corporate structure,',
        'The reborn economic world reshaped now prevails;',
        'You possess the eye that sees through the delusion, confusion, frustration',
        'Of any unpredictable market order;',
        '',
        'For signs of economic boom,',
        'You look into gold-copper ratio;',
        'For signs of AI boom,',
        'You look into technology infrastructure.',
        '',
        'In objectivity you decide,',
        'In sovereign you reign,',
        'And it’s all you who guides in the face of shine or rain,',
        'At a high position that demands precision and analyzation,',
        'While commanding Huginns and Muninns,',
        'Geris and Frekis by your side;',
        '',
        'Polishing your weapon for the Ragnarök',
        'As the cyclic market meets its fate,',
        'And there ain\'t no Fenrir this time.'
        ],
      zh: [
        '在你称作伊米尔的旧市场秩序中，',
        '黑暗统治着大地，',
        '竞争只论输赢，毫无合作共利；',
        '市场需求无人看清，众人皆在四处奔忙。',
        '',
        '你同兄弟们并肩，分析、带领、进攻。',
        '在市场需求交错的脉络里，',
        '在企业结构潜藏的风险里，',
        '一个重生的经济世界，',
        '被你重新塑起。',
        '不论多混乱的市场秩序，',
        '你的眼睛都能看穿困惑、迷失、挫败。',
        '',
        '寻找经济繁荣的讯号时，',
        '你注视金铜比率的走向；',
        '寻找人工智能浪潮的讯号时，',
        '你观察科技基础设施的土壤。',
        '',
        '以客观做判断，',
        '以掌控定决策；',
        '无论风雨还是烈日，始终是你领着众人向前。',
        '身处需要精准与分析的高位，',
        '福金与雾尼在天际盘旋，',
        '基利与库力奇守在身边。',
        '',
        '你擦亮手中的兵刃，',
        '等待诸神黄昏的那一天；',
        '当周期循环的市场，',
        '终于迎来命运之战。',
        '',
        '但这一次，',
        '芬里尔不会出现。',
      ]

    },
    mythology: {
      en: 'Odin, the chief of the Norse gods, is the god of wisdom, war, and poetry. He rules from his throne in Asgard, accompanied by his two ravens, Huginn (Thought) and Muninn (Memory), who bring him knowledge from across the world. A master of strategy and foresight, Odin is both a ruthless warrior and a wise ruler, shaping destinies and preparing for Ragnarok.',
      zh: '奥丁是北欧诸神之首，是智慧、战争和诗歌之神。他在阿斯加德的王座上掌管一切，他的两只乌鸦 Huginn（思想）和 Muninn（记忆）为他带来世界各地的知识。奥丁是战略和远见的大师，他既是无情的战士，也是睿智的统治者，他塑造命运，并为 "世界毁灭 "做准备。'
    },
    tagRanges: {
      selfAwareness: [80, 100],
      dedication: [20, 60],
      socialIntelligence: [30, 60],
      emotionalRegulation: [40, 60],
      objectivity: [60, 80],
      coreEndurance: [40, 60]
    },
    image: odinImage
  },
  {
    id: 'wukong',
    name: {
      en: 'Wukong',
      zh: '大圣'
    },
    title: {
      en: 'The Charismatic Adventurer',
      zh: '魅力冒险家'
    },
    description: {
      en: [
        'As firm as the rock that you are born from,',
        'You are adaptive, adjustive, accommodative,',
        'At a speed that no-one can rival;',
        '',
        'From Mount Huaguo where you lead,',
        'Where the pack of monkeys follow you,',
        'You connect with all',
        'And bring concrete results, erasing death, without difficulties,',
        'Like turning the hand, but not of The Buddha, of course.',
        '',
        'From Puti Zushi whom you learn,',
        'Where your innate naughty spirit',
        'Now gives rise to adventurousness,',
        'You transform in 72 forms in passion and creation,',
        'Just like how you push forward work progress in diverse directions.',
        '',
        'Against rigid corporate world of the old market order of Heaven,',
        'You grow, challenge, and inspire;',
        'Along the journey to the West with your team,',
        'You protect, pioneer, and pivot with',
        'One Somersault Cloud and the stock price goes up by 108,000 miles;',
        'Learning the guidance of The Budda,',
        'You are the Victorious Fighting Buddha.',
      ],
      zh: [
        '坚如诞生出的磐石，',
        '你灵活善变、融会贯通，',
        '常人望而不可及。',
        '',
        '自你领导着的花果山，',
        '猴群相竞跟随，',
        '你与所带领团队交好，',
        '带来实际结果，抹灭死亡，',
        '易如反掌，当然并非如来佛祖之掌。',
        '',
        '从拜师菩提祖师，',
        '你的冒险精神源自自己天生的淘气灵动，',
        '你带着热情和创造力掌握七十二变，',
        '正如你朝着多方向发展推动工作一般。',
        '',
        '挑战古板天庭般的陈腐商业企业，',
        '你成长、挑战、启发；',
        '跟你的团队一同赴往西天，',
        '你保护、引领、调整，',
        '一个筋斗云股价随之上涨十万八千里；',
        '随佛祖的指导，',
        '你就是斗战胜佛。',
      ]

    },
    mythology: {
      en: 'Wukong, from Journey to the West, is a mischievous, incredibly powerful trickster born from a stone. With unmatched speed, strength, and shapeshifting abilities, he defied Heaven, battled celestial armies, and even erased his name from the "Book of Death". His journey toward enlightenment under the Buddha transformed him from an unruly warrior into a disciplined protector. He embodies freedom, wit, and unbreakable determination, always challenging the rules set before him.',
      zh: '悟空是《西游记》中聪明顽皮、法力无边的主角。他拥有无与伦比的速度、力量和变形能力，他单打天庭，与天兵天将作战，甚至将自己的名字从生死簿中抹掉。在佛祖的启蒙下，他从一个不羁的战士变成了一个严于律己的保护者。他体现了自由、机智和坚不可摧的决心，总是向他面前的规则发起挑战。'
    },
    tagRanges: {
      selfAwareness: [40, 60],
      dedication: [40, 60],
      socialIntelligence: [40, 70],
      emotionalRegulation: [80, 100],
      objectivity: [40, 60],
      coreEndurance: [40, 60]
    },
    image: wukongImage
  },
  {
    id: 'prometheus',
    name: {
      en: 'Prometheus',
      zh: '普罗米修斯'
    },
    title: {
      en: 'The Altruistic Contributor',
      zh: '无私贡献者'
    },
    description: {
      en: [
        'Before fire was brought from Olympus,',
        'Where others see the world as it is,',
        'You see the world as it could become;',
        'Where others accept the limits of today,',
        'You look toward the needs of tomorrow.',
        '',
        'Climbing beyond what is deemed mortals’ ability,',
        'You pursue knowledge not for possession,',
        'But for the benefit of those who may never know your name.',
        '',
        'You understand that meaningful progress rarely begins with comfort.',
        'It begins with responsibility,',
        'With the courage to challenge what is accepted,',
        'And the willingness to carry burdens that others cannot yet see.',
        '',
        'The work that matters most is often invisible at first:',
        'A discovery before its application,',
        'An idea before its recognition,',
        'A sacrifice before its reward.',
        '',
        'Yet you move forward regardless,',
        'As the keeper of the sacred flame,',
        'You illuminate paths that others may follow,',
        'And transform possibility into progress,',
        'One spark at a time.'
      ],
      zh: [
        '在火种被带离奥林匹斯之前，',
        '当他人看见世界的现状，',
        '你看见世界本可以成为的模样；',
        '当他人接受当下的边界，',
        '你思考未来真正需要什么。',
        '',
        '攀登凡人无法抵达的高处，',
        '你追寻知识并非为了占有，',
        '而是为了让更多人从中受益。',
        '',
        '你明白，',
        '真正有意义的进步很少诞生于安逸。',
        '它诞生于责任，',
        '诞生于质疑既有秩序的勇气，',
        '也诞生于承担无人看见之重的决心。',
        '',
        '最重要的贡献往往最先隐于无形：',
        '一项发现早于应用，',
        '一个理念早于认可，',
        '一次付出早于回报。',
        '',
        '然而你依然向前，',
        '作为同守护火种的先驱，',
        '你照亮后来者前行的道路，',
        '将可能化为现实，',
        '将微光汇聚成文明。',
      ]

    },
    mythology: {
      en: 'Prometheus, a Titan of Greek mythology, is the bringer of fire and civilization to humanity. Defying Zeus, he stole fire from Olympus and gifted it to mankind, enabling progress, creativity, and technology. A symbol of defiance, sacrifice, and innovation, Prometheus represents the relentless pursuit of knowledge and the innovative attempt of challenging authority.',
      zh: '普罗米修斯是希腊神话中的泰坦巨人，他为人类带来了火种和文明。他反抗宙斯，从奥林匹斯山盗取了火种，并将其赐予人类，使人类获得了进步、创造力和技术。作为反抗、牺牲和创新的象征，普罗米修斯代表着对知识的不懈追求和挑战权威的创新。'
    },
    tagRanges: {
      selfAwareness: [30, 60],
      dedication: [80, 100],
      socialIntelligence: [30, 60],
      emotionalRegulation: [30, 50],
      objectivity: [30, 70],
      coreEndurance: [60, 80]
    },
    image: prometheusImage
  },
  {
    id: 'nuwa',
    name: {
      en: 'Nüwa',
      zh: '女娲'
    },
    title: {
      en: 'The Empowering Creator',
      zh: '赋能创造者'
    },
    description: {
      en: [
        'Systematic is your thought,',
        'Such that when the sky falls into pieces,',
        'You smelt the stone to patch the sky.',
        'In rainbow color of the stone you create,',
        'Bring to order the world you will sustain.',
        '',
        'From here, the seed of resilience, creation, and reformation is',
        'Planted within you, or rather,',
        'You are the seed.',
        'From you, you create others in the best form of you,',
        'From clay, from Earth, from the ground that gives rise to everything.',
        '',
        'Same in work,',
        'No issues in any projects comparable to the sky you fix,',
        'With finesse and ease, you transform ideas to concrete creation,',
        'Just as the Five-colored stone,',
        'Because from you, all is bright and colorful.',
        '',
        'Same with teammates,',
        'You listen to and combine different viewpoints,',
        'Push forward changes involving people,',
        'Build, cultivate, and empower others to maximum,',
        'Just as from clay and water alone,',
        'You create and give life.',
      ],
      zh: [
        '系统如你的思维体系，',
        '当天崩塌成碎片之时，',
        '你炼石补天。',
        '在你所炼就的五彩石的五光十色之中，',
        '你从秩序中带来你将要维系的世界。',
        '',
        '从此，韧性、创造、改变的种子',
        '在你这生根发芽，倒不如说，',
        '你就是这颗种子。',
        '源自你，你以你最美的模样创造他人，',
        '源自泥土、大地，源自孕育出万物的土壤。',
        '',
        '工作同理，',
        '没有问题能跟你所补的天相提并论，',
        '游刃有余之中，你把创意转化为创造，',
        '正如五色石一般，',
        '因为源自你，尽为光彩明亮。',
        '',
        '团队同理，',
        '你倾听并融合不同观点，',
        '带动众人推动改变，',
        '打造、孕育、赋能他人到其最佳水平，',
        '正如仅仅从泥土和水当中，',
        '你创造和赋予生命。',
      ]

    },
    mythology: {
      en: "Nüwa, one of the most revered figures in Chinese mythology, is the goddess of creation, balance, and restoration. According to legend, she created humanity from clay and, when the heavens cracked, she patched the sky with five-colored stones, restoring order to the world. Often depicted with a serpent's lower body, she embodies nurturing power, ingenuity, creation, and harmony, ensuring the world remains whole and sustainable.",
      zh: '女娲是中国神话中最受尊崇的人物之一，是创造、平衡和恢复的女神。传说中，她用泥土创造了人类；当天体破裂时，她用五色石补缀天空，恢复了世界的秩序。她通常被描绘成蛇的下半身，体现了孕育的力量、智慧、创造与和谐，守护着世界的完整性和可持续发展性。'
    },
    tagRanges: {
      selfAwareness: [0, 40],
      dedication: [50, 80],
      socialIntelligence: [40, 60],
      emotionalRegulation: [60, 80],
      objectivity: [40, 60],
      coreEndurance: [80, 100]
    },
    image: nuwaImage
  },
  {
    id: 'athena',
    name: {
      en: 'Athena',
      zh: '雅典娜'
    },
    title: {
      en: 'The Strategic Guardian',
      zh: '战略守护者'
    },
    description: {
      en: [
        'Born fully armored from the mind of Zeus,',
        'Needs no childhood phase,',
        'No “learning by mistakes,”',
        'And certainly no motivational LinkedIn posts.',
        '',
        'From the summit where wisdom overlooks ambition,',
        'You watch markets move before they know they are moving;',
        'Where others chase answers,',
        'You question the question itself.',
        '',
        'With owl-eyed clarity,',
        'You separate signal from noise,',
        'Trend from fashion,',
        'And strategy from whatever was discussed',
        'In that three-hour meeting that could have been an email.',
        '',
        'You do not charge into battle like Ares,',
        'For victory is not measured by noise;',
        'You redraw the battlefield,',
        'And somehow the outcome arrives before the conflict begins.',
        '',
        'Among architects, researchers, governors and builders,',
        'You design systems that outlive their creators;',
        'When the corporate labyrinth grows impossible to navigate,',
        'You draw the map,',
        'For every company eventually faces its Minotaur.',
        'Others sharpen their swords.',
        'You sharpen the assumptions.',
        'For that is the true monster.',
      ],
      
      zh: [
        '从宙斯的头颅中全副武装诞生，',
        '没有实习期，',
        '没有试错期，',
        '更不需要朋友圈鸡汤来激励自己。',
        '',
        '站在智慧俯瞰野心的高处，',
        '当市场还未意识到变化时，',
        '你已经看见了方向；',
        '别人忙着寻找答案，',
        '你先思考问题是否问对。',
        '',
        '如猫头鹰般锐利的目光，',
        '让你分得清讯号与噪音，',
        '趋势与潮流，',
        '战略与那场本来可以用邮件解决的三小时会议。',
        '',
        '你不像阿瑞斯那样高举长矛冲锋，',
        '因为真正的胜利，',
        '从来不靠声音大小决定；',
        '你重新绘制战场，',
        '于是结果往往在战斗开始前便已注定。',
        '',
        '在研究者、建筑师、管理者与开拓者之间，',
        '你设计能够超越创造者寿命的系统；',
        '当企业迷宫变得无人能够看懂时，',
        '你成为画地图的人。',
        '因为每家公司终究都会遇见自己的牛头怪。',
        '别人磨利刀剑，',
        '而你审视假设，',
        '因为此才是真正的怪兽。'
      ]

    },
    mythology: {
      en: 'Athena, the Greek goddess of wisdom, warfare, and crafts, is known for her strategic mind and protective nature. Born fully grown from Zeus\'s head, she represents rational thought, justice, and the defense of civilization. Unlike Ares, the god of war, Athena embodies strategic warfare and the protection of cities. She is the patron of heroes, offering guidance and wisdom to those who seek righteous paths.',
      zh: '雅典娜是希腊的智慧、战争和工艺女神，以其战略思维和保护性而闻名。她从宙斯的头部完全成长，代表着理性思维、正义和文明的防御。与战神阿瑞斯不同，雅典娜体现了战略战争和城市保护。她是英雄的守护神，为那些寻求正义道路的人提供指导和智慧。'
    },
    tagRanges: {
      selfAwareness: [60, 80],
      dedication: [0, 40],
      socialIntelligence: [50, 70],
      emotionalRegulation: [40, 60],
      objectivity: [70, 100],
      coreEndurance: [40, 60]
    },
    image: athenaImage
  },
  {
    id: 'venus',
    name: {
      en: 'Venus',
      zh: '维纳斯'
    },
    title: {
      en: 'The Diplomatic Connector',
      zh: '外交联络者'
    },
    description: {
      en: [
        'From the foam where sea and sky meet, you rise,',
        'Understanding desire before people put so into words,',
        'Since not every reason people love something',
        'Can be found in a spreadsheet.',
        '',
        'You build with insight into the human heart.',
        'Where others focus on features,',
        'You focus on experiences.',
        'Where others question functionality,',
        'You dive into emotions .',
        '',
        'Like the tide that shapes the shoreline over time,',
        'You recognize subtle needs, hidden aspirations,',
        'And opportunities others overlook.',
        'You see patterns before trends,',
        'And desires before demands.',
        '',
        'In moments of uncertainty,',
        'You sense what people are searching for.',
        'In moments of change,',
        'You understand what they are unwilling to lose.',
        '',
        'Your gift is not persuasion through pressure,',
        'But attraction through meaning.',
        'Not convincing people to care,',
        'But creation through caring.',
        '',
        'You bring beauty to utility,',
        'Emotion to creation.',
        'For every great product ultimately succeeds not because of itself,',
        'But because people genuinely love it.'
      ],

      zh: [
        '你自海天交汇的浪花之中起身而出，',
        '理解人们尚未说出口的渴望，',
        '因为并非所有喜爱',
        '都能从报表中找到答案。',
        '',
        '你用对人性的洞察创造价值。',
        '当他人关注产品特征，',
        '你关注带来体验；',
        '当他人询问产品功能，',
        '你专注情绪价值。',
        '',
        '如同潮汐悄然塑造海岸，',
        '你看见那些细微的需求、未被满足的期待，',
        '以及被忽略的机会。',
        '在趋势形成前看见规律，',
        '在需求表达前理解渴望。',
        '',
        '在迷茫之中，',
        '你知道人们正在寻找什么；',
        '在变革之中，',
        '你理解人们最不愿失去什么。',
        '',
        '你的力量并非来自说服，',
        '而是来自真正的吸引力。',
        '不是迫使人们在意，',
        '而是源自在意的创造。',
        '',
        '你为功能赋予美感，',
        '为创新注入情感。',
        '因为任何伟大的产品之所以成功，',
        '最终并不只是因为它本身，',
        '而是因为人们无法自拔的真心喜爱。',
      ]
    },
    mythology: {
      en: 'Venus is the Roman goddess of love, beauty, passion, and attraction. Born from sea foam, she captivates gods and mortals alike, influencing love, art, and pleasure. Her power extends beyond romance—she governs persuasion, charm, and the irresistible force of desire. As a symbol of both beauty and emotion, Venus represents the the joy of life and the eternal dance of attraction.',
      zh: '维纳斯是罗马神话中代表爱、美、激情和吸引力的女神。她诞生于海中的泡沫，吸引着众神和凡人，影响着爱情、艺术和享乐。她的力量超越了浪漫--她掌管说服、魅力和渴望的力量。作为美丽和情感的象征，维纳斯代表着生命的喜悦和永恒的吸引力之舞。'
    },
    tagRanges: {
      selfAwareness: [60, 80],
      dedication: [40, 60],
      socialIntelligence: [80, 100],
      emotionalRegulation: [40, 70],
      objectivity: [30, 60],
      coreEndurance: [20, 50]
    },
    image: venusImage
  }
];

const Results: React.FC = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [tagScores, setTagScores] = useState<Record<string, number>>({});
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [cards, setCards] = useState<CardData[]>([]);
  const [matchedCard, setMatchedCard] = useState<CardData | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [isCardSwitching, setIsCardSwitching] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLegendInput, setShowLegendInput] = useState(false);
  const [legendText, setLegendText] = useState('');
  const [legendComments, setLegendComments] = useState<LegendComment[]>([]);
  const [expandedBubbleId, setExpandedBubbleId] = useState<string | null>(null);

  // 添加图片预加载功能
  useEffect(() => {
    const preloadImages = async (imagePaths: string[]) => {
      try {
        const promises = imagePaths.map(path => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = path;
            img.onload = () => resolve(path);
            img.onerror = () => reject(path);
          });
        });
        
        await Promise.allSettled(promises);
        setImagesLoaded(true);
      } catch (error) {
        console.error('Error preloading images:', error);
        // 即使有错误也设置为已加载，以避免永久加载状态
        setImagesLoaded(true);
      }
    };
    
    // 当卡片数据准备好后预加载图片
    if (cards.length > 0) {
      const imagePaths = cards.map(card => card.image);
      preloadImages(imagePaths);
    }
  }, [cards]);

  // 添加标签翻译映射
  const tagLabels: Record<string, TagTranslations> = {
    selfAwareness: { en: 'Self Awareness', zh: '自我意识' },
    dedication: { en: 'Dedication', zh: '奉献精神' },
    socialIntelligence: { en: 'Social Intelligence', zh: '社交情商' },
    emotionalRegulation: { en: 'Emotional Regulation', zh: '情绪调节' },
    objectivity: { en: 'Objectivity', zh: '客观能力' },
    coreEndurance: { en: 'Core Endurance', zh: '核心耐力' }
  };

  useLayoutEffect(() => {
    const bootstrap = (location.state as ResultsLocationState | null)?.resultsBootstrap;

    const getTagStatsFromStorage = (): Record<string, TagStats> | null => {
      const savedStats = localStorage.getItem('tagStats');
      if (savedStats) {
        try {
          return JSON.parse(savedStats) as Record<string, TagStats>;
        } catch (e) {
          console.error('Error parsing saved tag statistics:', e);
          return null;
        }
      }
      return null;
    };

    const resolveQuestion25Answer = () => {
      const savedAnswers = localStorage.getItem('chon_personality_answers');
      if (savedAnswers) {
        try {
          const answers = JSON.parse(savedAnswers);
          if (answers && typeof answers === 'object') {
            const savedQuestionnaireType = (localStorage.getItem('userSessionQuestionnaireType') ||
              localStorage.getItem('activeQuestionnaire') ||
              'mother') as QuestionnaireType;
            const question25 = questionnaires[savedQuestionnaireType]?.questions.find(q => q.unifiedId === 25);
            if (question25 && answers[question25.id]) {
              return answers[question25.id] as string;
            }
          }
        } catch (e) {
          console.error('Error parsing answers:', e);
        }
      }
      return undefined;
    };

    const hydrateResults = (): boolean => {
      const stats = bootstrap?.tagStats ?? getTagStatsFromStorage();
      if (!stats) {
        return false;
      }

      const q25Letter = (() => {
        if (bootstrap) {
          const t = (bootstrap.q25Letter || '').trim();
          return /^[A-Fa-f]$/.test(t) ? t.toUpperCase() : '';
        }
        const question25Raw = resolveQuestion25Answer();
        return question25Raw && /^[A-Fa-f]$/.test(String(question25Raw).trim())
          ? String(question25Raw).trim().toUpperCase()
          : '';
      })();

      const normalizedStats = normalizeTagStatsForMatching(stats);
      const finalScores = buildFinalScoresForMatching(normalizedStats, q25Letter);
      if (!finalScores) {
        console.error('Invalid tag stats for results display after normalization.');
        return false;
      }

      setTagScores(finalScores);

      const sortedMinimal = sortCharactersForPersistence(finalScores, q25Letter || undefined);
      if (sortedMinimal.length !== CHARACTER_MATCH_SORT_INPUT.length) {
        console.error(
          'Character ranking must include all',
          CHARACTER_MATCH_SORT_INPUT.length,
          'characters; got',
          sortedMinimal.length
        );
        setCards(cardsData);
        setMatchedCard(cardsData[0]);
        setImagesLoaded(true);
        return true;
      }

      const sortedCards = sortedMinimal
        .map(m => cardsData.find(c => c.id === m.id))
        .filter((c): c is CardData => Boolean(c));
      if (sortedCards.length !== cardsData.length) {
        console.error('Could not map sorted characters to full card data.');
        setCards(cardsData);
        setMatchedCard(cardsData[0]);
        setImagesLoaded(true);
        return true;
      }

      setCards(sortedCards);
      setActiveCardIndex(0);
      setMatchedCard(sortedCards[0]);
      setImagesLoaded(true);

      const userSessionId = localStorage.getItem('userSessionId');
      if (userSessionId) {
        const saveKey = `characterMatchesSaved_${userSessionId}`;
        if (!localStorage.getItem(saveKey)) {
          const matches = buildCharacterMatchRowsFromSorted(
            sortedMinimal,
            finalScores,
            q25Letter || undefined
          );

          void userSessionApi
            .saveCharacterMatches(userSessionId, matches)
            .then((result) => {
              localStorage.setItem(saveKey, 'true');
              console.log('Character matches saved to backend, best match:', result.bestMatch);
            })
            .catch((err) => {
              localStorage.removeItem(saveKey);
              console.error('Character matches were not saved; user can retry after reloading Results.', err);
            });
        }
      }
      return true;
    };

    const didHydrate = hydrateResults();
    if (!didHydrate) {
      let cancelled = false;

      // A logged-in account holder (e.g. arriving via the Personality Test tab on a fresh session)
      // may not have tagStats in localStorage. Pull their saved snapshot from the backend so the
      // results page renders instead of bouncing them to the intro / first question.
      const restoreSnapshotForAccount = async () => {
        const sid = (localStorage.getItem('userSessionId') || '').trim();
        const hasAccount = localStorage.getItem('userAccount');
        if (!sid || !hasAccount || localStorage.getItem('tagStats')) {
          return;
        }
        const snap = await userSessionApi.getAccountSnapshot(sid);
        if (cancelled || !snap?.has_results || !snap.tag_stats_local_storage) {
          return;
        }
        localStorage.setItem('tagStats', JSON.stringify(snap.tag_stats_local_storage));
        localStorage.setItem('chon_questionnaire_completed', 'true');
        if (snap.questionnaire_type) {
          localStorage.setItem('userSessionQuestionnaireType', snap.questionnaire_type);
        }
      };

      void restoreSnapshotForAccount();

      let attempts = 0;
      const interval = window.setInterval(() => {
        if (cancelled) {
          return;
        }
        attempts += 1;
        const success = hydrateResults();
        // Allow ~3s so the async account-snapshot restore above can land before giving up.
        if (success || attempts >= 20) {
          window.clearInterval(interval);
          if (!success) {
            navigate('/personality-test/intro');
          }
        }
      }, 150);
      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
    }
    return undefined;
  }, [location.key, navigate]);

  const normalizeEmail = (value?: string | null) => (value || '').trim().toLowerCase();

  const getVerifiedEmail = () => {
    return normalizeEmail(
      localStorage.getItem('userSessionEmail') ||
      localStorage.getItem('pendingVerificationEmail')
    );
  };

  const getAccountEmail = () => {
    const accountRaw = localStorage.getItem('userAccount');
    if (!accountRaw) return '';
    try {
      const account = JSON.parse(accountRaw) as { email?: string };
      return normalizeEmail(account.email);
    } catch (error) {
      console.error('Error parsing userAccount from localStorage:', error);
      return '';
    }
  };

  // Check if user is logged in
  useEffect(() => {
    const checkLoginStatus = () => {
      const hasAccount = localStorage.getItem('userAccount');
      const verifiedEmail = getVerifiedEmail();
      const accountEmail = getAccountEmail();
      const emailMatch = Boolean(verifiedEmail && accountEmail && verifiedEmail === accountEmail);
      const isAuthenticated = Boolean(hasAccount && emailMatch);
      console.log('Checking login status:', { hasAccount, isLoggedIn: isAuthenticated, emailMatch });
      setIsLoggedIn(isAuthenticated);
    };
    
    // Check immediately
    checkLoginStatus();
    
    // Listen for storage changes (when user logs in/out in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'userAccount') {
        checkLoginStatus();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically in case localStorage was modified directly
    const interval = setInterval(checkLoginStatus, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Load this character's user-submitted legends from localStorage
  useEffect(() => {
    if (!matchedCard) return;
    setLegendComments(loadLegendComments(matchedCard.name.en));
    setExpandedBubbleId(null);
    setShowLegendInput(false);
    setLegendText('');
  }, [matchedCard]);

  const getAuthorName = () => {
    const raw = localStorage.getItem('userAccount');
    if (raw) {
      try {
        const account = JSON.parse(raw) as { name?: string; username?: string; email?: string };
        if (account.name) return account.name;
        if (account.username) return account.username;
        if (account.email) return account.email.split('@')[0];
      } catch (e) {
        console.error('Error parsing userAccount for author name:', e);
      }
    }
    return language === 'en' ? 'Anonymous' : '匿名';
  };

  const handleSubmitLegend = () => {
    const text = legendText.trim();
    if (!text || !matchedCard) return;
    const newComment: LegendComment = {
      id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      author: getAuthorName(),
      text
    };
    const updated = [...loadLegendComments(matchedCard.name.en), newComment];
    try {
      localStorage.setItem(legendStorageKey(matchedCard.name.en), JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving legend comment:', e);
    }
    setLegendComments(updated);
    setLegendText('');
    setShowLegendInput(false);
  };

  const handleCardClick = (index: number) => {
    if (index !== activeCardIndex) {
      // 设置切换状态
      setIsCardSwitching(true);
      
      // 先将所有元素设为不可见状态
      setAnimationKey(prevKey => prevKey + 1);
      
      // 短暂延迟后更新卡片，给动画重置留出时间
      setTimeout(() => {
        setActiveCardIndex(index);
        setMatchedCard(cards[index]);
        
        // 通过延迟取消加载状态，确保新内容加载后动画能正确播放
        setTimeout(() => {
          setIsCardSwitching(false);
        }, 200);
      }, 100);
    }
  };

  // 处理图片加载错误的函数，使用memo防止重复渲染
  const handleImageError = React.useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget;
    if (target.dataset.fallbackApplied) {
      return;
    }
    target.dataset.fallbackApplied = 'true';
    target.src = '/images/molecule.png';
    
    // 添加样式防止闪烁
    target.style.objectFit = 'cover';
    target.style.backgroundColor = '#333';
  }, []);

  if (!matchedCard || !imagesLoaded || isCardSwitching) {
    return <FancyLoader />;
  }

  return (
    <div className="results-container" lang={language}>
      <div className="results-layout" key={`content-${animationKey}`}>
        <div className="results-left">
          <div className="character-portrait">
            <img 
              src={matchedCard.image} 
              alt={language === 'en' ? matchedCard.name.en : matchedCard.name.zh}
              onError={handleImageError}
            />
          </div>
          
          <div className="hexagon-chart">
            <HexagonChart
              scores={tagScores}
              labels={tagLabels}
              language={language}
              animationKey={animationKey}
              characterRanges={matchedCard.tagRanges}
            />
          </div>

          {/* Create Account Button - Below hexagon on desktop */}
          {!isLoggedIn && (
            <button
              className="create-account-button-desktop"
              onClick={() => navigate('/login', { state: { flow: 'create-account' } })}
            >
              {language === 'en' ? 'Create Account' : '创建账户'}
            </button>
          )}

          {/* Share Your Legend - shown after the user has created an account */}
          {isLoggedIn && (
            <div className="share-legend-section">
              <button
                className="share-legend-button"
                onClick={() => setShowLegendInput(prev => !prev)}
              >
                {language === 'en' ? 'Share Your Legend' : '分享你的传奇'}
              </button>

              {showLegendInput && (
                <div className="legend-input-container">
                  <label className="legend-input-label">
                    {language === 'en'
                      ? `Work experience that resonate with ${matchedCard.name.en}`
                      : `与${matchedCard.name.zh}产生共鸣的工作经历`}
                  </label>
                  <textarea
                    className="legend-textarea"
                    value={legendText}
                    onChange={(e) => setLegendText(e.target.value)}
                    placeholder={language === 'en'
                      ? 'Share a moment from your work life...'
                      : '分享你工作中的一个瞬间……'}
                    rows={4}
                  />
                  <div className="legend-input-actions">
                    <button
                      className="legend-submit-button"
                      onClick={handleSubmitLegend}
                      disabled={!legendText.trim()}
                    >
                      {language === 'en' ? 'Share' : '分享'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="results-right">
          <div className="character-info">
            <h1 className="character-name">
              {language === 'en' ? matchedCard.name.en : matchedCard.name.zh}
            </h1>
            <h2 className="character-title">
              {language === 'en' ? matchedCard.title.en : matchedCard.title.zh}
            </h2>
            
            <div className="mythology-description">
              <p>{language === 'en' ? matchedCard.mythology.en : matchedCard.mythology.zh}</p>
            </div>
          </div>
          
          {/* Only show workplace description for the most matched character */}
          {activeCardIndex === 0 && (
            <div className="workplace-description">
              {(language === 'en' ? matchedCard.description.en : matchedCard.description.zh).map((row, index) => (
                <p key={index} className="workplace-description-row">{row}</p>
              ))}
            </div>
          )}
          
          {/* Create Account Button - At bottom on mobile */}
          {!isLoggedIn && (
            <button 
              className="create-account-button-mobile"
              onClick={() => navigate('/login', { state: { flow: 'create-account' } })}
            >
              {language === 'en' ? 'Create Account' : '创建账户'}
            </button>
          )}
        </div>
      </div>
      
      {/* Transparent legend bubbles flowing on the right side */}
      {legendComments.length > 0 && (
        <div className="legend-bubbles">
          {legendComments.slice(-8).map((comment, index) => (
            <div
              key={comment.id}
              className={`legend-bubble ${expandedBubbleId === comment.id ? 'active' : ''}`}
              style={{
                top: `${10 + (index * 11) % 78}%`,
                right: `${8 + (index % 3) * 16}px`,
                animationDelay: `${(index % 5) * 0.8}s`,
                animationDuration: `${6 + (index % 4)}s`
              }}
              onClick={() => setExpandedBubbleId(prev => (prev === comment.id ? null : comment.id))}
              title={comment.author}
            >
              <span className="legend-bubble-initial">
                {comment.author.charAt(0).toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Expanded comment popup */}
      {(() => {
        const expanded = legendComments.find(c => c.id === expandedBubbleId);
        if (!expanded) return null;
        return (
          <div className="legend-comment-overlay" onClick={() => setExpandedBubbleId(null)}>
            <div className="legend-comment-card" onClick={(e) => e.stopPropagation()}>
              <button
                className="legend-comment-close"
                onClick={() => setExpandedBubbleId(null)}
                aria-label={language === 'en' ? 'Close' : '关闭'}
              >
                ×
              </button>
              <span className="legend-comment-author">{expanded.author}</span>
              <p className="legend-comment-text">{expanded.text}</p>
            </div>
          </div>
        );
      })()}

      {/* 将角色卡片Dock作为独立元素，不嵌套在其他容器中 */}
      <div id="character-dock-container" style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', zIndex: 1000, pointerEvents: 'none' }}>
        <div className="character-cards-dock" style={{ pointerEvents: 'auto' }}>
          {cards.map((card, index) => (
            <div 
              key={card.id}
              className={`dock-card ${index === activeCardIndex ? 'active' : ''}`}
              onClick={() => handleCardClick(index)}
            >
              <img 
                src={card.image} 
                alt={language === 'en' ? card.name.en : card.name.zh}
                className="dock-card-image"
                onError={handleImageError}
                loading="eager"
                decoding="async"
              />
              <span className="dock-card-name">
                {language === 'en' ? card.name.en : card.name.zh}
              </span>
              {index === 0 && (
                <span className="dock-card-you-label">
                  {language === 'en' ? 'You' : '您'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Results; 
