import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { toEnglishTag, REVERSE_TAG_MAPPING } from '../../utils/tagUtils';
import { sortCharactersByMatch, applyQuestion25Bonus } from '../../utils/characterMatching';
import './Results.css';

interface TagScore {
  userScore: number;
  totalPossibleScore: number;
  scorePercentage: number;
  averageScore: number;
  answeredQuestions: number;
}

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
    en: string;
    zh: string;
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

const Results: React.FC = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [tagScores, setTagScores] = useState<Record<string, number>>({});
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [cards, setCards] = useState<CardData[]>([]);
  const [matchedCard, setMatchedCard] = useState<CardData | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [isCardSwitching, setIsCardSwitching] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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
        en: 'As Odin, you excel in roles that demand sharp analytical thinking and strategic foresight. You are highly self-aware, allowing you to navigate complex challenges with precision. Your objectivity and ability to assess situations with clarity make you a strong decision-maker in high-stakes environments. While your social interactions may be selective, your ability to remain composed under pressure ensures that you command respect in leadership roles. You thrive in careers such as executive leadership, strategic consulting, and high-level problem-solving roles where precision and critical thinking are essential.',
        zh: '作为奥丁，你擅长从事需要敏锐分析思维和战略远见的工作。你有很强的自我意识，能够准确地驾驭复杂的挑战。你的客观性和清晰评估局势的能力使你在高风险环境中成为强有力的决策者。虽然你的社会交往可能是有选择性的，但你在压力下保持镇定的能力确保你在领导岗位上得到尊重。你在行政领导、战略咨询和高层次问题解决等对精确性和批判性思维至关重要的职业中都能茁壮成长。'
      },
      mythology: {
        en: 'Odin, the chief of the Norse gods, is the god of wisdom, war, and poetry. He rules from his throne in Asgard, accompanied by his two ravens, Huginn (Thought) and Muninn (Memory), who bring him knowledge from across the world. A master of strategy and foresight, Odin is both a ruthless warrior and a wise ruler, shaping destinies and preparing for Ragnarok.',
        zh: '奥丁是北欧诸神之首，是智慧、战争和诗歌之神。他在阿斯加德的王座上掌管一切，他的两只乌鸦 Huginn（思想）和 Muninn（记忆）为他带来世界各地的知识。奥丁是战略和远见的大师，他既是无情的战士，也是睿智的统治者，他塑造命运，并为 "世界毁灭 "做准备。'
      },
      tagRanges: {
        selfAwareness: [80, 100],
        dedication: [20, 50],
        socialIntelligence: [30, 60],
        emotionalRegulation: [20, 50],
        objectivity: [60, 80],
        coreEndurance: [0, 60]
      },
      image: '/images/characters/odin.jpg'
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
        en: 'As Wukong, you bring a balance of self-awareness, emotional intelligence, and resilience to the workplace. Your ability to connect with others effortlessly makes you a natural leader, inspiring teams with both your confidence and adaptability. You thrive in dynamic environments where creativity, risk-taking, and influence drive results, embracing challenges with enthusiasm. Your endurance allows you to sustain peak performance over extended periods, making you well-suited for roles that require both leadership and a pioneering spirit. Careers in entrepreneurship, public relations, and innovation-driven industries would align well with your adventurous and engaging nature.',
        zh: '作为大圣，你在工作中兼顾了自我意识、情商和应变能力。你能毫不费力地与他人建立联系，这使你成为一名天生的领导者，用自信和适应能力激励团队。你能在充满活力的环境中茁壮成长，以创造力、冒险精神和影响力推动工作取得成果，热情迎接挑战。你的耐力使你能够长期保持巅峰状态，这使你非常适合担任既需要领导力又需要开拓精神的职位。创业、公共关系和创新驱动型行业的职业与你的冒险精神和参与性非常吻合。'
      },
      mythology: {
        en: 'Wukong, from Journey to the West, is a mischievous, incredibly powerful trickster born from a stone. With unmatched speed, strength, and shapeshifting abilities, he defied Heaven, battled celestial armies, and even erased his name from the "Book of Death". His journey toward enlightenment under the Buddha transformed him from an unruly warrior into a disciplined protector. He embodies freedom, wit, and unbreakable determination, always challenging the rules set before him.',
        zh: '悟空是《西游记》中聪明顽皮、法力无边的主角。他拥有无与伦比的速度、力量和变形能力，他单打天庭，与天兵天将作战，甚至将自己的名字从生死簿中抹掉。在佛祖的启蒙下，他从一个不羁的战士变成了一个严于律己的保护者。他体现了自由、机智和坚不可摧的决心，总是向他面前的规则发起挑战。'
      },
      tagRanges: {
        selfAwareness: [40, 60],
        dedication: [0, 40],
        socialIntelligence: [40, 70],
        emotionalRegulation: [80, 100],
        objectivity: [40, 60],
        coreEndurance: [40, 60]
      },
      image: '/images/characters/wukong.jpg'
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
        en: 'As Prometheus, your unwavering dedication to your work sets you apart. You thrive in environments that require deep commitment and a willingness to go beyond expectations. While you may not always seek recognition from your peers, your ability to sacrifice for the greater good makes you the most important asset to any team. Your endurance and persistence enable you to push through challenges, though managing emotional resilience is key to sustaining long-term success. You perform exceptionally well in mission-driven fields such as research, humanitarian work, and social entrepreneurship, where your innovation and dedication can create long lasting impacts for all.',
        zh: '作为普罗米修斯，你对工作坚定不移的奉献精神使你与众不同。你在需要深度投入和愿意超越期望的环境中茁壮成长。虽然你可能并不总是寻求同伴的认可，但你为大局牺牲的能力使你成为任何团队最宝贵的的资产。你的耐力和毅力使你能够克服挑战，尽管管理好情绪恢复力是保持长期成功的关键。在研究、人道主义工作和社会创业等以使命为导向的领域，你的表现尤为出色，你的创新能力和奉献精神能为所有人带来长久的影响。'
      },
      mythology: {
        en: 'Prometheus, a Titan of Greek mythology, is the bringer of fire and civilization to humanity. Defying Zeus, he stole fire from Olympus and gifted it to mankind, enabling progress, creativity, and technology. A symbol of defiance, sacrifice, and innovation, Prometheus represents the relentless pursuit of knowledge and the innovative attempt of challenging authority.',
        zh: '普罗米修斯是希腊神话中的泰坦巨人，他为人类带来了火种和文明。他反抗宙斯，从奥林匹斯山盗取了火种，并将其赐予人类，使人类获得了进步、创造力和技术。作为反抗、牺牲和创新的象征，普罗米修斯代表着对知识的不懈追求和挑战权威的创新。'
      },
      tagRanges: {
        selfAwareness: [0, 40],
        dedication: [80, 100],
        socialIntelligence: [30, 60],
        emotionalRegulation: [10, 50],
        objectivity: [30, 70],
        coreEndurance: [60, 80]
      },
      image: '/images/characters/prometheus.jpg'
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
        en: 'As Nüwa, you are a visionary force of resilience and innovation in the workplace. Your ability to create, transform, and inspire allows you to lead with both empathy and enduring purpose. You thrive in environments that demand adaptability and endurance, bringing ideas to life and guiding teams toward meaningful impact. Your talent for harmonizing different perspectives makes you a catalyst for change, fostering collaboration and creativity. Careers in visionary leadership, human-centered design, and social innovation align perfectly with your ability to build, nurture, and empower.',
        zh: '作为女娲，你是坚韧与创新的化身。你与生俱来的创造力、变革力和感召力，让你既能以同理心领导团队，又能坚守长远使命。在需要快速适应的环境中，你总能游刃有余，将创意转化为现实，并带领团队创造真正的影响力。你善于融合不同观点，这种天赋使你成为推动变革的关键人物，能够有效促进团队协作并激发创新思维。在愿景型领导、人性化设计和社会创新等领域，你建设、培育和赋能他人的能力将得到最大发挥。这些岗位正需要你这种既能构建体系，又能赋能团队的特殊才能。'
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
      image: '/images/characters/nuwa.jpg'
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
        en: 'As Athena, you embody wisdom, strategic thinking, and protective leadership. Your ability to analyze complex situations with clarity and objectivity makes you a trusted advisor and decision-maker. You excel in roles that require careful planning, ethical judgment, and the ability to guide others through challenging circumstances. Your balanced approach to emotional regulation and social intelligence allows you to maintain composure while building meaningful professional relationships. You thrive in careers such as strategic consulting, legal professions, project management, and executive leadership where wisdom and strategic foresight are essential.',
        zh: '作为雅典娜，你体现了智慧、战略思维和保护性领导力。你能够清晰客观地分析复杂情况，这使你成为值得信赖的顾问和决策者。你在需要仔细规划、道德判断和引导他人度过挑战性环境的角色中表现出色。你在情绪调节和社交智能方面的平衡方法使你能够在建立有意义的专业关系的同时保持镇定。你在战略咨询、法律职业、项目管理和行政领导等需要智慧和战略远见的职业中茁壮成长。'
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
      image: '/images/characters/athena.jpg'
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
        en: 'As Venus, you are the master of social dynamics and relationship-building. Your natural charisma and emotional intelligence make you an influential presence in any professional work space. You thrive in roles that require collaboration, persuasion, and interpersonal finesse. Your ability to navigate complex interactions ensures that you excel in positions where communication and adaptability are key. While you may need to manage endurance in long-term high-pressure settings, your ability to inspire and connect makes you an ideal fit for careers in diplomacy, marketing, public relations, and client-facing leadership roles.',
        zh: '作为维纳斯，你是社交艺术和人际关系的大师。天生的魅力和高情商，使你在任何工作场合都能成为极具影响力的存在。在需要团队协作、说服技巧和人际交往能力的岗位上，你总能大放异彩。你擅长处理复杂的社交互动，这使得你在沟通能力和适应力至关重要的职位上表现尤为出色。虽然你可能需要注意在长期高压环境中的耐力管理，但你激励他人、建立联结的天赋，让你特别适合外交、市场营销、公共关系等需要面向客户的领导岗位。'
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
      image: '/images/characters/venus.jpg'
    }
  ];

  useEffect(() => {
    // 从localStorage获取用户测试结果或使用模拟数据
    const getTagStats = () => {
      const savedStats = localStorage.getItem('tagStats');
      if (savedStats) {
        try {
          return JSON.parse(savedStats);
        } catch (e) {
          console.error('Error parsing saved tag statistics:', e);
          return getMockStats(); // 使用模拟数据
        }
      }
      return getMockStats(); // 使用模拟数据
    };

    // 创建模拟测试结果数据用于测试
    const getMockStats = () => {
      return {
        '自我意识': {
          userScore: 40,
          totalPossibleScore: 50,
          scorePercentage: 85, // 增加示例数值
          averageScore: 4,
          answeredQuestions: 10
        },
        '奉献精神': {
          userScore: 36,
          totalPossibleScore: 45,
          scorePercentage: 80,
          averageScore: 4,
          answeredQuestions: 9
        },
        '社交情商': {
          userScore: 42,
          totalPossibleScore: 60,
          scorePercentage: 75,
          averageScore: 3.5,
          answeredQuestions: 12
        },
        '情绪调节': {
          userScore: 32,
          totalPossibleScore: 40,
          scorePercentage: 84,
          averageScore: 4,
          answeredQuestions: 8
        },
        '客观能力': {
          userScore: 45,
          totalPossibleScore: 55,
          scorePercentage: 88,
          averageScore: 4.1,
          answeredQuestions: 11
        },
        '核心耐力': {
          userScore: 50,
          totalPossibleScore: 65,
          scorePercentage: 82,
          averageScore: 3.85,
          answeredQuestions: 13
        }
      };
    };

    // 处理标签得分
    const stats = getTagStats();
    const userScores: Record<string, number> = {};
    
    // 使用集中定义的标签映射
    Object.keys(stats).forEach(tag => {
      if (stats[tag] && typeof stats[tag].scorePercentage === 'number') {
        const engKey = toEnglishTag(tag);
        userScores[engKey] = stats[tag].scorePercentage;
      }
    });

    // 核心耐力单独计算
    const otherTags = ['selfAwareness', 'dedication', 'socialIntelligence', 'emotionalRegulation', 'objectivity'];
    const validScores = otherTags.map(tag => userScores[tag]).filter(v => typeof v === 'number');
    if (validScores.length === 5) {
      const avg = validScores.reduce((a, b) => a + b, 0) / 5;  // 平均百分比
      const coreStat = stats['核心耐力'];
      if (!coreStat || typeof coreStat.scorePercentage !== 'number' || isNaN(coreStat.scorePercentage)) {
        console.error('Invalid core endurance score detected:', coreStat);
        return; // stop further processing
      }
      const baseCore = coreStat.scorePercentage;
      let adjustedCore = baseCore;
      
      // 仅当平均值超过60时才增加核心耐力分数，每增加5点平均值，核心耐力加5点
      if (avg > 60) {
        adjustedCore += (avg - 60);
      }
      adjustedCore = Math.min(100, Math.max(0, adjustedCore)); // <= 100
      userScores['coreEndurance'] = adjustedCore;
    }

    // Get question 25 answer from localStorage
    const savedAnswers = localStorage.getItem('currentAnswers') || localStorage.getItem('motherAnswers') || localStorage.getItem('corporateAnswers') || localStorage.getItem('otherAnswers');
    let question25Answer: string | undefined;
    if (savedAnswers) {
      try {
        const answers = JSON.parse(savedAnswers);
        question25Answer = answers['25'];
      } catch (e) {
        console.error('Error parsing answers:', e);
      }
    }

    // Apply question 25 bonus (adds 10% to specific tag)
    let finalScores = userScores;
    if (question25Answer) {
      finalScores = applyQuestion25Bonus(userScores, question25Answer);
    }

    setTagScores(finalScores);

    // 匹配最佳符合的卡片并按匹配度排序，使用question 25作为tie-breaker
    if (Object.keys(finalScores).length > 0) {
      const sortedCards = sortCharactersByMatch(finalScores, cardsData, question25Answer);
      setCards(sortedCards);
      setActiveCardIndex(0);
      setMatchedCard(sortedCards[0]);
    } else {
      setCards(cardsData);
    }
  }, []);

  // Check if user is logged in
  useEffect(() => {
    const checkLoginStatus = () => {
      const hasAccount = localStorage.getItem('userAccount');
      console.log('Checking login status:', { hasAccount, isLoggedIn: !!hasAccount });
      setIsLoggedIn(!!hasAccount);
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
  const handleImageError = React.useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>, size: string) => {
    // 如果图片加载失败，使用默认占位图像
    const target = e.currentTarget;
    target.src = `https://via.placeholder.com/${size}?text=C`;
    
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
              onError={(e) => handleImageError(e, '350x350')}
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
              onClick={() => navigate('/login', { state: { mode: 'register' } })}
            >
              {language === 'en' ? 'Create Account' : '创建账户'}
            </button>
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
              <p>{language === 'en' ? matchedCard.description.en : matchedCard.description.zh}</p>
            </div>
          )}
          
          <div className="user-results">
            <h3>{language === 'en' ? 'Your Test Results' : '您的测试结果'}</h3>
            <div className="results-grid">
              {Object.entries(tagScores).map(([tag, score], index) => (
                <div key={tag} className="result-item" style={{ animationDelay: `${1.3 + index * 0.1}s` }}>
                  <span className="result-label">
                    {tagLabels[tag] ? (language === 'en' ? tagLabels[tag].en : tagLabels[tag].zh) : tag}
                  </span>
                  <div className="result-bar-container">
                    <div 
                      className="result-bar" 
                      style={{ 
                        '--target-width': `${score}%`,
                        animation: `growWidth 1.5s cubic-bezier(0.17, 0.67, 0.83, 0.67) ${1.4 + index * 0.1}s forwards`
                      } as React.CSSProperties}
                    ></div>
                  </div>
                  <span className="result-value">{Math.round(score)}%</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Create Account Button - At bottom on mobile */}
          {!isLoggedIn && (
            <button 
              className="create-account-button-mobile"
              onClick={() => navigate('/login', { state: { mode: 'register' } })}
            >
              {language === 'en' ? 'Create Account' : '创建账户'}
            </button>
          )}
        </div>
      </div>
      
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
                onError={(e) => handleImageError(e, '50x50')}
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
