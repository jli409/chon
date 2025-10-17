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
  
  // If found, scroll to the next question element
  if (nextQuestionElement) {
    // Use a small delay to ensure DOM is updated
    setTimeout(() => {
      nextQuestionElement?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center'
      });
    }, 50);
  }
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
      const firstQuestion = questions[0];
      if (firstQuestion) {
        firstQuestion.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center'
        });
        return;
      }
      
      // 备选方案：找到视口内的第一个问题
      const firstVisibleQuestion = Array.from(questions).find(elem => {
        const rect = elem.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      });
      
      if (firstVisibleQuestion) {
        firstVisibleQuestion.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center'
        });
      }
    }
  }, 500); // 500ms延迟，确保页面已切换
}; 