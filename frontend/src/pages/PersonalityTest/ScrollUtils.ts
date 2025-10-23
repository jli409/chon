// Track if we're in an auto-scroll to prevent manual scroll handler
let isAutoScrolling = false;

/**
 * 滚动到下一个问题元素
 * @param currentQuestionId 当前问题的ID
 */
export const scrollToNextQuestion = (currentQuestionId: string): void => {
  // Extract the numeric part from the question ID (e.g., "mother_1" -> 1)
  const currentNum = parseInt(currentQuestionId.split('_')[1]) || 0;
  const nextQuestionId = currentNum + 1;
  
  // Try to find the next question element with the same prefix
  const prefix = currentQuestionId.split('_')[0];
  let nextQuestionElement = document.getElementById(`question-${prefix}_${nextQuestionId}`);
  
  // If not found, try to find any subsequent question on the page
  if (!nextQuestionElement) {
    const questions = document.querySelectorAll('[id^="question-"]');
    const questionIds = Array.from(questions).map(el => {
      const id = el.id.replace('question-', '');
      const num = parseInt(id.split('_')[1]) || 0;
      return { id, num };
    });
    
    // Find the next question with a higher numeric ID
    const nextIds = questionIds.filter(q => q.num > currentNum).sort((a, b) => a.num - b.num);
    if (nextIds.length > 0) {
      nextQuestionElement = document.getElementById(`question-${nextIds[0].id}`);
    }
  }
  
  // If found, scroll to the next question element and manage visibility
  if (nextQuestionElement) {
    // Set auto-scroll flag
    isAutoScrolling = true;
    
    // Use a small delay to ensure DOM is updated
    setTimeout(() => {
      // Hide all questions first
      const allQuestions = document.querySelectorAll('.question-container');
      allQuestions.forEach(q => {
        q.classList.remove('question-visible');
        q.classList.add('question-hidden');
      });
      
      // Show only the next question
      nextQuestionElement?.classList.remove('question-hidden');
      nextQuestionElement?.classList.add('question-visible');
      
      // Wait for visibility changes to complete, then scroll to position
      setTimeout(() => {
        if (nextQuestionElement) {
          // Force a reflow to ensure accurate height measurement
          nextQuestionElement.offsetHeight;
          
          // Check if question is taller than viewport
          const questionHeight = nextQuestionElement.getBoundingClientRect().height;
          const viewportHeight = window.innerHeight;
          
          // For questions with many options (like question 5 and 8), always position at top
          // Check if it's question 5 or 8 specifically or has many options
          const questionId = nextQuestionElement.id;
          const hasManyOptions = nextQuestionElement.querySelectorAll('.answer-option').length > 8;
          
          if (questionId.includes('5') || questionId.includes('8') || hasManyOptions || questionHeight > viewportHeight * 0.7) {
            // For tall questions or questions with many options, position at top
            nextQuestionElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start'
            });
          } else {
            // For normal questions, center them
            nextQuestionElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center'
            });
          }
        }
      }, 900);
      
      // Clear auto-scroll flag after animation completes
      setTimeout(() => {
        isAutoScrolling = false;
      }, 1200);
    }, 150);
  }
};

/**
 * Show all questions when user manually scrolls
 */
export let hasUserScrolled = false;
let lastScrollY = 0;
let scrollHandlerInitialY = 0;

export const resetUserScroll = () => {
  hasUserScrolled = false;
  lastScrollY = 0;
  scrollHandlerInitialY = window.scrollY;
};

export const showAllQuestionsOnScroll = (): void => {
  scrollHandlerInitialY = window.scrollY;
  
  const handleScroll = () => {
    // Ignore scroll events during auto-scroll
    if (isAutoScrolling) {
      return;
    }
    
    // If user hasn't scrolled yet, check if they are now
    if (!hasUserScrolled) {
      // Detect actual user scroll from initial position
      const currentScrollY = window.scrollY;
      const scrollDelta = Math.abs(currentScrollY - scrollHandlerInitialY);
      const scrollDirection = currentScrollY < lastScrollY ? 'up' : 'down';
      lastScrollY = currentScrollY;
      
      // Trigger if there's significant scroll movement (>150px from start for mobile)
      const isMobile = window.innerWidth <= 768;
      const scrollThreshold = isMobile ? 150 : 50;
      
      if (scrollDelta > scrollThreshold) {
        // Check if we're scrolling within a tall question's content
        const visibleQuestion = document.querySelector('.question-container.question-visible');
        if (visibleQuestion) {
          const questionRect = visibleQuestion.getBoundingClientRect();
          const questionHeight = questionRect.height;
          const viewportHeight = window.innerHeight;
          
          // If the question is taller than viewport, user might be scrolling within it
          if (questionHeight > viewportHeight) {
            // Only trigger if scroll goes significantly beyond the question
            const questionBottom = questionRect.bottom;
            const scrolledPastQuestion = questionBottom < (viewportHeight * 0.3); // Question is 70% scrolled past
            
            if (!scrolledPastQuestion) {
              // Still within the tall question, don't show all questions yet
              return;
            }
          }
        }
        
        hasUserScrolled = true;
        
        // Check if continue button is visible (meaning we're at end of section)
        const continueButton = document.querySelector('.question-navigation');
        const isContinueButtonVisible = continueButton && !continueButton.classList.contains('button-hidden');
        
        if (!isContinueButtonVisible) {
          // Show all questions when user scrolls (only if not at end of section)
          const allQuestions = document.querySelectorAll('.question-container');
          allQuestions.forEach(q => {
            q.classList.remove('question-hidden');
            q.classList.add('question-visible');
          });
          
          // Show continue button too
          if (continueButton) {
            continueButton.classList.remove('button-hidden');
            continueButton.classList.add('button-visible');
          }
        }
      }
    }
  };
  
  window.addEventListener('scroll', handleScroll, { passive: true });
};

/**
 * 滚动到页面顶部
 */
export const scrollToPageTop = (): void => {
  window.scrollTo({ 
    top: 0, 
    behavior: 'smooth' 
  });
};

/**
 * 滚动到下一页的第一个问题
 * 先滚动到页面顶部，然后在短暂延迟后滚动到第一个问题
 */
export const scrollToFirstQuestionOfNextPage = (): void => {
  // 先滚动到页面顶部
  scrollToPageTop();
  
  // 延迟后尝试查找并滚动到页面上的第一个问题
  setTimeout(() => {
    // 查找页面上可见的第一个问题元素
    const questions = document.querySelectorAll('[id^="question-"]');
    if (questions.length > 0) {
      // 尝试获取当前页面上的第一个问题
      const firstQuestion = questions[0] as HTMLElement;
      if (firstQuestion) {
        // Force a reflow to ensure accurate height measurement
        firstQuestion.offsetHeight;
        
        // Check if question is taller than viewport
        const questionHeight = firstQuestion.getBoundingClientRect().height;
        const viewportHeight = window.innerHeight;
        
        // For questions with many options (like question 5 and 8), always position at top
        // Check if it's question 5 or 8 specifically or has many options
        const questionId = firstQuestion.id;
        const hasManyOptions = firstQuestion.querySelectorAll('.answer-option').length > 8;
        
        if (questionId.includes('5') || questionId.includes('8') || hasManyOptions || questionHeight > viewportHeight * 0.7) {
          // For tall questions or questions with many options, position at top
          firstQuestion.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start'
          });
        } else {
          // For normal questions, center them
          firstQuestion.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center'
          });
        }
        return;
      }
      
      // 备选方案：找到视口内的第一个问题
      const firstVisibleQuestion = Array.from(questions).find(elem => {
        const rect = elem.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      });
      
      if (firstVisibleQuestion) {
        const questionHeight = (firstVisibleQuestion as HTMLElement).getBoundingClientRect().height;
        const viewportHeight = window.innerHeight;
        const scrollBlock = questionHeight > viewportHeight ? 'start' : 'center';
        
        firstVisibleQuestion.scrollIntoView({ 
          behavior: 'smooth', 
          block: scrollBlock
        });
      }
    }
  }, 500); // 500ms延迟，确保页面已切换
}; 